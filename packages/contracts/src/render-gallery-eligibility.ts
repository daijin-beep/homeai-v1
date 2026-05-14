import { z } from "zod";
import { IdSchema } from "./common.js";

export const GalleryEligibilityStatusSchema = z.enum([
  "eligible",
  "blocked_pending_verification",
  "blocked_failed_verification",
  "blocked_geometry_mismatch",
  "blocked_missing_asset",
  "human_review_required"
]);

export const GalleryEligibilityDecisionSchema = z
  .object({
    renderCandidateId: IdSchema,
    renderVerificationReportId: IdSchema.optional(),
    status: GalleryEligibilityStatusSchema,
    reasons: z.array(z.string().min(1))
  })
  .strict();

export type GalleryEligibilityStatus = z.infer<typeof GalleryEligibilityStatusSchema>;
export type GalleryEligibilityDecision = z.infer<typeof GalleryEligibilityDecisionSchema>;
