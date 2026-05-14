import { describe, expect, it } from "vitest";

import {
  DisabledRealProviderAdapter,
  RealProviderDisabledError,
  createBlockedRealProviderPolicy,
  createMockProviderPolicy,
  evaluateRealProviderSpikeGate,
  type RealProviderSpikeGateInput
} from "@homeai/ads-runtime";

import { buildRenderLifecycleDebugFixture } from "@homeai/render-pipeline";

const BLOCKED_GATE_INPUT: RealProviderSpikeGateInput = {
  policy: createBlockedRealProviderPolicy("blocked_real", "unknown-model"),
  realProviderEnabled: false,
  renderVerifierL1Implemented: true,
  failRenderBlockedFromGallery: true,
  providerTraceImplemented: true,
  secretsNotCommitted: true
};

describe("Batch 06 — real-provider spike gate (disabled by default)", () => {
  it("blocked policy + no runtime flag → allRequiredGatesPassed=false with detailed reasons", () => {
    const result = evaluateRealProviderSpikeGate(BLOCKED_GATE_INPUT);
    expect(result.allRequiredGatesPassed).toBe(false);
    // At minimum: policy_status, commercial_use_documented, data_retention_documented,
    // copyright_risk_known, creative_render_spec_freeze, real_provider_enabled_flag
    // should fail.
    expect(result.blockingReasons.some((r) => r.startsWith("policy_status"))).toBe(true);
    expect(result.blockingReasons.some((r) => r.startsWith("commercial_use_documented"))).toBe(true);
    expect(result.blockingReasons.some((r) => r.startsWith("data_retention_documented"))).toBe(true);
    expect(result.blockingReasons.some((r) => r.startsWith("copyright_risk_known"))).toBe(true);
    expect(result.blockingReasons.some((r) => r.startsWith("real_provider_enabled_flag"))).toBe(true);
  });

  it("mock-only policy fails the gate (mock policies do not authorize real calls)", () => {
    const result = evaluateRealProviderSpikeGate({
      ...BLOCKED_GATE_INPUT,
      policy: createMockProviderPolicy("mock_provider", "mock"),
      realProviderEnabled: true,
      creativeRenderSpecFreezeRef: "test-freeze"
    });
    expect(result.allRequiredGatesPassed).toBe(false);
    expect(result.blockingReasons.some((r) => r.startsWith("policy_status"))).toBe(true);
  });

  it("DisabledRealProviderAdapter.generate() always rejects with RealProviderDisabledError", async () => {
    const adapter = new DisabledRealProviderAdapter({
      providerId: "disabled_real_v1",
      providerName: "Disabled Real Provider",
      modelId: "real-pending",
      gate: BLOCKED_GATE_INPUT
    });
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const spec = fixture.creativeRenderSpecs[0];
    if (spec === undefined) throw new Error("fixture missing");
    await expect(
      adapter.generate({
        spec,
        renderJob: fixture.renderJob,
        policy: BLOCKED_GATE_INPUT.policy,
        candidateId: "test-disabled-call",
        requestedAt: "2026-05-14T00:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(RealProviderDisabledError);
  });

  it("RealProviderDisabledError carries the gate result for forensics", async () => {
    const adapter = new DisabledRealProviderAdapter({
      providerId: "disabled_forensic",
      providerName: "Disabled Forensic",
      modelId: "real-pending",
      gate: BLOCKED_GATE_INPUT
    });
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const spec = fixture.creativeRenderSpecs[0];
    if (spec === undefined) throw new Error("fixture missing");
    try {
      await adapter.generate({
        spec,
        renderJob: fixture.renderJob,
        policy: BLOCKED_GATE_INPUT.policy,
        candidateId: "test-forensic",
        requestedAt: "2026-05-14T00:00:00.000Z"
      });
      throw new Error("expected adapter to reject");
    } catch (e) {
      if (!(e instanceof RealProviderDisabledError)) throw e;
      expect(e.gateResult.allRequiredGatesPassed).toBe(false);
      expect(e.gateResult.blockingReasons.length).toBeGreaterThan(0);
      expect(e.gateResult.realProviderEnabled).toBe(false);
    }
  });

  it("describeGate snapshot matches evaluateRealProviderSpikeGate independently", () => {
    const adapter = new DisabledRealProviderAdapter({
      providerId: "disabled_describe",
      providerName: "Disabled Describe",
      modelId: "real-pending",
      gate: BLOCKED_GATE_INPUT
    });
    const snapshot = adapter.describeGate();
    const independent = evaluateRealProviderSpikeGate(BLOCKED_GATE_INPUT);
    expect(snapshot.allRequiredGatesPassed).toBe(independent.allRequiredGatesPassed);
    expect(snapshot.blockingReasons).toEqual(independent.blockingReasons);
  });

  it("even with every gate marked TRUE except real_provider_enabled_flag, adapter still rejects", async () => {
    // Hypothetical "all green except runtime flag" — exercises that the
    // runtime flag is a separate gate that operator must set.
    const adapter = new DisabledRealProviderAdapter({
      providerId: "disabled_all_green_except_flag",
      providerName: "Disabled All Green Except Flag",
      modelId: "real-pending",
      gate: {
        policy: {
          ...createBlockedRealProviderPolicy("future_real", "future-real-model"),
          status: "allowed_for_spike",
          commercialUseStatus: "allowed",
          dataRetentionStatus: "acceptable",
          copyrightRisk: "low"
        },
        realProviderEnabled: false,
        creativeRenderSpecFreezeRef: "spec-freeze-v0.1",
        renderVerifierL1Implemented: true,
        failRenderBlockedFromGallery: true,
        providerTraceImplemented: true,
        secretsNotCommitted: true
      }
    });
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const spec = fixture.creativeRenderSpecs[0];
    if (spec === undefined) throw new Error("fixture missing");
    await expect(
      adapter.generate({
        spec,
        renderJob: fixture.renderJob,
        policy: BLOCKED_GATE_INPUT.policy,
        candidateId: "test-flag-only",
        requestedAt: "2026-05-14T00:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(RealProviderDisabledError);
  });

  it("every gate green → adapter still throws (scaffold has no implementation)", async () => {
    const adapter = new DisabledRealProviderAdapter({
      providerId: "disabled_all_green",
      providerName: "Disabled All Green",
      modelId: "real-pending",
      gate: {
        policy: {
          ...createBlockedRealProviderPolicy("future_real", "future-real-model"),
          status: "allowed_for_spike",
          commercialUseStatus: "allowed",
          dataRetentionStatus: "acceptable",
          copyrightRisk: "low"
        },
        realProviderEnabled: true,
        creativeRenderSpecFreezeRef: "spec-freeze-v0.1",
        renderVerifierL1Implemented: true,
        failRenderBlockedFromGallery: true,
        providerTraceImplemented: true,
        secretsNotCommitted: true
      }
    });
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const spec = fixture.creativeRenderSpecs[0];
    if (spec === undefined) throw new Error("fixture missing");
    try {
      await adapter.generate({
        spec,
        renderJob: fixture.renderJob,
        policy: BLOCKED_GATE_INPUT.policy,
        candidateId: "test-all-green",
        requestedAt: "2026-05-14T00:00:00.000Z"
      });
      throw new Error("expected adapter to throw");
    } catch (e) {
      if (!(e instanceof RealProviderDisabledError)) throw e;
      expect(e.message).toMatch(/adapter implementation is not present/);
      expect(e.gateResult.allRequiredGatesPassed).toBe(true);
    }
  });
});
