import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

import { DeterministicCheckSchema } from "./deterministic-check.js";

export const RenderVerificationStatusSchema = z.enum(["pass", "warning", "fail", "unsupported"]);

export const VlmChecklistResultSchema = z
  .object({
    questionId: z.string().min(1),
    answer: z.enum(["yes", "no", "unknown"]),
    confidence: z.number().min(0).max(1).optional()
  })
  .strict();

export const RetryRecommendationSchema = z
  .object({
    recommended: z.boolean(),
    reasonCode: z.string().min(1),
    notes: z.string().optional()
  })
  .strict();

export const RenderVerificationReportSchema = z
  .object({
    reportId: IdSchema,
    candidateId: IdSchema,
    renderSpecId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: z.string().min(1),
    status: RenderVerificationStatusSchema,
    l1Checks: z.array(DeterministicCheckSchema),
    l2Checks: z.array(VlmChecklistResultSchema).optional(),
    retryRecommendation: RetryRecommendationSchema.optional(),
    createdAt: TimestampSchema
  })
  .strict();

export type RenderVerificationReport = z.infer<typeof RenderVerificationReportSchema>;
export type VlmChecklistResult = z.infer<typeof VlmChecklistResultSchema>;
export type RetryRecommendation = z.infer<typeof RetryRecommendationSchema>;
