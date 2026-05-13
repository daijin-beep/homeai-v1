import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

export const RenderJobStatusSchema = z.enum([
  "queued",
  "running",
  "provider_pending",
  "candidate_generated",
  "verification_pending",
  "verified",
  "failed",
  "blocked",
  "needs_human_review",
  "cancelled"
]);

export const RenderJobErrorCodeSchema = z.enum([
  "spec_invalid",
  "policy_denied",
  "timeout",
  "malformed",
  "storage_failed",
  "safety_blocked",
  "illegal_transition",
  "unknown"
]);

export const RenderJobErrorSchema = z
  .object({
    code: RenderJobErrorCodeSchema,
    message: z.string().min(1),
    stage: z.string().min(1).optional(),
    occurredAt: TimestampSchema
  })
  .strict();

export const RenderJobSchema = z
  .object({
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: z.string().min(1),
    status: RenderJobStatusSchema,
    providerPolicyId: IdSchema,
    attempt: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    startedAt: TimestampSchema.optional(),
    providerCompletedAt: TimestampSchema.optional(),
    candidateGeneratedAt: TimestampSchema.optional(),
    completedAt: TimestampSchema.optional(),
    error: RenderJobErrorSchema.optional()
  })
  .strict();

export type RenderJobStatus = z.infer<typeof RenderJobStatusSchema>;
export type RenderJobErrorCode = z.infer<typeof RenderJobErrorCodeSchema>;
export type RenderJobError = z.infer<typeof RenderJobErrorSchema>;
export type RenderJob = z.infer<typeof RenderJobSchema>;
