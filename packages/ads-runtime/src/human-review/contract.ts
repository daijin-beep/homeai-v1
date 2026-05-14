import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

/**
 * Package-local schemas for the operator-side human review queue.
 *
 * These are NOT canonical render contracts (per D-036 they live inside
 * @homeai/ads-runtime). The canonical RenderVerificationReport has its
 * own `humanReview` field of type HumanReviewRecommendationSchema — that
 * is the *verifier's recommendation*. The schemas below describe the
 * *operator workflow*: the queue item, the decision verb, and the
 * decision record persisted by the queue service.
 */

export const HumanReviewItemStatusSchema = z.enum(["pending", "decided", "expired"]);

export const HumanReviewDecisionVerbSchema = z.enum([
  "approve_for_gallery",
  "reject",
  "request_regenerate"
]);

export const HumanReviewItemSchema = z
  .object({
    reviewItemId: IdSchema,
    renderCandidateId: IdSchema,
    renderVerificationReportId: IdSchema,
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: z.string().min(1),
    requestedAt: TimestampSchema,
    status: HumanReviewItemStatusSchema,
    reason: z.string().min(1),
    expiresAt: TimestampSchema.optional()
  })
  .strict();

export const HumanReviewDecisionRecordSchema = z
  .object({
    decisionId: IdSchema,
    reviewItemId: IdSchema,
    reviewerId: z.string().min(1),
    decision: HumanReviewDecisionVerbSchema,
    reasonCode: z.string().min(1),
    notes: z.string().min(1).optional(),
    decidedAt: TimestampSchema,
    // Snapshot of the immutable identifiers at decision time; used for
    // audit (the renderJob / candidate / spec referenced by the queue
    // item must not have been re-issued under a new geometryHash since
    // the queue item was created).
    snapshot: z
      .object({
        renderCandidateId: IdSchema,
        renderVerificationReportId: IdSchema,
        geometryHash: z.string().min(1)
      })
      .strict()
  })
  .strict();

export type HumanReviewItemStatus = z.infer<typeof HumanReviewItemStatusSchema>;
export type HumanReviewDecisionVerb = z.infer<typeof HumanReviewDecisionVerbSchema>;
export type HumanReviewItem = z.infer<typeof HumanReviewItemSchema>;
export type HumanReviewDecisionRecord = z.infer<typeof HumanReviewDecisionRecordSchema>;
