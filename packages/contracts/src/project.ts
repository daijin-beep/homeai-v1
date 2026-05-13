import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";

export const ProjectStatusSchema = z.enum([
  "created",
  "floorplan_uploaded",
  "draft_floorplan_ready",
  "space_confirmed",
  "scene_ready",
  "design_brief_ready",
  "camera_plan_ready",
  "renders_ready",
  "soft_gps_ready"
]);

export const ProjectSchema = z
  .object({
    id: IdSchema,
    ownerId: IdSchema.optional(),
    name: z.string().min(1),
    status: ProjectStatusSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type Project = z.infer<typeof ProjectSchema>;
