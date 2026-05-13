import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";
import { ProviderTraceSchema } from "@homeai/image-adapter";

export const RenderCandidateStatusSchema = z.enum([
  "created",
  "verification_pending",
  "verification_pass",
  "verification_warning",
  "verification_fail",
  "gallery_admitted",
  "gallery_blocked",
  "human_review_required"
]);

export const RenderCandidateSchema = z
  .object({
    candidateId: IdSchema,
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: z.string().min(1),
    status: RenderCandidateStatusSchema,
    imageUrl: z.string().min(1),
    thumbnailUrl: z.string().min(1).optional(),
    providerTrace: ProviderTraceSchema,
    createdAt: TimestampSchema
  })
  .strict();

export type RenderCandidateStatus = z.infer<typeof RenderCandidateStatusSchema>;
export type RenderCandidate = z.infer<typeof RenderCandidateSchema>;
