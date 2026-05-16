import {
  V1BetaFixtureHarnessPayloadSchema,
  V1BetaReleaseGateReportSchema,
  V1BetaFlowViewModelSchema,
  type V1BetaFixtureHarnessPayload,
  type V1BetaReleaseGateCheck,
  type V1BetaReleaseGateReport,
  type V1BetaFlowStage
} from "@homeai/contracts";
import {
  buildV1BetaConversionActionSet,
  createInMemoryV1BetaEventRepository,
  createPaymentStartedMockEvent,
  createV1BetaEventFixture,
  v1BetaEventFixtureTimestamp
} from "@homeai/analytics";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";
import {
  buildSchemePageRenderStatusShell,
  buildSchemePageViewModelFromSchemeLite
} from "@homeai/scheme-page";
import {
  buildSoftDecorGpsLitePlan,
  buildVerifiedSkuDebugFixture
} from "@homeai/soft-decor-gps";

export const v1BetaFixtureHarnessTimestamp = v1BetaEventFixtureTimestamp;
const INVALID_RELEASE_GATE_TRACE = {
  homeId: "invalid-v1-beta-harness",
  schemeId: "invalid-v1-beta-harness",
  floorplanRevisionId: "invalid-v1-beta-harness",
  sceneContractId: "invalid-v1-beta-harness",
  geometryHash: `sha256:${"f".repeat(64)}`
};

