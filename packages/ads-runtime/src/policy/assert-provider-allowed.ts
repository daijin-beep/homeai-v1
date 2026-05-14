import type { RenderProviderPolicy } from "./render-provider-policy.js";

export class RenderProviderPolicyError extends Error {
  override readonly name = "RenderProviderPolicyError";
  readonly code:
    | "blocked"
    | "mock_only"
    | "unknown_commercial_use"
    | "unknown_data_retention"
    | "cost_exceeded"
    | "real_provider_disabled";
  readonly policyId: string;

  constructor(code: RenderProviderPolicyError["code"], policyId: string, message: string) {
    super(message);
    this.code = code;
    this.policyId = policyId;
  }
}

export interface ProviderGateContext {
  forRealProvider: boolean;
  estimatedCostCents?: number;
  bakeoffOnly?: boolean;
}

/**
 * Default-deny gate. Mock policies pass immediately; bakeoff-allowed
 * policies pass for bakeoff context; real providers require
 * `allowed_for_spike` or higher AND non-unknown commercial/retention
 * status. Always fails if a real-provider call is requested without
 * an explicit spike-or-higher policy.
 */
export function assertProviderAllowedForJob(
  policy: RenderProviderPolicy,
  context: ProviderGateContext = { forRealProvider: false }
): void {
  if (policy.status === "blocked") {
    throw new RenderProviderPolicyError(
      "blocked",
      policy.policyId,
      `provider policy ${policy.policyId} is blocked`
    );
  }

  if (context.forRealProvider) {
    if (policy.status === "allowed_for_mock" || policy.status === "allowed_for_bakeoff") {
      throw new RenderProviderPolicyError(
        "real_provider_disabled",
        policy.policyId,
        `policy ${policy.policyId} (status=${policy.status}) does not authorize real provider calls`
      );
    }
    if (policy.commercialUseStatus === "unknown" || policy.commercialUseStatus === "blocked") {
      throw new RenderProviderPolicyError(
        "unknown_commercial_use",
        policy.policyId,
        `policy ${policy.policyId} has unverified commercialUseStatus`
      );
    }
    if (policy.dataRetentionStatus === "unknown" || policy.dataRetentionStatus === "blocked") {
      throw new RenderProviderPolicyError(
        "unknown_data_retention",
        policy.policyId,
        `policy ${policy.policyId} has unverified dataRetentionStatus`
      );
    }
  }

  // The `policy.status === "blocked"` case is already handled above.
  // `context.bakeoffOnly` is informational for callers that want a
  // stricter gate; future statuses ("allowed_for_mock_only", etc.)
  // could re-narrow here without changing the public API.
  if (
    context.estimatedCostCents !== undefined &&
    context.estimatedCostCents > policy.maxEstimatedCostCentsPerCandidate
  ) {
    throw new RenderProviderPolicyError(
      "cost_exceeded",
      policy.policyId,
      `estimated cost ${context.estimatedCostCents}c exceeds policy cap ${policy.maxEstimatedCostCentsPerCandidate}c`
    );
  }
}
