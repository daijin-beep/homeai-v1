import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

export const RenderProviderPolicyStatusSchema = z.enum([
  "blocked",
  "allowed_for_mock",
  "allowed_for_spike",
  "allowed_for_bakeoff",
  "allowed_for_production"
]);

export const CommercialUseStatusSchema = z.enum(["unknown", "allowed", "restricted", "blocked"]);
export const DataRetentionStatusSchema = z.enum(["unknown", "acceptable", "restricted", "blocked"]);
export const CopyrightRiskSchema = z.enum(["unknown", "low", "medium", "high"]);

export const RenderProviderPolicySchema = z
  .object({
    policyId: IdSchema,
    providerName: z.string().min(1),
    modelName: z.string().min(1),
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

export type RenderProviderPolicy = z.infer<typeof RenderProviderPolicySchema>;

/**
 * Snapshot stored on each ProviderTrace for cost / license forensics.
 * Captures the full policy at the time the provider was invoked. Treated as
 * immutable by all downstream consumers.
 */
export const RenderProviderPolicySnapshotSchema = RenderProviderPolicySchema;

export type RenderProviderPolicySnapshot = z.infer<typeof RenderProviderPolicySnapshotSchema>;