export function buildV1BetaFixtureHarness(): V1BetaFixtureHarnessPayload {
  const renderDebug = buildSchemeRenderGalleryDebugFixture("all_pass");
  const schemePageViewModel = buildSchemePageViewModelFromSchemeLite(renderDebug.schemeLiteContract, {
    title: "homeAI V1 Beta fixture harness",
    generatedAt: v1BetaFixtureHarnessTimestamp
  });
  const renderStatusShell = buildSchemePageRenderStatusShell({
    viewModel: schemePageViewModel,
    renderGalleryViewModel: renderDebug.galleryViewModel,
    generatedAt: v1BetaFixtureHarnessTimestamp,
    source: "deterministic_fixture"
  });
  const verifiedSkuCatalog = buildVerifiedSkuDebugFixture();
  const softDecorPlan = buildSoftDecorGpsLitePlan({
    scheme: renderDebug.schemeLiteContract,
    catalog: verifiedSkuCatalog,
    createdAt: v1BetaFixtureHarnessTimestamp
  });
  const trace = {
    homeId: renderDebug.schemeLiteContract.homeId,
    schemeId: renderDebug.schemeLiteContract.schemeId,
    floorplanRevisionId: renderDebug.schemeLiteContract.floorplanRevisionId,
    sceneContractId: renderDebug.sceneContract.sceneContractId,
    geometryHash: renderDebug.sceneContract.geometryHash
  };
  const conversionActionSet = buildV1BetaConversionActionSet({
    ...trace,
    generatedAt: v1BetaFixtureHarnessTimestamp
  });
  const paymentStartedMockEvent = createPaymentStartedMockEvent({
    ...trace,
    eventId: "v1-beta-fixture-payment-started-mock",
    anonymousSessionId: "session-v1-beta-fixture-harness",
    createdAt: "2026-05-16T00:00:04.000Z"
  });
  const repository = createInMemoryV1BetaEventRepository([
    createV1BetaEventFixture({
      ...trace,
      eventId: "v1-beta-fixture-flow-viewed",
      eventType: "beta_flow_viewed",
      source: "v1_beta_flow_shell",
      anonymousSessionId: "session-v1-beta-fixture-harness",
      metadata: { surface: "fixture-harness" },
      createdAt: "2026-05-16T00:00:00.000Z"
    }),
    createV1BetaEventFixture({
      ...trace,
      eventId: "v1-beta-fixture-scheme-viewed",
      eventType: "scheme_page_viewed",
      source: "scheme_page_shell",
      anonymousSessionId: "session-v1-beta-fixture-harness",
      createdAt: "2026-05-16T00:00:01.000Z"
    }),
    createV1BetaEventFixture({
      ...trace,
      eventId: "v1-beta-fixture-render-status-opened",
      eventType: "render_room_status_opened",
      source: "render_status_shell",
      anonymousSessionId: "session-v1-beta-fixture-harness",
      stageId: "render_review",
      roomId: renderStatusShell.rooms[0]?.roomId,
      createdAt: "2026-05-16T00:00:02.000Z"
    }),
    createV1BetaEventFixture({
      ...trace,
      eventId: "v1-beta-fixture-decor-match-viewed",
      eventType: "beta_stage_viewed",
      source: "fixture",
      anonymousSessionId: "session-v1-beta-fixture-harness",
      stageId: "decor_matching",
      roomId: softDecorPlan.rooms[0]?.roomId,
      createdAt: "2026-05-16T00:00:03.000Z"
    }),
    paymentStartedMockEvent
  ]);
  const flow = buildHarnessFlow({
    trace,
    roomCount: schemePageViewModel.coverage.totalRooms,
    renderCandidateCount: renderStatusShell.summary.eligibleCandidateCount,
    renderIssueCount: renderStatusShell.summary.roomsNeedingHumanReview + renderStatusShell.summary.roomsFailed,
    verifiedSkuCount: verifiedSkuCatalog.verifiedSkus.length,
    softDecorRoomCount: softDecorPlan.rooms.length,
    softDecorWarningCount: softDecorPlan.rooms.reduce((count, room) => count + room.warnings.length, 0),
    conversionActionCount: conversionActionSet.actions.length
  });
  const hardStopCount = 0;

  return deepFreeze(V1BetaFixtureHarnessPayloadSchema.parse({
    version: "0.1",
    source: "deterministic_beta_fixture_harness",
    scenario: "beta_ready_all_pass",
    trace,
    flow,
    schemePageViewModel,
    renderStatusShell,
    renderGalleryViewModel: renderDebug.galleryViewModel,
    creativeRenderSpecBatch: renderDebug.creativeRenderSpecBatch,
    verifiedSkuCatalog,
    softDecorPlan,
    conversionActionSet,
    events: repository.list(),
    eventSummary: repository.summarize(),
    guardrails: {
      deterministicFixturesOnly: true,
      adsRuntimeConsumed: false,
      adsSnapshotRuntimeConsumed: false,
      humanReviewRuntimeConsumed: false,
      providerRegistryUsed: false,
      realProviderEnabled: false,
      networkCallsEnabled: false,
      confirmedGeometryMutable: false,
      liveCommerceEnabled: false,
      pdfConstructionScopeEnabled: false
    },
    summary: {
      flowStageCount: flow.stages.length,
      schemeRoomCount: schemePageViewModel.rooms.length,
      renderStatusRoomCount: renderStatusShell.rooms.length,
      renderEligibleRoomCount: renderStatusShell.summary.roomsWithEligibleRender,
      creativeRenderSpecCount: renderDebug.creativeRenderSpecBatch.specs.length,
      verifiedSkuCount: verifiedSkuCatalog.verifiedSkus.length,
      softDecorRoomCount: softDecorPlan.rooms.length,
      conversionActionCount: conversionActionSet.actions.length,
      eventCount: repository.list().length,
      hardStopCount,
      readyForBetaHarness: hardStopCount === 0
    },
    generatedAt: v1BetaFixtureHarnessTimestamp
  }));
}

