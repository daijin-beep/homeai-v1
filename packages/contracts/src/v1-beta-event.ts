import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { LeadEventMetadataSchema } from "./lead-event.js";
import { V1BetaFlowStageIdSchema } from "./v1-beta-flow.js";

export const V1BetaEventTypeSchema = z.enum([
  "beta_flow_viewed",
  "beta_stage_viewed",
  "scheme_page_viewed",
  "render_status_viewed",
  "render_room_status_opened",
  "decor_matching_locked_viewed",
  "conversion_intent_locked_viewed",
]);

export const V1BetaEventSourceSchema = z.enum([
  "v1_beta_flow_shell",
  "scheme_page_shell",
  "render_status_shell",
  "dev_intake",
  "fixture",
]);

export const V1BetaEventSchema = z
  .object({
    eventId: IdSchema,
    eventType: V1BetaEventTypeSchema,
    source: V1BetaEventSourceSchema,
    anonymousSessionId: IdSchema,
    homeId: IdSchema,
    schemeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    stageId: V1BetaFlowStageIdSchema.optional(),
    roomId: IdSchema.optional(),
    renderCandidateId: IdSchema.optional(),
    metadata: LeadEventMetadataSchema.optional(),
    createdAt: TimestampSchema,
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      event.eventType === "beta_stage_viewed" &&
      event.stageId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "beta_stage_viewed requires stageId",
        path: ["stageId"],
      });
    }
    if (
      event.eventType === "render_room_status_opened" &&
      event.roomId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "render_room_status_opened requires roomId",
        path: ["roomId"],
      });
    }
  });

export const V1BetaEventSummarySchema = z
  .object({
    totalEvents: z.number().int().nonnegative(),
    uniqueSessions: z.number().int().nonnegative(),
    eventTypes: z.record(V1BetaEventTypeSchema, z.number().int().nonnegative()),
  })
  .strict();

export const V1BetaEventIntakeRequestSchema = z
  .object({
    events: z.array(V1BetaEventSchema).min(1).max(50),
  })
  .strict();

export const V1BetaEventIntakeResponseSchema = z
  .object({
    ok: z.literal(true),
    acceptedCount: z.number().int().nonnegative(),
    totalStored: z.number().int().nonnegative(),
    summary: V1BetaEventSummarySchema,
  })
  .strict();

export const V1BetaEventDebugPayloadSchema = z
  .object({
    ok: z.literal(true),
    events: z.array(V1BetaEventSchema),
    summary: V1BetaEventSummarySchema,
    generatedAt: TimestampSchema,
  })
  .strict();

export type V1BetaEventType = z.infer<typeof V1BetaEventTypeSchema>;
export type V1BetaEventSource = z.infer<typeof V1BetaEventSourceSchema>;
export type V1BetaEvent = z.infer<typeof V1BetaEventSchema>;
export type V1BetaEventSummary = z.infer<typeof V1BetaEventSummarySchema>;
export type V1BetaEventIntakeRequest = z.infer<
  typeof V1BetaEventIntakeRequestSchema
>;
export type V1BetaEventIntakeResponse = z.infer<
  typeof V1BetaEventIntakeResponseSchema
>;
export type V1BetaEventDebugPayload = z.infer<
  typeof V1BetaEventDebugPayloadSchema
>;
