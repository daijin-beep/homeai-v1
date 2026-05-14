import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

/**
 * Track B Green Zone enforcement for the recovery branch.
 *
 * Track B packages and routes must not:
 *   - import Track A write paths (@homeai/floorplan-parser,
 *     @homeai/geometry, @homeai/scene)
 *   - reference Track A write functions
 *     (createCanonicalFloorplanRevision, buildSceneContract,
 *     createInMemoryP1Repositories, confirmFloorplanDraft, etc.)
 *   - call the network (fetch, node:http, axios, undici, node-fetch,
 *     XMLHttpRequest)
 *   - touch Space Truth, P1 Canvas, geometryHash generation, or
 *     LayoutIntent write path
 *
 * The recovery audit and canonical-import-strategy docs must be present.
 */

const TRACK_B_PACKAGE_ROOTS = [
  join(repoRoot, "packages", "render-verifier", "src"),
  join(repoRoot, "packages", "ads-runtime", "src"),
  join(repoRoot, "apps", "web", "app", "api", "render-snapshot"),
  join(repoRoot, "apps", "web", "app", "api", "render-human-review"),
  join(repoRoot, "apps", "web", "app", "dev", "render-debug")
];

const TRACK_A_WRITE_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["']@homeai\/floorplan-parser["']/,
  /from\s+["']@homeai\/geometry["']/,
  /from\s+["']@homeai\/scene["']/,
  /\bcreateCanonicalFloorplanRevision\b/,
  /\bbuildSceneContract\b/,
  /\bcreateSceneContractV02\b/,
  /\bcreateInMemoryP1Repositories\b/,
  /\bconfirmFloorplanDraft\b/,
  /\brunSpaceTruthGate\b/,
  /\bbuildLayoutIntentContract\b/,
  /\bcreateInitialLayoutIntent\b/
];

const NETWORK_PATTERNS: ReadonlyArray<RegExp> = [
  /\bfetch\s*\(/,
  /from\s+["']node:https?["']/,
  /from\s+["']https?["']/,
  /from\s+["']axios["']/,
  /from\s+["']undici["']/,
  /from\s+["']node-fetch["']/,
  /\bnew\s+XMLHttpRequest\b/
];

const FORBIDDEN_PRODUCT_SCOPE: ReadonlyArray<RegExp> = [
  /PDF export/i,
  /DWG/i,
  /DXF/i,
  /construction drawing/i,
  /load-bearing/i,
  /GB compliance/i,
  /structural feasibility/i
];

const FORBIDDEN_PROVIDER_NAMES: ReadonlyArray<RegExp> = [
  // No real provider integration source in Track B code. Note the gate
  // doc (docs/ads/real-provider-spike-gate.md) names these intentionally;
  // the scan skips Markdown so the doc is not affected.
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bgemini\b/i,
  /\bnano\s*banana\b/i,
  /\bflux\b/i,
  /\bqwen\b/i,
  /\breplicate\b/i,
  /\bstability\b/i
];

describe("Track B scope scan — Green Zone enforcement", () => {
  it("Track B packages and web routes never import Track A write paths", () => {
    const hits = matchAcross(TRACK_B_PACKAGE_ROOTS, TRACK_A_WRITE_PATH_PATTERNS);
    expect(hits).toEqual([]);
  });

  it("Track B packages and web routes never call the network", () => {
    const hits = matchAcross(TRACK_B_PACKAGE_ROOTS, NETWORK_PATTERNS);
    expect(hits).toEqual([]);
  });

  it("Track B packages never use V1-forbidden product scope phrases", () => {
    const hits = matchAcross(TRACK_B_PACKAGE_ROOTS, FORBIDDEN_PRODUCT_SCOPE);
    expect(hits).toEqual([]);
  });

  it("Track B production source (excluding gate report doc) never names a real provider", () => {
    // Scan code only — docs/ads/real-provider-spike-gate.md is a status
    // report that legitimately names providers as pending evaluation; it
    // lives in docs/ which is not in this scope.
    const hits = matchAcross(TRACK_B_PACKAGE_ROOTS, FORBIDDEN_PROVIDER_NAMES);
    expect(hits).toEqual([]);
  });

  it("recovery audit doc and canonical import strategy doc are present", () => {
    const auditPath = join(repoRoot, "docs", "ads", "recovery-audit-batch03-06.md");
    const strategyPath = join(repoRoot, "docs", "ads", "canonical-import-strategy.md");
    const gateReportPath = join(repoRoot, "docs", "ads", "real-provider-spike-gate.md");
    expect(statSync(auditPath).isFile()).toBe(true);
    expect(statSync(strategyPath).isFile()).toBe(true);
    expect(statSync(gateReportPath).isFile()).toBe(true);

    const audit = readFileSync(auditPath, "utf8");
    expect(audit).toMatch(/D-036/);
    expect(audit).toMatch(/origin\/main/);
    expect(audit).toMatch(/ads\/rebased-batch03-06/);
    expect(audit).toMatch(/Recovery branch/);
  });

  it("Track B never adds a competing render pipeline package outside @homeai/render-pipeline", () => {
    const packagesRoot = join(repoRoot, "packages");
    const entries = readdirSync(packagesRoot);
    // Canonical Codex packages keep their original names. Track B-only
    // packages on this recovery branch are `render-verifier` (Track B
    // verifier service) and `ads-runtime` (adapters/bakeoff/queue).
    // Anything else whose name starts with `render-` is a Track B
    // encroachment (e.g. `render-jobs`, `render-image-*`).
    const CANONICAL_ALLOWED = new Set([
      "render-pipeline", // Codex Batch 10
      "render-verifier", // Track B (this branch)
      "creative-render-spec" // Codex Batch 09
    ]);
    const trackBRender = entries.filter(
      (entry) => /^render-/.test(entry) && CANONICAL_ALLOWED.has(entry) === false
    );
    expect(trackBRender).toEqual([]);
  });

  it("Track B packages never publish a top-level export named buildRenderJob (would shadow @homeai/render-pipeline)", () => {
    const files = collect(TRACK_B_PACKAGE_ROOTS);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // `export ... buildRenderJobFromCreativeRenderSpecs` is the canonical
      // function in render-pipeline; Track B may import but must not re-export
      // under the same name from its own index.ts (would create ambiguity for
      // consumers).
      const re = /export\s*\{[^}]*\bbuildRenderJobFromCreativeRenderSpecs\b/m;
      if (re.test(text)) {
        offenders.push(`${file}: re-exports buildRenderJobFromCreativeRenderSpecs`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function collect(roots: ReadonlyArray<string>): string[] {
  return roots
    .flatMap((root) => walk(root))
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .filter((p) => !p.endsWith(".d.ts"));
}

function walk(path: string): string[] {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    if (child.includes("node_modules")) return [];
    return walk(child);
  });
}

function matchAcross(
  roots: ReadonlyArray<string>,
  patterns: ReadonlyArray<RegExp>
): string[] {
  const files = collect(roots);
  return files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return patterns.filter((p) => p.test(text)).map((p) => `${file}: ${p.toString()}`);
  });
}
