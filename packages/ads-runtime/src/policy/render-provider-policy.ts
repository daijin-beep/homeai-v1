import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

/**
 * Package-local provider policy — runtime configuration that decides
 * which mock/stub/real adapter the orchestrator is allowed to invoke.
 *
 * This is NOT a cross-module canonical schema (D-036 §6.2). It lives in
 * @homeai/ads-runtime because:
 *   - Track A producer side (CreativeRenderSpec compiler) does not need it.
 *   - Track A renders are deterministic builders — no provider gating.
 *   - Only ADS runtime needs to decide "may we run this provider?".
 *
 * The Status enum reflects ADS gating posture, not lifecycle status.
 */
export const RenderProviderPolicyStatusSchema = z.enum([
  "blocked",
  "allowed_for_mock",
  "allowed_for_bakeoff",
  "allowed_for_spike",
  "allowed_for_production"
]);

export const CommercialUseStatusSchema = z.enum(["unknown", "allowed", "restricted", "blocked"]);
export const DataRetentionStatusSchema = z.enum(["unknown", "acceptable", "restricted", "blocked"]);
export const CopyrightRiskSchema = z.enum(["unknown", "low", "medium", "high"]);

export const RenderProviderPolicySchema = z
  .object({
    policyId: IdSchema,
    providerName: z.string().min(1),
    modelId: z.string().min(1),
    status: RenderProviderPolicyStatusSchema,
    maxCandidatesPerRoom: z.number().int().positive(),
    maxAttemptsPerJob: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    maxEstimatedCostCentsPerCandidate: z.number().int().nonnegative(),
    commercialUseStatus: CommercialUseStatusSchema,
    dataRetentionStatus: DataRetentionStatusSchema,
    copyrightRisk: CopyrightRiskSchema,
    requiresHumanReview: z.boolean(),
    approvedBy: z.string().min(1).optional(),
    approvedAt: TimestampSchema.optional()
  })
  .strict();

export type RenderProviderPolicyStatus = z.infer<typeof RenderProviderPolicyStatusSchema>;
export type RenderProviderPolicy = z.infer<typeof RenderProviderPolicySchema>;
