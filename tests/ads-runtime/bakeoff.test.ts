import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildRenderLifecycleDebugFixture,
  createRenderLifecycleFixtureInput,
  buildRenderJobFromCreativeRenderSpecs
} from "@homeai/render-pipeline";
import {
  BakeoffScorecardSchema,
  InMemoryProviderRegistry,
  MockImageAdapter,
  RenderProviderPolicyError,
  assertProviderAllowedForJob,
  createBlockedRealProviderPolicy,
  createDefaultStubProviderSuite,
  createMockProviderPolicy,
  createStubBakeoffPolicy,
  createStubProvider,
  runBakeoff
} from "@homeai/ads-runtime";

const repoRoot = process.cwd();

const RUN_AT = "2026-05-14T00:00:00.000Z";

function buildFixtureRegistry(): {
  registry: InMemoryProviderRegistry;
  renderJob: import("@homeai/contracts").RenderJob;
  specs: ReadonlyArray<import("@homeai/contracts").CreativeRenderSpec>;
} {
  const fixture = createRenderLifecycleFixtureInput({ withLayoutIntent: true });
  const renderJob = buildRenderJobFromCreativeRenderSpecs({
    schemeLiteContract: fixture.schemeLiteContract,
    sceneContract: fixture.sceneContract,
    creativeRenderSpecs: fixture.creativeRenderSpecs
  });
  const registry = new InMemoryProviderRegistry();
  registry.register({
    provider: new MockImageAdapter({ providerId: "mock_render_provider", providerName: "Mock" }),
    policy: createMockProviderPolicy("mock_render_provider", "mock")
  });
  registry.register({
    provider: createStubProvider({
      providerId: "stub_a_normal",
      providerName: "Stub A",
      modelId: "stub-a"
    }),
    policy: createStubBakeoffPolicy("stub_a_normal", "stub-a")
  });
  registry.register({
    provider: createStubProvider({
      providerId: "stub_c_missing_asset",
      providerName: "Stub C (missing asset)",
      modelId: "stub-c",
      mode: "missing_asset"
    }),
    policy: createStubBakeoffPolicy("stub_c_missing_asset", "stub-c")
  });
  return { registry, renderJob, specs: fixture.creativeRenderSpecs };
}

