import { z } from "zod";
import { CreativeRenderSpecBatchSchema } from "./creative-render-spec.js";
import { SchemeRenderGalleryViewModelSchema } from "./scheme-render-gallery.js";
import {
  SchemePageRenderStatusShellSchema,
  SchemePageViewModelSchema
} from "./scheme-page.js";
import { SoftDecorGpsLitePlanSchema, VerifiedSkuCatalogSchema } from "./soft-decor-gps.js";
import { V1BetaConversionActionSetSchema } from "./v1-beta-conversion.js";
import {
  V1BetaEventSchema,
  V1BetaEventSummarySchema
} from "./v1-beta-event.js";
import { V1BetaFlowViewModelSchema } from "./v1-beta-flow.js";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";

export const V1BetaFixtureHarnessScenarioSchema = z.enum(["beta_ready_all_pass"]);

export const V1BetaFixtureHarnessTraceSchema = z
  .object({
    homeId: IdSchema,
    schemeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema
  })
  .strict();

export const V1BetaFixtureHarnessGuardrailsSchema = z
  .object({
    deterministicFixturesOnly: z.literal(true),
    adsRuntimeConsumed: z.literal(false),
    adsSnapshotRuntimeConsumed: z.literal(false),
    humanReviewRuntimeConsumed: z.literal(false),
    providerRegistryUsed: z.literal(false),
    realProviderEnabled: z.literal(false),
    networkCallsEnabled: z.literal(false),
    confirmedGeometryMutable: z.literal(false),
    liveCommerceEnabled: z.literal(false),
    pdfConstructionScopeEnabled: z.literal(false)
  })
  .strict();

export const V1BetaFixtureHarnessSummarySchema = z
  .object({
    flowStageCount: z.number().int().positive(),
    schemeRoomCount: z.number().int().positive(),
    renderStatusRoomCount: z.number().int().positive(),
    renderEligibleRoomCount: z.number().int().nonnegative(),
    creativeRenderSpecCount: z.number().int().nonnegative(),
    verifiedSkuCount: z.number().int().nonnegative(),
    softDecorRoomCount: z.number().int().positive(),
    conversionActionCount: z.number().int().positive(),
    eventCount: z.number().int().nonnegative(),
    hardStopCount: z.number().int().nonnegative(),
    readyForBetaHarness: z.boolean()
  })
  .strict();

