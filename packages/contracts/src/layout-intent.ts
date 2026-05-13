import { z } from "zod";
import { IdSchema, MmUnitSchema, Point2DSchema, TimestampSchema } from "./common.js";
import {
  GeometryHashSchema,
  P1RoomAffordanceGraphSchema,
  P1SceneContractV02Schema
} from "./p1-floorplan-adjustment.js";

export const LayoutIntentHashSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/, "layoutIntentHash must be a sha256 digest");

export const LayoutIntentSourceSchema = z.enum([
  "p1_advanced",
  "p3_editor",
  "system_default",
  "fixture"
]);

export const FurnitureCategorySchema = z.enum([
  "bed",
  "sofa",
  "dining_table",
  "dining_chair",
  "wardrobe",
  "desk",
  "tv_console",
  "coffee_table",
  "side_table",
  "bookshelf",
  "shoe_cabinet",
  "storage_cabinet",
  "washing_machine",
  "dryer",
  "fridge",
  "custom"
]);

export const FurniturePlaceholderSourceSchema = z.enum([
  "user_placed",
  "p3_modified",
  "system_default",
  "fixture"
]);

export const FurniturePlaceholderSchema = z
  .object({
    placeholderId: IdSchema,
    roomId: IdSchema,
    category: FurnitureCategorySchema,
    center: Point2DSchema,
    rotationDeg: z.number().finite(),
    displaySizeMm: z
      .object({
        width: z.number().positive(),
        depth: z.number().positive()
      })
      .strict(),
    sizeSource: z.enum(["category_default", "user_adjusted_display_only"]),
    userResizable: z.boolean(),
    source: FurniturePlaceholderSourceSchema,
    label: z.string().min(1).optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional()
  })
  .strict();

export const LayoutIntentValidationIssueSchema = z
  .object({
    issueId: IdSchema,
    severity: z.enum(["info", "warning", "error"]),
    code: z.string().min(1),
    message: z.string().min(1),
    placeholderId: IdSchema.optional(),
    roomId: IdSchema.optional(),
    blocksConfirmation: z.boolean()
  })
  .strict();

export const LayoutIntentValidationStateSchema = z
  .object({
    status: z.enum(["valid", "warning", "invalid"]),
    canConfirm: z.boolean(),
    issues: z.array(LayoutIntentValidationIssueSchema),
    validatedAt: TimestampSchema
  })
  .strict()
  .superRefine((validation, ctx) => {
    const hasBlockingError = validation.issues.some((issue) => issue.severity === "error" && issue.blocksConfirmation);
    if (validation.canConfirm && hasBlockingError) {
      ctx.addIssue({
        code: "custom",
        message: "layout intent cannot confirm while blocking errors exist",
        path: ["canConfirm"]
      });
    }
  });

export const LayoutIntentHashInputSchema = z
  .object({
    aiAutofillEnabled: z.boolean(),
    placeholders: z.array(FurniturePlaceholderSchema)
  })
  .strict();

export const LayoutIntentOperationSchema = z
  .object({
    operationId: IdSchema,
    operationType: z.enum([
      "layout.placeholder.add",
      "layout.placeholder.delete",
      "layout.placeholder.move",
      "layout.placeholder.rotate",
      "layout.placeholder.category.change",
      "layout.placeholder.displaySize.change",
      "layout.aiAutofill.toggle"
    ]),
    placeholderId: IdSchema.optional(),
    actor: z.enum(["user", "system"]),
    payload: z.record(z.string(), z.unknown()).optional(),
    createdAt: TimestampSchema
  })
  .strict();

export const LayoutIntentRevisionSchema = z
  .object({
    layoutIntentRevisionId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema,
    revision: z.number().int().positive(),
    source: LayoutIntentSourceSchema,
    aiAutofillEnabled: z.boolean(),
    placeholders: z.array(FurniturePlaceholderSchema),
    validation: LayoutIntentValidationStateSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    archivedAt: TimestampSchema.optional()
  })
  .strict();

export const LayoutIntentContractSchema = z
  .object({
    layoutIntentContractId: IdSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentRevisionId: IdSchema,
    layoutIntentHash: LayoutIntentHashSchema,
    aiAutofillEnabled: z.boolean(),
    readonly: z.literal(true),
    placeholders: z.array(FurniturePlaceholderSchema),
    constraints: z
      .object({
        mayMutateGeometry: z.literal(false),
        mayMutateSceneContract: z.literal(false),
        placeholderCoordinatesAreFinalFurnitureCoordinates: z.literal(false),
        placeholderSizesAreSkuSizes: z.literal(false)
      })
      .strict(),
    createdAt: TimestampSchema
  })
  .strict();

export const LayoutIntentArtifactDependencySchema = z
  .object({
    dependencyId: IdSchema,
    artifactId: IdSchema,
    artifactType: z.enum([
      "AnchorPlan",
      "SchemeLiteContract",
      "RoomSchemeLite",
      "CreativeRenderSpec",
      "RenderJob",
      "RenderCandidate",
      "RenderVerificationReport",
      "RoomGallery",
      "SkuFitResult"
    ]),
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentRevisionId: IdSchema.optional(),
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    status: z.enum(["active", "invalidated", "archived"]),
    active: z.boolean(),
    createdAt: TimestampSchema,
    invalidatedAt: TimestampSchema.optional(),
    archivedAt: TimestampSchema.optional()
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.status !== "active" && record.active) {
      ctx.addIssue({
        code: "custom",
        message: "inactive layout intent dependencies cannot remain active",
        path: ["active"]
      });
    }
  });

