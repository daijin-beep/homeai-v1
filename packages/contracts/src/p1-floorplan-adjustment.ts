import { z } from "zod";
import { IdSchema, MmUnitSchema, Point2DSchema, TimestampSchema, VersionSchema } from "./common.js";

export const GeometryHashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/, "geometryHash must be a sha256 digest");

export const FloorplanDraftRevisionSourceSchema = z.enum([
  "ai_parse",
  "manual_tracing",
  "reentry_edit",
  "fixture"
]);

export const DraftElementSourceSchema = z.enum([
  "ai_parse",
  "user_created",
  "user_modified",
  "fixture"
]);

export const DraftRoomSourceSchema = z.enum([
  "ai_parse",
  "user_labeled",
  "boundary_recomputed",
  "fixture"
]);

export const DraftWallKindSchema = z.enum(["interior", "exterior", "unknown"]);

export const P1RoomTypeSchema = z.enum([
  "bedroom",
  "primary_bedroom",
  "secondary_bedroom",
  "kids_room",
  "living_room",
  "dining_room",
  "kitchen",
  "bathroom",
  "balcony",
  "study",
  "storage",
  "entry",
  "corridor",
  "cloakroom",
  "living_dining"
]);

const NonBalconyRoomTypeSchema = z.enum([
  "bedroom",
  "primary_bedroom",
  "secondary_bedroom",
  "kids_room",
  "living_room",
  "dining_room",
  "kitchen",
  "bathroom",
  "study",
  "storage",
  "entry",
  "corridor",
  "cloakroom",
  "living_dining"
]);

export const PolylineSegmentSchema = z
  .object({
    start: Point2DSchema,
    end: Point2DSchema
  })
  .strict();

export const CurveApproximationMetaSchema = z
  .object({
    uiKind: z.literal("arc"),
    originalControlPoints: z.array(Point2DSchema).min(3),
    maxChordErrorMm: z.number().nonnegative()
  })
  .strict();

export const P1DraftWallSegmentSchema = z
  .object({
    wallId: IdSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    thicknessMm: z.number().positive(),
    kind: DraftWallKindSchema,
    source: DraftElementSourceSchema,
    curveApproximation: CurveApproximationMetaSchema.optional()
  })
  .strict();

const DoorSwingSchema = z.enum(["left_in", "right_in", "left_out", "right_out"]);

export const P1DraftDoorOpeningSchema = z
  .object({
    openingId: IdSchema,
    type: z.literal("door"),
    wallId: IdSchema,
    positionOnWall: z.number().min(0).max(1),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    swing: DoorSwingSchema,
    source: DraftElementSourceSchema
  })
  .strict();

const DraftWindowOpeningBaseSchema = z
  .object({
    openingId: IdSchema,
    type: z.literal("window"),
    wallId: IdSchema,
    positionOnWall: z.number().min(0).max(1),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    sillHeightMm: z.number().nonnegative().optional(),
    source: DraftElementSourceSchema
  })
  .strict();

const DraftStandardWindowOpeningSchema = DraftWindowOpeningBaseSchema.extend({
  windowKind: z.literal("standard")
}).strict();

const DraftFloorToCeilingWindowOpeningSchema = DraftWindowOpeningBaseSchema.extend({
  windowKind: z.literal("floor_to_ceiling")
}).strict();

const DraftBayWindowOpeningSchema = DraftWindowOpeningBaseSchema.extend({
  windowKind: z.literal("bay"),
  projectionDepthMm: z.number().positive(),
  projectionSide: z.literal("exterior")
}).strict();

export const P1DraftWindowOpeningSchema = z.union([
  DraftStandardWindowOpeningSchema,
  DraftBayWindowOpeningSchema,
  DraftFloorToCeilingWindowOpeningSchema
]);

export const P1DraftOpeningSchema = z.union([
  P1DraftDoorOpeningSchema,
  P1DraftWindowOpeningSchema
]);

export const BalconyMetaSchema = z
  .object({
    enclosureType: z.enum(["open", "closed"]),
    isExteriorAttached: z.literal(true),
    adjacentInteriorRoomIds: z.array(IdSchema).min(1),
    connectionWallIds: z.array(IdSchema).min(1),
    exteriorEdgeIds: z.array(IdSchema).min(1)
  })
  .strict();

const DraftRoomBaseSchema = z
  .object({
    roomId: IdSchema,
    polygon: z.array(Point2DSchema).min(4),
    labelPosition: Point2DSchema.optional(),
    source: DraftRoomSourceSchema
  })
  .strict();