export function evaluateV1BetaReleaseGate(
  rawHarness: unknown = buildV1BetaFixtureHarness()
): V1BetaReleaseGateReport {
  const parsed = V1BetaFixtureHarnessPayloadSchema.safeParse(clone(rawHarness));
  if (!parsed.success) {
    const checks = [
      fail("release-gate-schema-valid", `Fixture harness schema validation failed with ${parsed.error.issues.length} issue(s).`)
    ];
    return releaseGateReport({
      trace: INVALID_RELEASE_GATE_TRACE,
      checks
    });
  }

  const harness = parsed.data;
  const checks = [
    check(
      "release-gate-deterministic-fixtures",
      harness.guardrails.deterministicFixturesOnly,
      "Harness uses deterministic fixtures only."
    ),
    check(
      "release-gate-no-ads-runtime",
      !harness.guardrails.adsRuntimeConsumed && !harness.guardrails.adsSnapshotRuntimeConsumed,
      "Harness does not consume Track B ADS runtime or snapshot routes."
    ),
    check(
      "release-gate-no-human-review-runtime",
      !harness.guardrails.humanReviewRuntimeConsumed,
      "Harness does not consume human review runtime routes."
    ),
    check(
      "release-gate-no-provider",
      !harness.guardrails.providerRegistryUsed && !harness.guardrails.realProviderEnabled,
      "Harness does not use provider registry or real providers."
    ),
    check(
      "release-gate-no-network",
      !harness.guardrails.networkCallsEnabled,
      "Harness does not use network calls."
    ),
    check(
      "release-gate-readonly-geometry",
      !harness.guardrails.confirmedGeometryMutable,
      "Harness keeps confirmed geometry read-only."
    ),
    check(
      "release-gate-no-live-commerce",
      !harness.guardrails.liveCommerceEnabled,
      "Harness keeps commerce actions mock-only."
    ),
    check(
      "release-gate-no-pdf-construction",
      !harness.guardrails.pdfConstructionScopeEnabled,
      "Harness does not include PDF or construction scope."
    ),
    check(
      "release-gate-zero-hard-stops",
      harness.summary.hardStopCount === 0,
      "Harness has zero hard stops."
    ),
    check(
      "release-gate-full-room-render-status",
      harness.summary.renderStatusRoomCount === harness.summary.schemeRoomCount,
      "Render status shell covers every Scheme Page room."
    ),
    check(
      "release-gate-creative-spec-coverage",
      harness.summary.creativeRenderSpecCount >= harness.summary.schemeRoomCount,
      "CreativeRenderSpec fixtures cover every Scheme Page room."
    ),
    check(
      "release-gate-no-failed-gallery-state",
      harness.renderGalleryViewModel.summary.roomsFailed === 0 && harness.renderGalleryViewModel.summary.roomsMissingCoverage === 0,
      "Render gallery fixture has no failed or missing room coverage."
    ),
    check(
      "release-gate-verified-skus",
      harness.summary.verifiedSkuCount > 0,
      "VerifiedSku admission produced local fixture SKUs."
    ),
    check(
      "release-gate-soft-decor-full-space",
      harness.summary.softDecorRoomCount === harness.summary.schemeRoomCount,
      "Soft Decor GPS Lite covers every Scheme Page room."
    ),
    check(
      "release-gate-payment-mock-event",
      harness.events.some((event) => event.eventType === "payment_started_mock") &&
        harness.conversionActionSet.actions.some((action) => action.type === "payment_started_mock"),
      "Conversion intent includes payment_started_mock action and event only."
    )
  ];

  return releaseGateReport({
    trace: harness.trace,
    checks
  });
}

