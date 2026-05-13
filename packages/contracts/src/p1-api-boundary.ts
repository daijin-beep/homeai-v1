import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import {
  DraftValidationStateSchema,
  FloorplanEditOperationSchema,
  GeometryHashSchema
} from "./p1-floorplan-adjustment.js";

export const P1EventTypeSchema = z.enum([
  "p1_entered",
  "p1_advanced_settings_toggled",
  "p1_wall_added",
  "p1_wall_deleted",
  "p1_wall_resized",
  "p1_door_added",
  "p1_door_deleted",
  "p1_door_direction_changed",
  "p1_window_added",
  "p1_window_deleted",
  "p1_window_type_changed",
  "p1_balcony_added",
  "p1_balcony_deleted",
  "p1_balcony_type_changed",
  "p1_room_type_changed",
  "p1_wall_thickness_changed",
  "p1_free_wall_drawn",
  "p1_floor_height_changed",
  "p1_door_dimension_changed",
  "p1_floorplan_confirmed",
  "p1_reentered_from_downstream"
]);

export const P1EventSchema = z
  .object({
    eventId: IdSchema,
    eventType: P1EventTypeSchema,
    homeId: IdSchema,
    userId: IdSchema.optional(),
    anonymousSessionId: IdSchema.optional(),
    draftRevisionId: IdSchema,
    canonicalRevisionId: IdSchema.optional(),
    geometryHash: GeometryHashSchema.optional(),
    previousGeometryHash: GeometryHashSchema.optional(),
    newGeometryHash: GeometryHashSchema.optional(),
    operationType: FloorplanEditOperationSchema.shape.operationType.optional(),
    timestamp: TimestampSchema,
    source: z.literal("p1_editor")
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.userId === undefined && event.anonymousSessionId === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "P1 events require userId or anonymousSessionId",
        path: ["userId"]
      });
    }
  });

export const GeometryDependencyArtifactTypeSchema = z.enum([
  "SceneContract",
  "WhiteModel",
  "ControlScene",
  "RoomAffordanceGraph",
  "AnchorPlan",
  "CameraPlan",
  "CreativeRenderSpec",
  "RenderJob",
  "RenderCandidate",
  "RenderVerificationReport",
  "RoomGallery",
  "SchemeLiteContract",
  "RoomSchemeLite",
  "SkuFitResult"
]);

export const GeometryDependencyStatusSchema = z.enum(["active", "invalidated", "archived"]);

export const GeometryDependencyRecordSchema = z
  .object({
    dependencyId: IdSchema,
    artifactId: IdSchema,
    artifactType: GeometryDependencyArtifactTypeSchema,
    homeId: IdSchema,
    canonicalRevisionId: IdSchema,
    geometryHash: GeometryHashSchema,
    status: GeometryDependencyStatusSchema,
    active: z.boolean(),
    invalidatedAt: TimestampSchema.optional(),
    archivedAt: TimestampSchema.optional(),
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((record, ctx) => {
    if (record.status !== "active" && record.active) {
      ctx.addIssue({
        code: "custom",
        message: "Invalidated or archived geometry dependencies cannot remain active",
        path: ["active"]
      });
    }
  });

export const GeometryHashComparisonSchema = z
  .object({
    changed: z.boolean(),
    previousGeometryHash: GeometryHashSchema.optional(),
    newGeometryHash: GeometryHashSchema.optional()
  })
  .strict();

export const PreservedNonGeometryStateSchema = z
  .object({
    uploadedSourceAsset: z.literal(true),
    parseJobHistory: z.literal(true),
    userAccount: z.literal(true),
    designBriefText: z.literal(true),
    stylePreference: z.literal(true),
    budgetPreference: z.literal(true),
    eventAuditLog: z.literal(true),
    paymentRecords: z.literal(true),
    previousPaidDeliverableAccess: z.literal(true)
  })
  .strict();

export const P1InvalidationSummarySchema = z
  .object({
    changed: z.boolean(),
    previousGeometryHash: GeometryHashSchema.optional(),
    newGeometryHash: GeometryHashSchema.optional(),
    invalidatedDependencyIds: z.array(IdSchema),
    archivedDependencyIds: z.array(IdSchema),
    preserved: PreservedNonGeometryStateSchema
  })
  .strict();

export const P1ValidationSummarySchema = z
  .object({
    status: DraftValidationStateSchema.shape.status,
    canConfirm: z.boolean(),
    issueCount: z.number().int().nonnegative(),
    blockingIssueCount: z.number().int().nonnegative()
  })
  .strict();

export const P1OperationLogSummarySchema = z
  .object({
    count: z.number().int().nonnegative(),
    lastOperationId: IdSchema.optional()
  })
  .strict();

export type P1EventType = z.infer<typeof P1EventTypeSchema>;
export type P1Event = z.infer<typeof P1EventSchema>;
export type GeometryDependencyArtifactType = z.infer<typeof GeometryDependencyArtifactTypeSchema>;
export type GeometryDependencyStatus = z.infer<typeof GeometryDependencyStatusSchema>;
export type GeometryDependencyRecord = z.infer<typeof GeometryDependencyRecordSchema>;
export type GeometryHashComparison = z.infer<typeof GeometryHashComparisonSchema>;
export type PreservedNonGeometryState = z.infer<typeof PreservedNonGeometryStateSchema>;
export type P1InvalidationSummary = z.infer<typeof P1InvalidationSummarySchema>;
export type P1ValidationSummary = z.infer<typeof P1ValidationSummarySchema>;
export type P1OperationLogSummary = z.infer<typeof P1OperationLogSummarySchema>;
