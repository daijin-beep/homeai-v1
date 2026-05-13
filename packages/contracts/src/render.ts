import { z } from "zod";
import { IdSchema, TimestampSchema, VersionSchema } from "./common.js";
import { MimeTypeSchema } from "./file-asset.js";
import { ViewTypeSchema } from "./camera-plan.js";

export const RenderConstraintSchema = z
  .object({
    preserveWalls: z.literal(true),
    preserveWindows: z.literal(true),
    preserveDoors: z.literal(true),
    noNewOpenings: z.literal(true),
    noRoomShapeChange: z.literal(true),
    noFunctionChange: z.literal(true)
  })
  .strict();

export const RenderImageOutputSchema = z
  .object({
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    mimeType: z.enum(["image/png", "image/svg+xml"])
  })
  .strict();

export const RenderImageSpecSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    schemeId: IdSchema,
    sceneContractId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    styleProfileId: IdSchema,
    viewType: ViewTypeSchema,
    constraints: RenderConstraintSchema,
    designIntent: z.string().min(1),
    output: RenderImageOutputSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const RenderBatchStatusSchema = z.enum([
  "queued",
  "running",
  "partially_succeeded",
  "succeeded",
  "failed",
  "cancelled"
]);

export const RenderBatchSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    schemeId: IdSchema,
    sceneContractId: IdSchema,
    status: RenderBatchStatusSchema,
    renderSpecIds: z.array(IdSchema).min(1),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    version: VersionSchema
  })
  .strict();

export const RenderVerificationStatusSchema = z.enum([
  "verified",
  "warning",
  "rejected",
  "manual_review_needed"
]);

export const RenderImageAssetSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    sceneContractId: IdSchema,
    renderSpecId: IdSchema,
    renderBatchId: IdSchema,
    asset: z
      .object({
        fileAssetId: IdSchema,
        storageUrl: z.string().min(1),
        mimeType: MimeTypeSchema,
        widthPx: z.number().int().positive(),
        heightPx: z.number().int().positive(),
        checksum: z.string().min(1)
      })
      .strict(),
    generation: z
      .object({
        provider: z.enum(["mock_render", "render_provider"]),
        status: z.enum(["succeeded", "failed"]),
        promptHash: z.string().min(1).optional(),
        providerTraceId: z.string().min(1).optional()
      })
      .strict(),
    verification: z
      .object({
        spaceConsistencyStatus: RenderVerificationStatusSchema,
        styleConsistencyStatus: RenderVerificationStatusSchema,
        overallStatus: RenderVerificationStatusSchema,
        warnings: z.array(z.string()),
        rejectionReasons: z.array(z.string())
      })
      .strict(),
    createdAt: TimestampSchema
  })
  .strict();

export type RenderImageSpec = z.infer<typeof RenderImageSpecSchema>;
export type RenderBatch = z.infer<typeof RenderBatchSchema>;
export type RenderImageAsset = z.infer<typeof RenderImageAssetSchema>;
export type RenderVerificationStatus = z.infer<typeof RenderVerificationStatusSchema>;
