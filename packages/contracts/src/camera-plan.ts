import { z } from "zod";
import { IdSchema, Point3DSchema, TimestampSchema, VersionSchema } from "./common.js";

export const ViewTypeSchema = z.enum(["overview", "primary_wall", "secondary_wall", "detail"]);

export const RoomCameraSchema = z
  .object({
    id: IdSchema,
    roomId: IdSchema,
    viewType: ViewTypeSchema,
    position: Point3DSchema,
    target: Point3DSchema,
    fovDegrees: z.number().min(20).max(120),
    lensMm: z.number().positive(),
    valid: z.boolean(),
    validationWarnings: z.array(z.string())
  })
  .strict();

export const RoomCameraPlanSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    sceneContractId: IdSchema,
    roomId: IdSchema,
    version: VersionSchema,
    minImageCount: z.number().int().positive(),
    cameras: z.array(RoomCameraSchema).min(1),
    validation: z
      .object({
        status: z.enum(["valid", "warning", "failed"]),
        errors: z.array(z.string()),
        warnings: z.array(z.string())
      })
      .strict(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type ViewType = z.infer<typeof ViewTypeSchema>;
export type RoomCamera = z.infer<typeof RoomCameraSchema>;
export type RoomCameraPlan = z.infer<typeof RoomCameraPlanSchema>;
