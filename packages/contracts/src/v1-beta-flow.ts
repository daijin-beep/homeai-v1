import { z } from "zod";
import {
  IdSchema,
  TimestampSchema
} from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";

export const V1BetaFlowStageIdSchema = z.enum([
  "floorplan_upload",
  "space_confirmation",
  "scheme_review",
  "render_review",
  "decor_matching",
  "conversion_intent"
]);

export const V1BetaFlowStageStatusSchema = z.enum([
  "complete",
  "current",
  "ready",
  "needs_review",
  "locked"
]);

export const V1BetaFlowStageSchema = z
  .object({
    stageId: V1BetaFlowStageIdSchema,
    status: V1BetaFlowStageStatusSchema,
    label: z.string().min(1),
    summary: z.string().min(1),
    primaryHref: z.string().min(1).optional(),
    itemCount: z.number().int().nonnegative().optional(),
    issueCount: z.number().int().nonnegative().optional()
  })
  .strict();

export const V1BetaFlowSummarySchema = z
  .object({
    totalStages: z.number().int().positive(),
    completeStages: z.number().int().nonnegative(),
    readyStages: z.number().int().nonnegative(),
    lockedStages: z.number().int().nonnegative(),
    needsReviewStages: z.number().int().nonnegative(),
    currentStageId: V1BetaFlowStageIdSchema,
    status: z.enum(["in_progress", "needs_review", "ready_for_next_batch"])
  })
  .strict();

export const V1BetaFlowGuardrailsSchema = z
  .object({
    deterministicFixturesOnly: z.literal(true),
    adsRuntimeConsumed: z.literal(false),
    realProviderEnabled: z.literal(false),
    networkCallsEnabled: z.literal(false),
    confirmedGeometryMutable: z.literal(false),
    downstreamCommerceEnabled: z.literal(false)
  })
  .strict();

export const V1BetaFlowViewModelSchema = z
  .object({
    version: z.literal("0.1"),
    source: z.literal("deterministic_fixture"),
    homeId: IdSchema,
    schemeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    title: z.string().min(1),
    summary: V1BetaFlowSummarySchema,
    stages: z.array(V1BetaFlowStageSchema).min(1),
    guardrails: V1BetaFlowGuardrailsSchema,
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((flow, ctx) => {
    if (flow.summary.totalStages !== flow.stages.length) {
      ctx.addIssue({
        code: "custom",
        message: "summary totalStages must match stages",
        path: ["summary", "totalStages"]
      });
    }

    const completeStages = flow.stages.filter((stage) => stage.status === "complete").length;
    const readyStages = flow.stages.filter((stage) => stage.status === "ready").length;
    const lockedStages = flow.stages.filter((stage) => stage.status === "locked").length;
    const needsReviewStages = flow.stages.filter((stage) => stage.status === "needs_review").length;
    if (
      flow.summary.completeStages !== completeStages ||
      flow.summary.readyStages !== readyStages ||
      flow.summary.lockedStages !== lockedStages ||
      flow.summary.needsReviewStages !== needsReviewStages
    ) {
      ctx.addIssue({
        code: "custom",
        message: "summary stage counts must match stages",
        path: ["summary"]
      });
    }

    const currentStageCount = flow.stages.filter((stage) => stage.status === "current").length;
    const currentStage = flow.stages.find((stage) => stage.stageId === flow.summary.currentStageId);
    if (currentStage === undefined || currentStage.status !== "current" || currentStageCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "flow must have exactly one current stage matching currentStageId",
        path: ["summary", "currentStageId"]
      });
    }
  });

export type V1BetaFlowStageId = z.infer<typeof V1BetaFlowStageIdSchema>;
export type V1BetaFlowStageStatus = z.infer<typeof V1BetaFlowStageStatusSchema>;
export type V1BetaFlowStage = z.infer<typeof V1BetaFlowStageSchema>;
export type V1BetaFlowSummary = z.infer<typeof V1BetaFlowSummarySchema>;
export type V1BetaFlowGuardrails = z.infer<typeof V1BetaFlowGuardrailsSchema>;
export type V1BetaFlowViewModel = z.infer<typeof V1BetaFlowViewModelSchema>;
