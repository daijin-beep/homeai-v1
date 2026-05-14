import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { GalleryEligibilityStatusSchema } from "./render-gallery-eligibility.js";
import { RenderTraceSchema } from "./render-job.js";

export const RenderCandidateStatusSchema = z.enum([
  "generated",
  "verification_pending",
  "verified_pass",
  "verified_warning",
  "verified_fail",
  "human_review_required",
  "rejected"
]);

export const RenderCandidateSchema = z
  .object({
    renderCandidateId: IdSchema,
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: GeometryHashSchema,
    provider: z
      .object({
        providerId: IdSchema,
        providerKind: z.enum(["mock", "external_adapter_placeholder"]),
        modelId: z.string().min(1).optional(),
        adapterVersion: z.string().min(1).optional()
      })
      .strict(),
    output: z
      .object({
        imageUrl: z.string().min(1).optional(),
        thumbnailUrl: z.string().min(1).optional(),
        artifactHash: z.string().min(1).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional()
      })
      .strict(),
    status: RenderCandidateStatusSchema,
    verificationReportId: IdSchema.optional(),
    galleryEligibility: GalleryEligibilityStatusSchema,
    trace: RenderTraceSchema,
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((candidate, ctx) => {
    if (candidate.trace.inputHashes.geometryHash !== candidate.geometryHash) {
      ctx.addIssue({ code: "custom", message: "trace geometryHash must match render candidate", path: ["trace"] });
    }
  });

export type RenderCandidateStatus = z.infer<typeof RenderCandidateStatusSchema>;
export type RenderCandidate = z.infer<typeof RenderCandidateSchema>;
