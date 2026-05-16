import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { V1BetaEventSchema } from "./v1-beta-event.js";

export const V1BetaConversionActionTypeSchema = z.enum([
  "save_plan_mock",
  "share_plan_mock",
  "contact_request_mock",
  "payment_started_mock"
]);

export const V1BetaConversionActionSchema = z
  .object({
    actionId: IdSchema,
    type: V1BetaConversionActionTypeSchema,
    label: z.string().min(1),
    status: z.enum(["enabled_mock", "locked"]),
    eventType: z.literal("payment_started_mock").optional(),
    requiresRealPaymentProvider: z.literal(false),
    summary: z.string().min(1)
  })
  .strict()
  .superRefine((action, ctx) => {
    if (action.type === "payment_started_mock" && action.eventType !== "payment_started_mock") {
      ctx.addIssue({
        code: "custom",
        message: "payment_started_mock action must map to payment_started_mock event",
        path: ["eventType"]
      });
    }
  });

export const V1BetaConversionActionSetSchema = z
  .object({
    version: z.literal("0.1"),
    source: z.literal("mock_only"),
    homeId: IdSchema,
    schemeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    actions: z.array(V1BetaConversionActionSchema).min(1),
    generatedAt: TimestampSchema
  })
  .strict();

export const V1BetaConversionDebugPayloadSchema = z
  .object({
    ok: z.literal(true),
    actionSet: V1BetaConversionActionSetSchema,
    paymentStartedMockEvent: V1BetaEventSchema,
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (payload.paymentStartedMockEvent.eventType !== "payment_started_mock") {
      ctx.addIssue({
        code: "custom",
        message: "debug payload must include payment_started_mock event",
        path: ["paymentStartedMockEvent", "eventType"]
      });
    }
    if (payload.paymentStartedMockEvent.geometryHash !== payload.actionSet.geometryHash) {
      ctx.addIssue({
        code: "custom",
        message: "payment mock event geometryHash must match conversion action set",
        path: ["paymentStartedMockEvent", "geometryHash"]
      });
    }
  });

export type V1BetaConversionActionType = z.infer<typeof V1BetaConversionActionTypeSchema>;
export type V1BetaConversionAction = z.infer<typeof V1BetaConversionActionSchema>;
export type V1BetaConversionActionSet = z.infer<typeof V1BetaConversionActionSetSchema>;
export type V1BetaConversionDebugPayload = z.infer<typeof V1BetaConversionDebugPayloadSchema>;
