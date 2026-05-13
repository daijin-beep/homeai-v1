import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { AppErrorSchema } from "./errors.js";

export const FloorplanProviderSchema = z.enum([
  "mock_floorplan",
  "vision_floorplan",
  "hybrid_floorplan"
]);

export const ParseJobStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

export const ParseJobSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    fileAssetId: IdSchema,
    provider: FloorplanProviderSchema,
    status: ParseJobStatusSchema,
    progress: z.number().min(0).max(100),
    rawOutputAssetId: IdSchema.optional(),
    draftFloorplanId: IdSchema.optional(),
    error: AppErrorSchema.optional(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type FloorplanProvider = z.infer<typeof FloorplanProviderSchema>;
export type ParseJobStatus = z.infer<typeof ParseJobStatusSchema>;
export type ParseJob = z.infer<typeof ParseJobSchema>;