const NonBalconyDraftRoomSchema = DraftRoomBaseSchema.extend({
  roomType: NonBalconyRoomTypeSchema
}).strict();

const BalconyDraftRoomSchema = DraftRoomBaseSchema.extend({
  roomType: z.literal("balcony"),
  balconyMeta: BalconyMetaSchema
}).strict();

export const P1DraftRoomSchema = z.union([BalconyDraftRoomSchema, NonBalconyDraftRoomSchema]);

export const DraftScaleStateSchema = z
  .object({
    source: z.enum(["ai_parse", "manual_tracing", "user_confirmed", "fixture", "unknown"]),
    mmPerPixel: z.number().positive().optional(),
    confirmed: z.boolean()
  })
  .strict()
  .superRefine((scale, ctx) => {
    if (scale.confirmed && scale.mmPerPixel === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "confirmed scale requires mmPerPixel",
        path: ["mmPerPixel"]
      });
    }
  });

export const DraftGlobalParamsSchema = z
  .object({
    unit: MmUnitSchema,
    displayUnit: z.enum(["mm", "cm"]),
    scale: DraftScaleStateSchema,
    floorHeightMm: z.number().positive().optional(),
    gridSizeMm: z.number().positive().optional(),
    snapToleranceMm: z.number().nonnegative(),
    wallJoinToleranceMm: z.number().nonnegative(),
    openingSnapToleranceMm: z.number().nonnegative()
  })
  .strict();

export const FloorplanEditOperationSchema = z
  .object({
    operationId: IdSchema,
    operationType: z.enum([
      "create_wall",
      "modify_wall",
      "delete_wall",
      "create_opening",
      "modify_opening",
      "delete_opening",
      "create_room",
      "modify_room",
      "delete_room",
      "update_global_params",
      "validate_draft",
      "wall.add",
      "wall.delete",
      "wall.resize",
      "wall.moveEndpoint",
      "door.add",
      "door.delete",
      "door.direction.change",
      "window.add",
      "window.delete",
      "window.type.change",
      "balcony.add",
      "balcony.delete",
      "balcony.type.change",
      "room.type.change",
      "wall.thickness.change",
      "freeWall.draw",
      "floorHeight.change",
      "door.dimension.change"
    ]),
    targetType: z.enum(["draft", "wall", "opening", "room", "global_params"]),
    targetId: IdSchema.optional(),
    actor: z.enum(["user", "system"]),
    reason: z.string().min(1).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    createdAt: TimestampSchema
  })
  .strict();

export const DraftValidationIssueSchema = z
  .object({
    issueId: IdSchema,
    severity: z.enum(["info", "warning", "error", "blocking"]),
    code: z.string().min(1),
    message: z.string().min(1),
    targetType: z.enum(["draft", "wall", "opening", "room", "global_params"]),
    targetId: IdSchema.optional(),
    blocksConfirmation: z.boolean()
  })
  .strict();

export const DraftValidationStateSchema = z
  .object({
    status: z.enum(["valid", "warning", "invalid"]),
    topologyValid: z.boolean(),
    scaleValid: z.boolean(),
    canConfirm: z.boolean(),
    issues: z.array(DraftValidationIssueSchema),
    validatedAt: TimestampSchema
  })
  .strict();