export const V1BetaFixtureHarnessPayloadSchema = z
  .object({
    version: z.literal("0.1"),
    source: z.literal("deterministic_beta_fixture_harness"),
    scenario: V1BetaFixtureHarnessScenarioSchema,
    trace: V1BetaFixtureHarnessTraceSchema,
    flow: V1BetaFlowViewModelSchema,
    schemePageViewModel: SchemePageViewModelSchema,
    renderStatusShell: SchemePageRenderStatusShellSchema,
    renderGalleryViewModel: SchemeRenderGalleryViewModelSchema,
    creativeRenderSpecBatch: CreativeRenderSpecBatchSchema,
    verifiedSkuCatalog: VerifiedSkuCatalogSchema,
    softDecorPlan: SoftDecorGpsLitePlanSchema,
    conversionActionSet: V1BetaConversionActionSetSchema,
    events: z.array(V1BetaEventSchema),
    eventSummary: V1BetaEventSummarySchema,
    guardrails: V1BetaFixtureHarnessGuardrailsSchema,
    summary: V1BetaFixtureHarnessSummarySchema,
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((payload, ctx) => {
    const traceFields = [
      payload.flow,
      payload.schemePageViewModel.trace,
      payload.renderStatusShell.trace,
      payload.renderGalleryViewModel,
      payload.creativeRenderSpecBatch,
      payload.softDecorPlan,
      payload.conversionActionSet
    ];

    for (const [index, candidate] of traceFields.entries()) {
      if (
        candidate.homeId !== payload.trace.homeId ||
        candidate.schemeId !== payload.trace.schemeId ||
        candidate.floorplanRevisionId !== payload.trace.floorplanRevisionId ||
        candidate.sceneContractId !== payload.trace.sceneContractId ||
        candidate.geometryHash !== payload.trace.geometryHash
      ) {
        ctx.addIssue({
          code: "custom",
          message: "fixture harness trace must match every included artifact",
          path: ["trace", index]
        });
      }
    }

    const countChecks = [
      ["flowStageCount", payload.flow.stages.length],
      ["schemeRoomCount", payload.schemePageViewModel.rooms.length],
      ["renderStatusRoomCount", payload.renderStatusShell.rooms.length],
      ["renderEligibleRoomCount", payload.renderStatusShell.summary.roomsWithEligibleRender],
      ["creativeRenderSpecCount", payload.creativeRenderSpecBatch.specs.length],
      ["verifiedSkuCount", payload.verifiedSkuCatalog.verifiedSkus.length],
      ["softDecorRoomCount", payload.softDecorPlan.rooms.length],
      ["conversionActionCount", payload.conversionActionSet.actions.length],
      ["eventCount", payload.events.length]
    ] as const;

    for (const [key, expected] of countChecks) {
      if (payload.summary[key] !== expected) {
        ctx.addIssue({
          code: "custom",
          message: `${key} must match fixture artifacts`,
          path: ["summary", key]
        });
      }
    }

    if (payload.eventSummary.totalEvents !== payload.events.length) {
      ctx.addIssue({
        code: "custom",
        message: "eventSummary totalEvents must match events",
        path: ["eventSummary", "totalEvents"]
      });
    }

    if (payload.summary.readyForBetaHarness && payload.summary.hardStopCount !== 0) {
      ctx.addIssue({
        code: "custom",
        message: "readyForBetaHarness requires zero hard stops",
        path: ["summary", "readyForBetaHarness"]
      });
    }
  });

export const V1BetaReleaseGateStatusSchema = z.enum(["pass", "fail"]);

export const V1BetaReleaseGateCheckSchema = z
  .object({
    checkId: IdSchema,
    status: V1BetaReleaseGateStatusSchema,
    message: z.string().min(1)
  })
  .strict();

export const V1BetaReleaseGateReportSchema = z
  .object({
    version: z.literal("0.1"),
    source: z.literal("deterministic_beta_release_gate"),
    scenario: V1BetaFixtureHarnessScenarioSchema,
    status: V1BetaReleaseGateStatusSchema,
    trace: V1BetaFixtureHarnessTraceSchema,
    checks: z.array(V1BetaReleaseGateCheckSchema).min(1),
    failedCheckCount: z.number().int().nonnegative(),
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((report, ctx) => {
    const failed = report.checks.filter((check) => check.status === "fail").length;
    if (report.failedCheckCount !== failed) {
      ctx.addIssue({
        code: "custom",
        message: "failedCheckCount must match failed release gate checks",
        path: ["failedCheckCount"]
      });
    }
    if (report.status === "pass" && failed > 0) {
      ctx.addIssue({
        code: "custom",
        message: "pass status requires zero failed checks",
        path: ["status"]
      });
    }
    if (report.status === "fail" && failed === 0) {
      ctx.addIssue({
        code: "custom",
        message: "fail status requires failed checks",
        path: ["status"]
      });
    }
  });

export type V1BetaFixtureHarnessScenario = z.infer<typeof V1BetaFixtureHarnessScenarioSchema>;
export type V1BetaFixtureHarnessTrace = z.infer<typeof V1BetaFixtureHarnessTraceSchema>;
export type V1BetaFixtureHarnessGuardrails = z.infer<typeof V1BetaFixtureHarnessGuardrailsSchema>;
export type V1BetaFixtureHarnessSummary = z.infer<typeof V1BetaFixtureHarnessSummarySchema>;
export type V1BetaFixtureHarnessPayload = z.infer<typeof V1BetaFixtureHarnessPayloadSchema>;
export type V1BetaReleaseGateStatus = z.infer<typeof V1BetaReleaseGateStatusSchema>;
export type V1BetaReleaseGateCheck = z.infer<typeof V1BetaReleaseGateCheckSchema>;
export type V1BetaReleaseGateReport = z.infer<typeof V1BetaReleaseGateReportSchema>;
