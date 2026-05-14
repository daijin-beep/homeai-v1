import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadCreativeRenderSpecFixture,
  validateCreativeRenderSpecForADS
} from "@homeai/ads-render";
import {
  MockImageAdapter,
  MockImageAdapterError,
  ProviderTraceSchema,
  loadRenderProviderPolicyFixture,
  type RenderProviderPolicy
} from "@homeai/image-adapter";

const repoRoot = process.cwd();
const mockAdapterSource = join(
  repoRoot,
  "packages",
  "image-adapter",
  "src",
  "adapters",
  "mock-image-adapter.ts"
);

const policy: RenderProviderPolicy = loadRenderProviderPolicyFixture("mock-allowed");

function loadValidSpec(): ReturnType<typeof validateCreativeRenderSpecForADS> {
  return validateCreativeRenderSpecForADS(loadCreativeRenderSpecFixture("valid"));
}

describe("ADS Batch 01 — MockImageAdapter", () => {
  it("declares mock provider metadata and zero-cost estimate", async () => {
    const adapter = new MockImageAdapter();
    expect(adapter.providerName).toBe("mock");
    expect(adapter.providerModel).toBe("mock-deterministic-v1");
    expect(adapter.adapterVersion).toBe("0.1.0");
    const validation = loadValidSpec();
    if (validation.status !== "pass") throw new Error("fixture should validate");
    const estimate = await adapter.estimateCost({
      spec: validation.spec,
      policy,
      jobId: "job_test",
      attempt: 1
    });
    expect(estimate.estimatedCostCents).toBe(0);
  });

  it("returns a deterministic candidate with valid ProviderTrace", async () => {
    const adapter = new MockImageAdapter({ clock: { now: () => "2026-05-13T00:00:00.000Z" } });
    const validation = loadValidSpec();
    if (validation.status !== "pass") throw new Error("fixture should validate");
    const r1 = await adapter.generate({ spec: validation.spec, policy, jobId: "job_a", attempt: 1 });
    const r2 = await adapter.generate({ spec: validation.spec, policy, jobId: "job_a", attempt: 1 });

    expect(r1.imageUrl).toEqual(r2.imageUrl);
    expect(r1.providerTrace.traceId).toEqual(r2.providerTrace.traceId);
    expect(r1.providerTrace.outputAssetHash).toEqual(r2.providerTrace.outputAssetHash);

    // Trace must validate against schema
    const parsed = ProviderTraceSchema.safeParse(r1.providerTrace);
    expect(parsed.success).toBe(true);

    // imageUrl must be inline (no external API call)
    expect(r1.imageUrl.startsWith("data:image/svg+xml;base64,")).toBe(true);

    // inputAssetHashes must record one hash per input URL (6 total)
    expect(r1.providerTrace.inputAssetHashes.length).toBe(6);

    // policySnapshot must equal the policy supplied
    expect(r1.providerTrace.policySnapshot.policyId).toEqual(policy.policyId);
  });

  it("rejects (throws) when mode='timeout'", async () => {
    const adapter = new MockImageAdapter({ mode: "timeout" });
    const validation = loadValidSpec();
    if (validation.status !== "pass") throw new Error("fixture should validate");
    await expect(
      adapter.generate({ spec: validation.spec, policy, jobId: "j", attempt: 1 })
    ).rejects.toBeInstanceOf(MockImageAdapterError);
  });

  it("rejects (throws) when mode='storage_fail'", async () => {
    const adapter = new MockImageAdapter({ mode: "storage_fail" });
    const validation = loadValidSpec();
    if (validation.status !== "pass") throw new Error("fixture should validate");
    await expect(
      adapter.generate({ spec: validation.spec, policy, jobId: "j", attempt: 1 })
    ).rejects.toBeInstanceOf(MockImageAdapterError);
  });

  it("returns an obviously invalid candidate when mode='malformed' (empty imageUrl)", async () => {
    const adapter = new MockImageAdapter({ mode: "malformed" });
    const validation = loadValidSpec();
    if (validation.status !== "pass") throw new Error("fixture should validate");
    const result = await adapter.generate({ spec: validation.spec, policy, jobId: "j", attempt: 1 });
    expect(result.imageUrl).toEqual("");
    expect(result.providerTrace.errorCode).toEqual("malformed");
  });

  it("source file contains no external HTTP call or network import", () => {
    const text = readFileSync(mockAdapterSource, "utf8");
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/from\s+["']node:https?["']/);
    expect(text).not.toMatch(/from\s+["']https?["']/);
    expect(text).not.toMatch(/from\s+["']axios["']/);
    expect(text).not.toMatch(/from\s+["']undici["']/);
  });
});