describe("Batch 05 — provider registry, policy gate, and bakeoff harness", () => {
  it("registry.get returns the provider previously registered (provider selection)", () => {
    const registry = new InMemoryProviderRegistry();
    const provider = new MockImageAdapter({ providerId: "mock_a", providerName: "Mock A" });
    registry.register({
      provider,
      policy: createMockProviderPolicy("mock_a", "mock-model")
    });
    expect(registry.get("mock_a")?.provider.providerName).toBe("Mock A");
    expect(registry.get("mock_unknown")).toBeUndefined();
  });

  it("provider allowlist excludes blocked policies from bakeoff", () => {
    const registry = new InMemoryProviderRegistry();
    registry.register({
      provider: new MockImageAdapter({ providerId: "mock_allowed", providerName: "Mock" }),
      policy: createMockProviderPolicy("mock_allowed", "mock")
    });
    registry.register({
      provider: new MockImageAdapter({ providerId: "blocked_real", providerName: "Blocked Real" }),
      policy: createBlockedRealProviderPolicy("blocked_real", "real-model")
    });

    const allowed = registry.allowedForBakeoff().map((e) => e.provider.providerId).sort();
    expect(allowed).toEqual(["mock_allowed"]);
  });

  it("disabled (blocked) provider cannot be invoked: the policy gate throws", () => {
    const policy = createBlockedRealProviderPolicy("blocked_provider", "blocked-model");
    expect(() => assertProviderAllowedForJob(policy, { forRealProvider: false })).toThrow(
      RenderProviderPolicyError
    );
    expect(() => assertProviderAllowedForJob(policy, { forRealProvider: true })).toThrow(
      RenderProviderPolicyError
    );
  });

  it("real provider call fails closed against mock policy (real_provider_disabled)", () => {
    const policy = createMockProviderPolicy("mock", "mock");
    let caught: RenderProviderPolicyError | undefined;
    try {
      assertProviderAllowedForJob(policy, { forRealProvider: true });
    } catch (e) {
      caught = e as RenderProviderPolicyError;
    }
    expect(caught?.code).toBe("real_provider_disabled");
  });

  it("every generated candidate has a populated ProviderTrace (canonical RenderTrace)", async () => {
    const { registry, renderJob, specs } = buildFixtureRegistry();
    const { candidates } = await runBakeoff({
      bakeoffRunId: "bake-trace-test",
      scenarioLabel: "smoke",
      runAt: RUN_AT,
      renderJob,
      specs,
      registry
    });
    // Each non-skipped provider produces one candidate per spec.
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.trace.traceId.length).toBeGreaterThan(0);
      expect(c.trace.networkCalls).toBe(false);
      expect(c.trace.providerCalls.length).toBeGreaterThan(0);
      expect(c.trace.providerCalls[0]?.providerKind).toBe("mock");
    }
  });

  it("bakeoff scorecard is deterministic for the same input", async () => {
    const setup1 = buildFixtureRegistry();
    const r1 = await runBakeoff({
      bakeoffRunId: "bake-determinism-test",
      scenarioLabel: "determinism",
      runAt: RUN_AT,
      renderJob: setup1.renderJob,
      specs: setup1.specs,
      registry: setup1.registry
    });

    const setup2 = buildFixtureRegistry();
    const r2 = await runBakeoff({
      bakeoffRunId: "bake-determinism-test",
      scenarioLabel: "determinism",
      runAt: RUN_AT,
      renderJob: setup2.renderJob,
      specs: setup2.specs,
      registry: setup2.registry
    });

    expect(BakeoffScorecardSchema.safeParse(r1.scorecard).success).toBe(true);
    expect(BakeoffScorecardSchema.safeParse(r2.scorecard).success).toBe(true);
    expect(JSON.stringify(r1.scorecard)).toEqual(JSON.stringify(r2.scorecard));
  });

  it("bakeoff skips blocked-policy providers without invoking them", async () => {
    const { registry, renderJob, specs } = buildFixtureRegistry();
    registry.register({
      provider: new MockImageAdapter({
        providerId: "blocked_provider",
        providerName: "Blocked"
      }),
      policy: createBlockedRealProviderPolicy("blocked_provider", "real-model")
    });
    const { scorecard } = await runBakeoff({
      bakeoffRunId: "bake-skip-blocked",
      scenarioLabel: "skip",
      runAt: RUN_AT,
      renderJob,
      specs,
      registry
    });

    const blockedSummary = scorecard.providerResults.find(
      (r) => r.providerId === "blocked_provider"
    );
    expect(blockedSummary).toBeDefined();
    expect(blockedSummary?.skippedReason).toBeDefined();
    expect(blockedSummary?.candidatesGenerated).toBe(0);
    expect(scorecard.status).toBe("partial");
  });

  it("bakeoff records candidates' verifier results (pass / warning / fail)", async () => {
    const { registry, renderJob, specs } = buildFixtureRegistry();
    const { scorecard } = await runBakeoff({
      bakeoffRunId: "bake-verify-results",
      scenarioLabel: "verify",
      runAt: RUN_AT,
      renderJob,
      specs,
      registry
    });

    const normal = scorecard.providerResults.find((r) => r.providerId === "stub_a_normal");
    const missing = scorecard.providerResults.find(
      (r) => r.providerId === "stub_c_missing_asset"
    );
    expect(normal?.verificationPassCount).toBeGreaterThan(0);
    expect(normal?.verificationFailCount).toBe(0);
    // missing-asset stub: every candidate should fail output_asset_present
    expect(missing?.verificationFailCount).toBeGreaterThan(0);
    expect(missing?.verificationPassCount).toBe(0);
  });

  it("default stub provider suite has 3 entries and runs in bakeoff", async () => {
    const fixture = createRenderLifecycleFixtureInput({ withLayoutIntent: true });
    const renderJob = buildRenderJobFromCreativeRenderSpecs({
      schemeLiteContract: fixture.schemeLiteContract,
      sceneContract: fixture.sceneContract,
      creativeRenderSpecs: fixture.creativeRenderSpecs
    });
    const registry = new InMemoryProviderRegistry();
    for (const provider of createDefaultStubProviderSuite()) {
      registry.register({
        provider,
        policy: createStubBakeoffPolicy(provider.providerId, provider.modelId)
      });
    }
    expect(registry.list().length).toBe(3);
    const { scorecard } = await runBakeoff({
      bakeoffRunId: "bake-stub-suite",
      scenarioLabel: "suite",
      runAt: RUN_AT,
      renderJob,
      specs: fixture.creativeRenderSpecs,
      registry
    });
    expect(scorecard.providerCount).toBe(3);
  });

  it("bakeoff source files never import external HTTP libraries (offline guarantee)", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "ads-runtime", "src", "adapters"),
      join(repoRoot, "packages", "ads-runtime", "src", "bakeoff"),
      join(repoRoot, "packages", "ads-runtime", "src", "policy")
    ]);
    const forbidden = [
      /\bfetch\s*\(/,
      /from\s+["']node:https?["']/,
      /from\s+["']https?["']/,
      /from\s+["']axios["']/,
      /from\s+["']undici["']/,
      /from\s+["']node-fetch["']/,
      /\bnew\s+XMLHttpRequest\b/
    ];
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden.filter((p) => p.test(text)).map((p) => `${file}: ${p.toString()}`);
    });
    expect(hits).toEqual([]);
  });
});

function collectFiles(roots: string[]): string[] {
  return roots.flatMap((root) => walk(root)).filter((f) => /\.(ts|tsx)$/.test(f));
}

function walk(path: string): string[] {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    if (child.includes("node_modules")) return [];
    return walk(child);
  });
}