export const FloorplanDraftRevisionSchema = z
  .object({
    draftRevisionId: IdSchema,
    homeId: IdSchema,
    sourceAssetId: IdSchema.optional(),
    baseCanonicalRevisionId: IdSchema.optional(),
    source: FloorplanDraftRevisionSourceSchema,
    unit: MmUnitSchema,
    walls: z.array(P1DraftWallSegmentSchema).min(1),
    openings: z.array(P1DraftOpeningSchema),
    rooms: z.array(P1DraftRoomSchema).min(1),
    globalParams: DraftGlobalParamsSchema,
    operationLog: z.array(FloorplanEditOperationSchema),
    validation: DraftValidationStateSchema.optional(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

const P1CanonicalWallSegmentSchema = P1DraftWallSegmentSchema.omit({
  source: true,
  curveApproximation: true
}).strict();

const P1CanonicalDoorOpeningSchema = P1DraftDoorOpeningSchema.omit({
  source: true
}).strict();

const P1CanonicalStandardWindowOpeningSchema = DraftStandardWindowOpeningSchema.omit({
  source: true
}).strict();

const P1CanonicalFloorToCeilingWindowOpeningSchema = DraftFloorToCeilingWindowOpeningSchema.omit({
  source: true
}).strict();

const P1CanonicalBayWindowOpeningSchema = DraftBayWindowOpeningSchema.omit({
  source: true
}).strict();

const P1CanonicalWindowOpeningSchema = z.union([
  P1CanonicalStandardWindowOpeningSchema,
  P1CanonicalBayWindowOpeningSchema,
  P1CanonicalFloorToCeilingWindowOpeningSchema
]);

const P1CanonicalOpeningSchema = z.union([
  P1CanonicalDoorOpeningSchema,
  P1CanonicalWindowOpeningSchema
]);

const P1CanonicalNonBalconyRoomSchema = NonBalconyDraftRoomSchema.omit({
  source: true
}).strict();

const P1CanonicalBalconyRoomSchema = BalconyDraftRoomSchema.omit({
  source: true
}).strict();

const P1CanonicalRoomSchema = z.union([
  P1CanonicalBalconyRoomSchema,
  P1CanonicalNonBalconyRoomSchema
]);

const ConfirmedScaleStateSchema = DraftScaleStateSchema.safeExtend({
  source: z.literal("user_confirmed"),
  mmPerPixel: z.number().positive(),
  confirmed: z.literal(true)
}).strict();

const CanonicalGlobalParamsSchema = DraftGlobalParamsSchema.extend({
  scale: ConfirmedScaleStateSchema
}).strict();

const CanonicalValidationStateSchema = DraftValidationStateSchema.extend({
  status: z.literal("valid"),
  topologyValid: z.literal(true),
  scaleValid: z.literal(true),
  canConfirm: z.literal(true)
}).strict();

export const CanonicalFloorplanRevisionSchema = z
  .object({
    canonicalRevisionId: IdSchema,
    homeId: IdSchema,
    draftRevisionId: IdSchema,
    baseCanonicalRevisionId: IdSchema.optional(),
    version: VersionSchema,
    unit: MmUnitSchema,
    geometryHash: GeometryHashSchema,
    walls: z.array(P1CanonicalWallSegmentSchema).min(1),
    openings: z.array(P1CanonicalOpeningSchema),
    rooms: z.array(P1CanonicalRoomSchema).min(1),
    globalParams: CanonicalGlobalParamsSchema,
    validation: CanonicalValidationStateSchema,
    confirmedByUser: z.literal(true),
    confirmedAt: TimestampSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const GeometryDependentArtifactSchema = z
  .object({
    artifactId: IdSchema,
    artifactType: z.enum([
      "scene_contract",
      "white_model",
      "camera_plan",
      "affordance_graph",
      "anchor_plan",
      "render_spec",
      "render_asset",
      "soft_decor_plan"
    ]),
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    upstreamArtifactIds: z.array(IdSchema).optional(),
    createdAt: TimestampSchema
  })
  .strict();

export const P1SceneOpeningSchema = z
  .object({
    openingId: IdSchema,
    type: z.enum(["door", "window"]),
    wallId: IdSchema,
    positionOnWall: z.number().min(0).max(1),
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    sillHeightMm: z.number().nonnegative().optional(),
    swing: z.enum(["left_in", "right_in", "left_out", "right_out"]).optional(),
    windowKind: z.enum(["standard", "bay", "floor_to_ceiling"]).optional(),
    projectionDepthMm: z.number().positive().optional(),
    projectionSide: z.literal("exterior").optional()
  })
  .strict();

export const P1SceneRoomSchema = z
  .object({
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    polygon: z.array(Point2DSchema).min(4),
    balconyMeta: BalconyMetaSchema.optional()
  })
  .strict();

export const P1SceneWallSegmentSchema = z
  .object({
    wallId: IdSchema,
    start: Point2DSchema,
    end: Point2DSchema,
    thicknessMm: z.number().positive(),
    kind: DraftWallKindSchema
  })
  .strict();

export const P1SceneContractV02Schema = z
  .object({
    sceneContractId: IdSchema,
    version: z.literal("0.2"),
    readonly: z.literal(true),
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    unit: MmUnitSchema,
    rooms: z.array(P1SceneRoomSchema).min(1),
    walls: z.array(P1SceneWallSegmentSchema).min(1),
    openings: z.array(P1SceneOpeningSchema),
    validation: z
      .object({
        status: z.enum(["valid", "warning", "invalid"]),
        errors: z.array(z.string()),
        warnings: z.array(z.string())
      })
      .strict(),
    createdAt: TimestampSchema
  })
  .strict();

export const P1WhiteModelSchema = z
  .object({
    whiteModelId: IdSchema,
    sceneContractId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    readonly: z.literal(true),
    unit: MmUnitSchema,
    rooms: z.array(
      z
        .object({
          roomId: IdSchema,
          roomType: P1RoomTypeSchema,
          floorPolygon: z.array(Point2DSchema).min(4),
          floorElevationMm: z.number(),
          ceilingHeightMm: z.number().positive()
        })
        .strict()
    ),
    walls: z.array(
      z
        .object({
          wallId: IdSchema,
          start: Point2DSchema,
          end: Point2DSchema,
          thicknessMm: z.number().positive(),
          heightMm: z.number().positive()
        })
        .strict()
    )
  })
  .strict();

export const P1RoomCameraPlanBatchSchema = z
  .object({
    cameraPlanBatchId: IdSchema,
    sceneContractId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    unit: MmUnitSchema,
    roomPlans: z.array(
      z
        .object({
          roomId: IdSchema,
          cameras: z.array(
            z
              .object({
                cameraId: IdSchema,
                position: Point2DSchema,
                target: Point2DSchema,
                heightMm: z.number().positive(),
                fovDegrees: z.number().min(20).max(120),
                valid: z.literal(true)
              })
              .strict()
          ).min(1)
        })
        .strict()
    )
  })
  .strict();

export const P1RoomAffordanceGraphSchema = z
  .object({
    affordanceGraphId: IdSchema,
    sceneContractId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    rooms: z.array(
      z
        .object({
          roomId: IdSchema,
          roomType: P1RoomTypeSchema,
          usableAreaMm2: z.number().nonnegative(),
          blockedOpeningIds: z.array(IdSchema),
          candidateAnchorIds: z.array(IdSchema)
        })
        .strict()
    )
  })
  .strict();

export const P1AnchorPlanSchema = z
  .object({
    anchorPlanId: IdSchema,
    affordanceGraphId: IdSchema,
    sceneContractId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    anchors: z.array(
      z
        .object({
          anchorId: IdSchema,
          roomId: IdSchema,
          type: z.enum(["wall", "window", "room_center", "corner", "opening_adjacent"]),
          targetId: IdSchema.optional(),
          position: Point2DSchema,
          blocksDoorOrWindow: z.literal(false)
        })
        .strict()
    )
  })
  .strict();

export type GeometryHash = z.infer<typeof GeometryHashSchema>;
export type FloorplanDraftRevisionSource = z.infer<typeof FloorplanDraftRevisionSourceSchema>;
export type DraftElementSource = z.infer<typeof DraftElementSourceSchema>;
export type DraftRoomSource = z.infer<typeof DraftRoomSourceSchema>;
export type DraftWallKind = z.infer<typeof DraftWallKindSchema>;
export type P1RoomType = z.infer<typeof P1RoomTypeSchema>;
export type PolylineSegment = z.infer<typeof PolylineSegmentSchema>;
export type DraftWallSegment = z.infer<typeof P1DraftWallSegmentSchema>;
export type DraftDoorOpening = z.infer<typeof P1DraftDoorOpeningSchema>;
export type DraftWindowOpening = z.infer<typeof P1DraftWindowOpeningSchema>;
export type DraftOpening = z.infer<typeof P1DraftOpeningSchema>;
export type BalconyMeta = z.infer<typeof BalconyMetaSchema>;
export type DraftRoom = z.infer<typeof P1DraftRoomSchema>;
export type DraftGlobalParams = z.infer<typeof DraftGlobalParamsSchema>;
export type FloorplanEditOperation = z.infer<typeof FloorplanEditOperationSchema>;
export type DraftValidationIssue = z.infer<typeof DraftValidationIssueSchema>;
export type DraftValidationState = z.infer<typeof DraftValidationStateSchema>;
export type FloorplanDraftRevision = z.infer<typeof FloorplanDraftRevisionSchema>;
export type CanonicalFloorplanRevision = z.infer<typeof CanonicalFloorplanRevisionSchema>;
export type GeometryDependentArtifact = z.infer<typeof GeometryDependentArtifactSchema>;
export type P1SceneOpening = z.infer<typeof P1SceneOpeningSchema>;
export type P1SceneRoom = z.infer<typeof P1SceneRoomSchema>;
export type P1SceneWallSegment = z.infer<typeof P1SceneWallSegmentSchema>;
export type P1SceneContractV02 = z.infer<typeof P1SceneContractV02Schema>;
export type P1WhiteModel = z.infer<typeof P1WhiteModelSchema>;
export type P1RoomCameraPlanBatch = z.infer<typeof P1RoomCameraPlanBatchSchema>;
export type P1RoomAffordanceGraph = z.infer<typeof P1RoomAffordanceGraphSchema>;
export type P1AnchorPlan = z.infer<typeof P1AnchorPlanSchema>;
