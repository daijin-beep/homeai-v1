import { z } from "zod";
import {
  ConfidenceSchema,
  IdSchema,
  MmUnitSchema,
  Point2DSchema,
  PolygonSchema,
  TimestampSchema,
  VersionSchema
} from "./common.js";
import { OpeningTypeSchema, RoomTypeSchema } from "./floorplan.js";

export const CoordinateSystemSchema = z
  .object({
    origin: z.literal("floorplan_top_left"),
    xAxis: z.literal("right"),
    yAxis: z.literal("down"),
    zAxis: z.literal("up")
  })
  .strict();

export const SceneRoomSchema = z
  .object({
    id: IdSchema,
    canonicalRoomId: IdSchema,
    type: RoomTypeSchema,
    label: z.string().min(1),
    polygon: PolygonSchema,
    floorElevationMm: z.number(),
    ceilingHeightMm: z.number().positive()
  })
  .strict();

export const SceneWallSchema = z
  .object({
    id: IdSchema,
    canonicalWallId: IdSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    thicknessMm: z.number().positive(),
    heightMm: z.number().positive()
  })
  .strict();

export const SceneOpeningSchema = z
  .object({
    id: IdSchema,
    canonicalOpeningId: IdSchema,
    type: OpeningTypeSchema,
    wallId: IdSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    widthMm: z.number().positive(),
    heightMm: z.number().positive().optional()
  })
  .strict();

export const SceneConstraintsSchema = z
  .object({
    immutableGeometry: z.literal(true),
    noNewWindows: z.literal(true),
    noNewDoorsWithoutUserApproval: z.literal(true),
    noWallDeletionWithoutUserApproval: z.literal(true),
    renderingCannotMutateGeometry: z.literal(true)
  })
  .strict();

export const SceneValidationSchema = z
  .object({
    status: z.enum(["valid", "warning", "invalid"]),
    spaceTruthScore: ConfidenceSchema,
    warnings: z.array(z.string()),
    errors: z.array(z.string())
  })
  .strict();

export const SceneContractSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    floorplanId: IdSchema,
    version: VersionSchema,
    coordinateSystem: CoordinateSystemSchema,
    unit: MmUnitSchema,
    rooms: z.array(SceneRoomSchema).min(1),
    walls: z.array(SceneWallSchema),
    openings: z.array(SceneOpeningSchema),
    constraints: SceneConstraintsSchema,
    validation: SceneValidationSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type SceneContract = z.infer<typeof SceneContractSchema>;
export type SceneRoom = z.infer<typeof SceneRoomSchema>;
export type SceneWall = z.infer<typeof SceneWallSchema>;
export type SceneOpening = z.infer<typeof SceneOpeningSchema>;
