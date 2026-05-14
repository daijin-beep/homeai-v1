import { RenderProviderPolicyError } from "../errors/index.js";
import type { RenderProviderPolicy } from "../contracts/render-provider-policy.js";

export interface ProviderGateContext {
  forRealProvider: boolean;
  estimatedCostCents?: number;
}

/**
 * Default-deny policy gate. Skeleton for VAL-ADS-03 / ADS-06; Batch 01 only
 * enforces the obvious cases so MockImageAdapter never blocks itself.
 * Real provider call paths must call this before .generate().
 */
export function assertProviderAllowedForJob(
  policy: RenderProviderPolicy,
  context: ProviderGateContext = { forRealProvider: false }
): void {
  if (policy.status === "blocked") {
    throw new RenderProviderPolicyError(
      "blocked",
      policy.policyId,
      `Provider policy ${policy.policyId} is blocked`
    );
  }
  if (context.forRealProvider) {
    if (policy.status === "allowed_for_mock") {
      throw new RenderProviderPolicyError(
        "blocked",
        policy.policyId,
        `Policy ${policy.policyId} is mock-only; real provider call rejected`
      );
    }
    if (policy.commercialUseStatus === "unknown" || policy.commercialUseStatus === "blocked") {
      throw new RenderProviderPolicyError(
        "unknown_commercial_use",
        policy.policyId,
        `Policy ${policy.policyId} has unverified commercialUseStatus`
      );
    }
    if (policy.dataRetentionStatus === "unknown" || policy.dataRetentionStatus === "blocked") {
      throw new RenderProviderPolicyError(
        "unknown_data_retention",
        policy.policyId,
        `Policy ${policy.policyId} has unverified dataRetentionStatus`
      );
    }
  }
  if (
    context.estimatedCostCents !== undefined &&
    context.estimatedCostCents > policy.maxEstimatedCostCentsPerCandidate
  ) {
    throw new RenderProviderPolicyError(
      "cost_exceeded",
      policy.policyId,
      `Estimated cost ${context.estimatedCostCents}¢ exceeds policy cap ${policy.maxEstimatedCostCentsPerCandidate}¢`
    );
  }
}
