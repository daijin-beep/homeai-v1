import {
  V1BetaFixtureHarnessPayloadSchema,
  V1BetaFlowViewModelSchema,
  type V1BetaFixtureHarnessPayload,
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
