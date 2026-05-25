import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { P1ValidationSummarySchema } from "./p1-api-boundary.js";
import { V1BetaFlowStageIdSchema } from "./v1-beta-flow.js";

export const V1BetaUserBackendSourceSchema = z.literal(
  "mock_contract_shell",
);

export const V1BetaUserHomeStateSchema = z.enum([
  "new",
  "uploaded",
  "parse_pending",
  "parse_failed",
  "draft_ready",
  "p1_editing",
  "p1_invalid",
  "p1_confirmed",
  "scene_ready",
  "scheme_ready",
  "renders_pending",
  "renders_ready",
  "decor_locked",
  "decor_ready",
  "lead_ready",
]);

export const V1BetaUserActionMethodSchema = z.enum([
  "GET",
  "POST",
  "PATCH",
]);

export const V1BetaUserActionSchema = z
  .object({
    actionId: z.string().min(1),
    label: z.string().min(1),
    method: V1BetaUserActionMethodSchema,
    href: z.string().min(1),
    enabled: z.boolean(),
    disabledReason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((action, ctx) => {
    if (!action.enabled && action.disabledReason === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "disabled actions require disabledReason",
        path: ["disabledReason"],
      });
    }
  });

export const V1BetaUserBlockerSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    severity: z.enum(["info", "warning", "blocker"]),
    target: z.string().min(1).optional(),
  })
  .strict();

export const V1BetaUserTraceSchema = z
  .object({
    homeId: IdSchema,
    assetId: IdSchema.optional(),
    parseJobId: IdSchema.optional(),
    draftRevisionId: IdSchema.optional(),
    canonicalRevisionId: IdSchema.optional(),
    geometryHash: GeometryHashSchema.optional(),
    sceneContractId: IdSchema.optional(),
    schemeId: IdSchema.optional(),
  })
  .strict()
  .superRefine((trace, ctx) => {
    if (
      trace.canonicalRevisionId !== undefined &&
      trace.geometryHash === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "canonicalRevisionId requires geometryHash trace",
        path: ["geometryHash"],
      });
    }
  });

export const V1BetaUserBackendGuardrailsSchema = z
  .object({
    mockOnly: z.literal(true),
    dbPersistenceEnabled: z.literal(false),
    realProviderEnabled: z.literal(false),
    networkCallsEnabled: z.literal(false),
    authEnforced: z.literal(false),
    confirmedGeometryMutable: z.literal(false),
  })
  .strict();

export const P1UserFlowViewModelSchema = z
  .object({
    version: z.literal("0.1"),
    source: V1BetaUserBackendSourceSchema,
    trace: V1BetaUserTraceSchema,
    currentState: V1BetaUserHomeStateSchema,
    userVisibleStage: V1BetaFlowStageIdSchema,
    validation: P1ValidationSummarySchema.optional(),
    nextActions: z.array(V1BetaUserActionSchema),
    blockers: z.array(V1BetaUserBlockerSchema),
    guardrails: V1BetaUserBackendGuardrailsSchema,
    updatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((flow, ctx) => {
    const hasEnabledAction = flow.nextActions.some(
      (action) => action.enabled,
    );
    const hasBlockingBlocker = flow.blockers.some(
      (blocker) => blocker.severity === "blocker",
    );

    if (!hasEnabledAction && !hasBlockingBlocker) {
      ctx.addIssue({
        code: "custom",
        message:
          "flow without enabled actions must expose a blocking blocker",
        path: ["blockers"],
      });
    }

    if (
      flow.currentState === "p1_confirmed" &&
      flow.trace.canonicalRevisionId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "p1_confirmed requires canonicalRevisionId trace",
        path: ["trace", "canonicalRevisionId"],
      });
    }
  });

