import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";

export const FileAssetKindSchema = z.enum([
  "floorplan_image",
  "provider_raw_output",
  "render_image",
  "mock_render_image",
  "sku_image"
]);

export const MimeTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
  "application/json"
]);

export const FileAssetSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    kind: FileAssetKindSchema,
    mimeType: MimeTypeSchema,
    storageUrl: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    checksum: z.string().min(1),
    createdAt: TimestampSchema
  })
  .strict();

export type FileAssetKind = z.infer<typeof FileAssetKindSchema>;
export type MimeType = z.infer<typeof MimeTypeSchema>;
export type FileAsset = z.infer<typeof FileAssetSchema>;
