import type { RenderProviderPolicy } from "./render-provider-policy.js";

/**
 * Real-provider spike gate per recovery task card §10. Returns the full
 * gate evaluation — every gate must be `passed: true` for a real provider
 * to ever be invoked. The default `realProviderEnabled` flag is read from
 * the runtime context (e.g. env var); if absent or false, the result is
 * never `allRequiredGatesPassed=true` regardless of policy.
 */

export interface RealProviderSpikeGateInput {
  policy: RenderProviderPolicy;
  // Environment-level flag. Defaults to false. The only way to set this
  // to true is via deliberate runtime configuration AND every other gate
  // already passing in the policy.
  realProviderEnabled: boolean;
  // Hash of the canonical CreativeRenderSpec set in scope. The gate
  // requires the spec set to be deterministic per Batch 09 freeze.
  creativeRenderSpecFreezeRef?: string;
  // True if ADS Batch 03 RenderVerifier L1 is part of the deploy.
  renderVerifierL1Implemented: boolean;
  // True if the gallery admission path refuses to admit fail-status reports.
  failRenderBlockedFromGallery: boolean;
  // True if ProviderTrace required fields are populated by adapters.
  providerTraceImplemented: boolean;
  // True if secrets handling has been audited / no API keys are committed.
  secretsNotCommitted: boolean;
}

export interface GateCheck {
  id: string;
  passed: boolean;
  reason: string;
}

export interface RealProviderSpikeGateResult {
  allRequiredGatesPassed: boolean;
  realProviderEnabled: boolean;
  checks: ReadonlyArray<GateCheck>;
  blockingReasons: ReadonlyArray<string>;
}

export function evaluateRealProviderSpikeGate(
  input: RealProviderSpikeGateInput
): RealProviderSpikeGateResult {
  const checks: GateCheck[] = [];

  checks.push({
    id: "policy_status",
    passed:
      input.policy.status === "allowed_for_spike" ||
      input.policy.status === "allowed_for_production",
    reason:
      `policy.status=${input.policy.status} (must be allowed_for_spike or allowed_for_production)`
  });

  checks.push({
    id: "commercial_use_documented",
    passed:
      input.policy.commercialUseStatus === "allowed" ||
      input.policy.commercialUseStatus === "restricted",
    reason: `policy.commercialUseStatus=${input.policy.commercialUseStatus} (must be allowed or restricted with documentation)`
  });

  checks.push({
    id: "data_retention_documented",
    passed:
      input.policy.dataRetentionStatus === "acceptable" ||
      input.policy.dataRetentionStatus === "restricted",
    reason: `policy.dataRetentionStatus=${input.policy.dataRetentionStatus} (must be documented as acceptable or restricted)`
  });

  checks.push({
    id: "copyright_risk_known",
    passed: input.policy.copyrightRisk !== "unknown",
    reason: `policy.copyrightRisk=${input.policy.copyrightRisk} (must NOT be unknown)`
  });

  checks.push({
    id: "max_cost_set",
    passed: input.policy.maxEstimatedCostCentsPerCandidate >= 0,
    reason: `policy.maxEstimatedCostCentsPerCandidate=${input.policy.maxEstimatedCostCentsPerCandidate}`
  });

  checks.push({
    id: "timeout_set",
    passed: input.policy.timeoutMs > 0,
    reason: `policy.timeoutMs=${input.policy.timeoutMs}`
  });

  checks.push({
    id: "retry_limit_set",
    passed: input.policy.maxAttemptsPerJob > 0,
    reason: `policy.maxAttemptsPerJob=${input.policy.maxAttemptsPerJob}`
  });

  checks.push({
    id: "creative_render_spec_freeze",
    passed:
      input.creativeRenderSpecFreezeRef !== undefined &&
      input.creativeRenderSpecFreezeRef.length > 0,
    reason:
      input.creativeRenderSpecFreezeRef === undefined
        ? "creativeRenderSpecFreezeRef not provided"
        : `freeze ref ${input.creativeRenderSpecFreezeRef}`
  });

  checks.push({
    id: "render_verifier_l1",
    passed: input.renderVerifierL1Implemented,
    reason: input.renderVerifierL1Implemented
      ? "@homeai/render-verifier L1 baseline present"
      : "@homeai/render-verifier L1 baseline missing"
  });

  checks.push({
    id: "fail_render_blocked_from_gallery",
    passed: input.failRenderBlockedFromGallery,
    reason: input.failRenderBlockedFromGallery
      ? "gallery admission rejects fail-status reports"
      : "gallery admission still allows fail-status reports"
  });

  checks.push({
    id: "provider_trace_implemented",
    passed: input.providerTraceImplemented,
    reason: input.providerTraceImplemented
      ? "canonical RenderTrace populated on every candidate"
      : "canonical RenderTrace not yet populated by adapters"
  });

  checks.push({
    id: "secrets_not_committed",
    passed: input.secretsNotCommitted,
    reason: input.secretsNotCommitted
      ? "no secrets present in repo"
      : "secrets potentially present in repo"
  });

  checks.push({
    id: "real_provider_enabled_flag",
    passed: input.realProviderEnabled,
    reason: input.realProviderEnabled
      ? "real-provider runtime flag is true"
      : "real-provider runtime flag is false (default — disabled)"
  });

  const blockingReasons = checks.filter((c) => c.passed === false).map((c) => `${c.id}: ${c.reason}`);
  return {
    allRequiredGatesPassed: blockingReasons.length === 0,
    realProviderEnabled: input.realProviderEnabled,
    checks,
    blockingReasons
  };
}
