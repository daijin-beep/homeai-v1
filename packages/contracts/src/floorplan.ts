import { z } from "zod";
import {
  ConfidenceSchema,
  IdSchema,
  MmUnitSchema,
  Point2DSchema,
  PolygonSchema,
  TimestampSchema,
  UnitSchema,
  VersionSchema,
  WarningSchema
} from "./common.js";

export const ScaleSourceSchema = z.enum(["provider_estimated", "user_confirmed", "unknown"]);

export const ScaleSchema = z
  .object({
    source: ScaleSourceSchema,
    mmPerPixel: z.number().positive().optional(),
    confidence: ConfidenceSchema
  })
  .strict();

export const ConfirmedScaleSchema = ScaleSchema.extend({
  source: z.literal("user_confirmed"),
  mmPerPixel: z.number().positive()
}).strict();

export const RoomTypeSchema = z.enum([
  "living",
  "dining",
  "living_dining",
  "bedroom",
  "master_bedroom",
  "children_room",
  "study",
  "kitchen",
  "bathroom",
  "entry",
  "balcony",
  "corridor",
  "storage",
  "unknown"
]);

export const CanonicalRoomSchema = z
  .object({
    id: IdSchema,
    type: RoomTypeSchema,
    label: z.string().min(1),
    polygon: PolygonSchema,
    areaMm2: z.number().positive(),
    confidence: ConfidenceSchema,
    userConfirmed: z.boolean()
  })
  .strict();

export const DraftRoomSchema = CanonicalRoomSchema.extend({
  userConfirmed: z.boolean().default(false)
}).strict();

export const WallKindSchema = z.enum(["structural", "partition", "unknown"]);

export const CanonicalWallSchema = z
  .object({
    id: IdSchema,
    kind: WallKindSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    thicknessMm: z.number().positive(),
    roomIds: z.array(IdSchema),
    confidence: ConfidenceSchema,
    userConfirmed: z.boolean()
  })
  .strict();

export const DraftWallSchema = CanonicalWallSchema.extend({
  userConfirmed: z.boolean().default(false)
}).strict();

export const OpeningTypeSchema = z.enum(["door", "window", "opening"]);

export const DoorSwingSchema = z.enum([
  "left_in",
  "left_out",
  "right_in",
  "right_out",
  "sliding",
  "unknown"
]);

export const CanonicalOpeningSchema = z
  .object({
    id: IdSchema,
    type: OpeningTypeSchema,
    wallId: IdSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    widthMm: z.number().positive(),
    sillHeightMm: z.number().nonnegative().optional(),
    heightMm: z.number().positive().optional(),
    swing: DoorSwingSchema.optional(),
    confidence: ConfidenceSchema,
    userConfirmed: z.boolean()
  })
  .strict();

export const DraftOpeningSchema = CanonicalOpeningSchema.extend({
  userConfirmed: z.boolean().default(false)
}).strict();

export const FloorplanVerifierSchema = z
  .object({
    spaceTruthScore: ConfidenceSchema,
    topologyValid: z.boolean(),
    scaleConfirmed: z.boolean(),
    blockingErrorCodes: z.array(z.string()),
    warningCodes: z.array(z.string())
  })
  .strict();

export const DraftFloorplanSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    parseJobId: IdSchema,
    unit: UnitSchema,
    scale: ScaleSchema,
    rooms: z.array(DraftRoomSchema).min(1),
    walls: z.array(DraftWallSchema),
    openings: z.array(DraftOpeningSchema),
    confidence: ConfidenceSchema,
    warnings: z.array(WarningSchema),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const CanonicalFloorplanSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    draftFloorplanId: IdSchema,
    version: VersionSchema,
    unit: MmUnitSchema,
    scale: ConfirmedScaleSchema,
    rooms: z.array(CanonicalRoomSchema).min(1),
    walls: z.array(CanonicalWallSchema),
    openings: z.array(CanonicalOpeningSchema),
    verifier: FloorplanVerifierSchema,
    confirmedByUser: z.literal(true),
    confirmedAt: TimestampSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type ScaleSource = z.infer<typeof ScaleSourceSchema>;
export type Scale = z.infer<typeof ScaleSchema>;
export type RoomType = z.infer<typeof RoomTypeSchema>;
export type CanonicalRoom = z.infer<typeof CanonicalRoomSchema>;
export type CanonicalWall = z.infer<typeof CanonicalWallSchema>;
export type CanonicalOpening = z.infer<typeof CanonicalOpeningSchema>;
export type DraftFloorplan = z.infer<typeof DraftFloorplanSchema>;
export type CanonicalFloorplan = z.infer<typeof CanonicalFloorplanSchema>;