function buildHarnessFlow(input: {
  trace: {
    homeId: string;
    schemeId: string;
    floorplanRevisionId: string;
    sceneContractId: string;
    geometryHash: string;
  };
  roomCount: number;
  renderCandidateCount: number;
  renderIssueCount: number;
  verifiedSkuCount: number;
  softDecorRoomCount: number;
  softDecorWarningCount: number;
  conversionActionCount: number;
}) {
  const stages: V1BetaFlowStage[] = [
    {
      stageId: "floorplan_upload",
      status: "complete",
      label: "Floorplan upload",
      summary: "Deterministic fixture home is available for beta readiness checks.",
      itemCount: 1,
      issueCount: 0
    },
    {
      stageId: "space_confirmation",
      status: "complete",
      label: "Space confirmation",
      summary: "Fixture geometry is treated as read-only downstream trace context.",
      itemCount: input.roomCount,
      issueCount: 0
    },
    {
      stageId: "scheme_review",
      status: "complete",
      label: "Scheme review",
      summary: "Scheme Page view model covers every fixture room.",
      primaryHref: "/dev/scheme-page-debug",
      itemCount: input.roomCount,
      issueCount: 0
    },
    {
      stageId: "render_review",
      status: input.renderIssueCount === 0 ? "complete" : "needs_review",
      label: "Room visual review",
      summary: "Render status comes from deterministic gallery view models only.",
      primaryHref: "/dev/render-gallery-debug",
      itemCount: input.renderCandidateCount,
      issueCount: input.renderIssueCount
    },
    {
      stageId: "decor_matching",
      status: "complete",
      label: "Decor matching",
      summary: "Soft Decor GPS Lite uses admitted local fixture SKUs only.",
      primaryHref: "/dev/soft-decor-gps-lite-debug",
      itemCount: input.verifiedSkuCount + input.softDecorRoomCount,
      issueCount: input.softDecorWarningCount
    },
    {
      stageId: "conversion_intent",
      status: "current",
      label: "Conversion intent",
      summary: "Conversion actions emit mock events only.",
      primaryHref: "/dev/v1-beta-conversions-debug",
      itemCount: input.conversionActionCount,
      issueCount: 0
    }
  ];

  return V1BetaFlowViewModelSchema.parse({
    version: "0.1",
    source: "deterministic_fixture",
    ...input.trace,
    title: "homeAI V1 Beta deterministic harness",
    summary: buildFlowSummary(stages),
    stages,
    guardrails: {
      deterministicFixturesOnly: true,
      adsRuntimeConsumed: false,
      realProviderEnabled: false,
      networkCallsEnabled: false,
      confirmedGeometryMutable: false,
      downstreamCommerceEnabled: false
    },
    generatedAt: v1BetaFixtureHarnessTimestamp
  });
}

function buildFlowSummary(stages: readonly V1BetaFlowStage[]) {
  const currentStage = stages.find((stage) => stage.status === "current");
  if (currentStage === undefined) {
    throw new Error("Expected one current V1 Beta fixture stage.");
  }
  const needsReviewStages = stages.filter((stage) => stage.status === "needs_review").length;

  return {
    totalStages: stages.length,
    completeStages: stages.filter((stage) => stage.status === "complete").length,
    readyStages: stages.filter((stage) => stage.status === "ready").length,
    lockedStages: stages.filter((stage) => stage.status === "locked").length,
    needsReviewStages,
    currentStageId: currentStage.stageId,
    status: needsReviewStages > 0 ? "needs_review" : "ready_for_next_batch"
  };
}

function releaseGateReport(input: {
  trace: V1BetaFixtureHarnessPayload["trace"];
  checks: V1BetaReleaseGateCheck[];
}): V1BetaReleaseGateReport {
  const failedCheckCount = input.checks.filter((candidate) => candidate.status === "fail").length;
  return deepFreeze(V1BetaReleaseGateReportSchema.parse({
    version: "0.1",
    source: "deterministic_beta_release_gate",
    scenario: "beta_ready_all_pass",
    status: failedCheckCount === 0 ? "pass" : "fail",
    trace: input.trace,
    checks: input.checks,
    failedCheckCount,
    generatedAt: v1BetaFixtureHarnessTimestamp
  }));
}

function check(checkId: string, passes: boolean, message: string): V1BetaReleaseGateCheck {
  return {
    checkId,
    status: passes ? "pass" : "fail",
    message
  };
}

function fail(checkId: string, message: string): V1BetaReleaseGateCheck {
  return check(checkId, false, message);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
