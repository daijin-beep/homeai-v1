import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

/**
 * Skeleton schemas for Gallery Admission. Full lifecycle implementation lives
 * in ADS Batch 04 (Human Review Queue) and ADS Batch 07 (Room Gallery
 * Integration). Batch 01 only lays down the types so downstream code can
 * reference admission status without coupling.
 */
export const GalleryAdmissionStatusSchema = z.enum([
  "not_submitted",
  "pending_verification",
  "blocked_by_fail",
  "needs_human_review",
  "human_rejected",
  "admitted_pass",
  "admitted_human_approved"
]);

export const HumanReviewDecisionTypeSchema = z.enum([
  "approve_for_gallery",
  "reject",
  "request_regeneration"
]);

export const HumanReviewDecisionSchema = z
  .object({
    decisionId: IdSchema,
    candidateId: IdSchema,
    reviewerId: z.string().min(1),
    decision: HumanReviewDecisionTypeSchema,
    reasonCode: z.string().min(1),
    notes: z.string().optional(),
    createdAt: TimestampSchema
  })
  .strict();

export const RenderGalleryItemSchema = z
  .object({
    galleryItemId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    renderSpecId: IdSchema,
    candidateId: IdSchema,
    geometryHash: z.string().min(1),
    imageUrl: z.string().min(1),
    thumbnailUrl: z.string().min(1).optional(),
    verificationStatus: z.enum(["pass", "warning"]),
    admissionStatus: z.enum(["admitted_pass", "admitted_human_approved"]),
    providerTraceId: IdSchema,
    admittedAt: TimestampSchema
  })
  .strict();

export type GalleryAdmissionStatus = z.infer<typeof GalleryAdmissionStatusSchema>;
export type HumanReviewDecisionType = z.infer<typeof HumanReviewDecisionTypeSchema>;
export type HumanReviewDecision = z.infer<typeof HumanReviewDecisionSchema>;
export type RenderGalleryItem = z.infer<typeof RenderGalleryItemSchema>;