export const V1BetaHomeBootstrapSchema = z
  .object({
    ok: z.literal(true),
    version: z.literal("0.1"),
    source: V1BetaUserBackendSourceSchema,
    homeId: IdSchema,
    title: z.string().min(1),
    flow: P1UserFlowViewModelSchema,
    endpoints: z
      .object({
        bootstrap: z.string().min(1),
        uploadFloorplan: z.string().min(1),
        p1Session: z.string().min(1),
        p1DraftViewModel: z.string().min(1),
        p1Confirm: z.string().min(1),
      })
      .strict(),
    generatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((bootstrap, ctx) => {
    if (bootstrap.homeId !== bootstrap.flow.trace.homeId) {
      ctx.addIssue({
        code: "custom",
        message: "bootstrap homeId must match flow trace homeId",
        path: ["flow", "trace", "homeId"],
      });
    }
  });

export const UploadFloorplanRequestSchema = z
  .object({
    uploadMode: z.enum(["fixture_asset", "file_asset_placeholder"]),
    fixtureKey: z.string().min(1).optional(),
    fileName: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.uploadMode === "fixture_asset" &&
      request.fixtureKey === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "fixture_asset uploads require fixtureKey",
        path: ["fixtureKey"],
      });
    }
    if (
      request.uploadMode === "file_asset_placeholder" &&
      request.fileName === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "file_asset_placeholder uploads require fileName",
        path: ["fileName"],
      });
    }
  });

export const UploadFloorplanResponseSchema = z
  .object({
    ok: z.literal(true),
    version: z.literal("0.1"),
    source: V1BetaUserBackendSourceSchema,
    homeId: IdSchema,
    assetId: IdSchema,
    parseJobId: IdSchema,
    draftRevisionId: IdSchema,
    currentState: z.enum(["parse_pending", "draft_ready"]),
    userMessage: z.string().min(1),
    nextAction: V1BetaUserActionSchema,
    trace: V1BetaUserTraceSchema,
    guardrails: V1BetaUserBackendGuardrailsSchema,
    generatedAt: TimestampSchema,
  })
  .strict()
  .superRefine((response, ctx) => {
    if (response.homeId !== response.trace.homeId) {
      ctx.addIssue({
        code: "custom",
        message: "upload response homeId must match trace homeId",
        path: ["trace", "homeId"],
      });
    }
    if (response.assetId !== response.trace.assetId) {
      ctx.addIssue({
        code: "custom",
        message: "upload response assetId must match trace assetId",
        path: ["trace", "assetId"],
      });
    }
    if (response.parseJobId !== response.trace.parseJobId) {
      ctx.addIssue({
        code: "custom",
        message: "upload response parseJobId must match trace parseJobId",
        path: ["trace", "parseJobId"],
      });
    }
    if (response.draftRevisionId !== response.trace.draftRevisionId) {
      ctx.addIssue({
        code: "custom",
        message:
          "upload response draftRevisionId must match trace draftRevisionId",
        path: ["trace", "draftRevisionId"],
      });
    }
  });

export type V1BetaUserBackendSource = z.infer<
  typeof V1BetaUserBackendSourceSchema
>;
export type V1BetaUserHomeState = z.infer<
  typeof V1BetaUserHomeStateSchema
>;
export type V1BetaUserAction = z.infer<typeof V1BetaUserActionSchema>;
export type V1BetaUserBlocker = z.infer<typeof V1BetaUserBlockerSchema>;
export type V1BetaUserTrace = z.infer<typeof V1BetaUserTraceSchema>;
export type V1BetaUserBackendGuardrails = z.infer<
  typeof V1BetaUserBackendGuardrailsSchema
>;
export type P1UserFlowViewModel = z.infer<
  typeof P1UserFlowViewModelSchema
>;
export type V1BetaHomeBootstrap = z.infer<
  typeof V1BetaHomeBootstrapSchema
>;
export type UploadFloorplanRequest = z.infer<
  typeof UploadFloorplanRequestSchema
>;
export type UploadFloorplanResponse = z.infer<
  typeof UploadFloorplanResponseSchema
>;