export const LayoutIntentHashComparisonSchema = z
  .object({
    changed: z.boolean(),
    previousLayoutIntentHash: LayoutIntentHashSchema.optional(),
    newLayoutIntentHash: LayoutIntentHashSchema.optional()
  })
  .strict();

export const LayoutIntentInvalidationSummarySchema = z
  .object({
    changed: z.boolean(),
    previousLayoutIntentHash: LayoutIntentHashSchema.optional(),
    newLayoutIntentHash: LayoutIntentHashSchema.optional(),
    invalidatedDependencyIds: z.array(IdSchema),
    archivedLayoutIntentRevisionIds: z.array(IdSchema),
    preservedGeometryArtifacts: z
      .object({
        canonicalFloorplan: z.literal(true),
        sceneContract: z.literal(true),
        whiteModel: z.literal(true),
        cameraPlan: z.literal(true),
        baseAffordanceGraph: z.literal(true)
      })
      .strict()
  })
  .strict();

export const LayoutIntentEventTypeSchema = z.enum([
  "layout_intent_session_started",
  "layout_placeholder_added",
  "layout_placeholder_deleted",
  "layout_placeholder_moved",
  "layout_placeholder_rotated",
  "layout_placeholder_category_changed",
  "layout_placeholder_display_size_changed",
  "layout_ai_autofill_toggled",
  "layout_intent_validated",
  "layout_intent_confirmed"
]);

export const LayoutIntentEventSchema = z
  .object({
    eventId: IdSchema,
    eventType: LayoutIntentEventTypeSchema,
    homeId: IdSchema,
    userId: IdSchema.optional(),
    anonymousSessionId: IdSchema.optional(),
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentRevisionId: IdSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    placeholderId: IdSchema.optional(),
    timestamp: TimestampSchema,
    source: z.literal("layout_intent")
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.userId === undefined && event.anonymousSessionId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "layout intent events require userId or anonymousSessionId",
        path: ["userId"]
      });
    }
  });

export const AnchorPlannerInputContractSchema = z
  .object({
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentRevisionId: IdSchema.optional(),
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    aiAutofillEnabled: z.boolean(),
    roomAffordanceGraphs: z.array(P1RoomAffordanceGraphSchema),
    userPlaceholders: z.array(FurniturePlaceholderSchema),
    rules: z
      .object({
        respectUserPlaceholders: z.literal(true),
        verifyUserPlaceholders: z.literal(true),
        mayAutofillMissingAnchors: z.boolean(),
        mayMoveUserPlaceholders: z.literal(false),
        mayMutateGeometry: z.literal(false)
      })
      .strict()
  })
  .strict()
  .superRefine((contract, ctx) => {
    for (const graph of contract.roomAffordanceGraphs) {
      const matchesScene =
        graph.homeId === contract.homeId &&
        graph.canonicalRevisionId === contract.canonicalRevisionId &&
        graph.sceneContractId === contract.sceneContractId &&
        graph.geometryHash === contract.geometryHash;
      if (!matchesScene) {
        ctx.addIssue({
          code: "custom",
          message: "affordance graph must match anchor planner geometry trace",
          path: ["roomAffordanceGraphs"]
        });
      }
    }
  });

export const LayoutIntentContractInputSchema = z
  .object({
    sceneContract: P1SceneContractV02Schema,
    layoutIntent: LayoutIntentRevisionSchema
  })
  .strict();

export type LayoutIntentHash = z.infer<typeof LayoutIntentHashSchema>;
export type LayoutIntentSource = z.infer<typeof LayoutIntentSourceSchema>;
export type FurnitureCategory = z.infer<typeof FurnitureCategorySchema>;
export type FurniturePlaceholder = z.infer<typeof FurniturePlaceholderSchema>;
export type LayoutIntentValidationIssue = z.infer<typeof LayoutIntentValidationIssueSchema>;
export type LayoutIntentValidationState = z.infer<typeof LayoutIntentValidationStateSchema>;
export type LayoutIntentHashInput = z.infer<typeof LayoutIntentHashInputSchema>;
export type LayoutIntentOperation = z.infer<typeof LayoutIntentOperationSchema>;
export type LayoutIntentRevision = z.infer<typeof LayoutIntentRevisionSchema>;
export type LayoutIntentContract = z.infer<typeof LayoutIntentContractSchema>;
export type LayoutIntentArtifactDependency = z.infer<typeof LayoutIntentArtifactDependencySchema>;
export type LayoutIntentHashComparison = z.infer<typeof LayoutIntentHashComparisonSchema>;
export type LayoutIntentInvalidationSummary = z.infer<typeof LayoutIntentInvalidationSummarySchema>;
export type LayoutIntentEventType = z.infer<typeof LayoutIntentEventTypeSchema>;
export type LayoutIntentEvent = z.infer<typeof LayoutIntentEventSchema>;
export type AnchorPlannerInputContract = z.infer<typeof AnchorPlannerInputContractSchema>;
