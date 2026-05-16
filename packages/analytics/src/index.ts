import {
  V1BetaEventDebugPayloadSchema,
  V1BetaEventIntakeRequestSchema,
  V1BetaEventIntakeResponseSchema,
  V1BetaEventSchema,
  V1BetaEventSummarySchema,
  V1BetaEventTypeSchema,
  V1BetaConversionDebugPayloadSchema,
  V1BetaConversionActionSetSchema,
  type V1BetaEvent,
  type V1BetaConversionActionSet,
  type V1BetaConversionDebugPayload,
  type V1BetaEventDebugPayload,
  type V1BetaEventIntakeRequest,
  type V1BetaEventIntakeResponse,
  type V1BetaEventSummary,
  type V1BetaEventType
} from "@homeai/contracts";

export interface V1BetaEventRepository {
  record(event: V1BetaEvent): V1BetaEvent;
  recordMany(request: V1BetaEventIntakeRequest): V1BetaEventIntakeResponse;
  list(): V1BetaEvent[];
  summarize(): V1BetaEventSummary;
  clear(): void;
}

export const v1BetaEventFixtureTimestamp = "2026-05-16T00:00:00.000Z";
export const v1BetaEventFixtureGeometryHash = `sha256:${"8".repeat(64)}`;

export function createInMemoryV1BetaEventRepository(
  initialEvents: readonly V1BetaEvent[] = []
): V1BetaEventRepository {
  const eventsById = new Map<string, V1BetaEvent>();

  const repository: V1BetaEventRepository = {
    record(event) {
      const parsed = V1BetaEventSchema.parse(clone(event));
      eventsById.set(parsed.eventId, parsed);
      return clone(parsed);
    },
    recordMany(request) {
      const parsed = V1BetaEventIntakeRequestSchema.parse(clone(request));
      for (const event of parsed.events) {
        repository.record(event);
      }
      const summary = repository.summarize();

      return V1BetaEventIntakeResponseSchema.parse({
        ok: true,
        acceptedCount: parsed.events.length,
        totalStored: eventsById.size,
        summary
      });
    },
    list() {
      return [...eventsById.values()]
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.eventId.localeCompare(right.eventId))
        .map((event) => clone(event));
    },
    summarize() {
      return summarizeV1BetaEvents(repository.list());
    },
    clear() {
      eventsById.clear();
    }
  };

  if (initialEvents.length > 0) {
    repository.recordMany({ events: [...initialEvents] });
  }
  return repository;
}

export function summarizeV1BetaEvents(events: readonly V1BetaEvent[]): V1BetaEventSummary {
  const parsedEvents = events.map((event) => V1BetaEventSchema.parse(clone(event)));
  const eventTypes = Object.fromEntries(
    V1BetaEventTypeSchema.options.map((eventType) => [
      eventType,
      parsedEvents.filter((event) => event.eventType === eventType).length
    ])
  ) as Record<V1BetaEventType, number>;

  return V1BetaEventSummarySchema.parse({
    totalEvents: parsedEvents.length,
    uniqueSessions: new Set(parsedEvents.map((event) => event.anonymousSessionId)).size,
    eventTypes
  });
}

export function createV1BetaEventFixture(
  overrides: Partial<V1BetaEvent> = {}
): V1BetaEvent {
  return V1BetaEventSchema.parse({
    eventId: "v1-beta-event-flow-viewed",
    eventType: "beta_flow_viewed",
    source: "fixture",
    anonymousSessionId: "session-v1-beta-fixture",
    homeId: "home-beta-flow-fixture",
    schemeId: "scheme-beta-flow-fixture",
    floorplanRevisionId: "canonical-beta-flow-fixture",
    sceneContractId: "scene-beta-flow-fixture",
    geometryHash: v1BetaEventFixtureGeometryHash,
    metadata: {
      surface: "beta-flow"
    },
    createdAt: v1BetaEventFixtureTimestamp,
    ...overrides
  });
}

export function buildV1BetaEventDebugFixture(): V1BetaEventDebugPayload {
  const repository = createInMemoryV1BetaEventRepository([
    createV1BetaEventFixture(),
    createV1BetaEventFixture({
      eventId: "v1-beta-event-stage-viewed",
      eventType: "beta_stage_viewed",
      stageId: "render_review",
      source: "v1_beta_flow_shell",
      createdAt: "2026-05-16T00:00:01.000Z"
    }),
    createV1BetaEventFixture({
      eventId: "v1-beta-event-scheme-viewed",
      eventType: "scheme_page_viewed",
      source: "scheme_page_shell",
      createdAt: "2026-05-16T00:00:02.000Z"
    }),
    createV1BetaEventFixture({
      eventId: "v1-beta-event-render-room-opened",
      eventType: "render_room_status_opened",
      source: "render_status_shell",
      stageId: "render_review",
      roomId: "room-living",
      createdAt: "2026-05-16T00:00:03.000Z"
    })
  ]);

  return V1BetaEventDebugPayloadSchema.parse({
    ok: true,
    events: repository.list(),
    summary: repository.summarize(),
    generatedAt: v1BetaEventFixtureTimestamp
  });
}

export function buildV1BetaConversionActionSet(input: {
  homeId: string;
  schemeId: string;
  floorplanRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  generatedAt?: string;
}): V1BetaConversionActionSet {
  return V1BetaConversionActionSetSchema.parse({
    version: "0.1",
    source: "mock_only",
    homeId: input.homeId,
    schemeId: input.schemeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    actions: [
      {
        actionId: "conversion-save-plan-mock",
        type: "save_plan_mock",
        label: "Save plan",
        status: "enabled_mock",
        requiresRealPaymentProvider: false,
        summary: "Records local beta intent only."
      },
      {
        actionId: "conversion-share-plan-mock",
        type: "share_plan_mock",
        label: "Share plan",
        status: "enabled_mock",
        requiresRealPaymentProvider: false,
        summary: "Produces no external share request."
      },
      {
        actionId: "conversion-contact-request-mock",
        type: "contact_request_mock",
        label: "Request contact",
        status: "enabled_mock",
        requiresRealPaymentProvider: false,
        summary: "Captures no personal contact fields in Batch 22."
      },
      {
        actionId: "conversion-payment-started-mock",
        type: "payment_started_mock",
        label: "Start payment mock",
        status: "enabled_mock",
        eventType: "payment_started_mock",
        requiresRealPaymentProvider: false,
        summary: "Creates a payment_started_mock event only."
      }
    ],
    generatedAt: input.generatedAt ?? v1BetaEventFixtureTimestamp
  });
}

export function createPaymentStartedMockEvent(input: {
  eventId?: string;
  anonymousSessionId: string;
  homeId: string;
  schemeId: string;
  floorplanRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  createdAt?: string;
}): V1BetaEvent {
  return V1BetaEventSchema.parse({
    eventId: input.eventId ?? "v1-beta-event-payment-started-mock",
    eventType: "payment_started_mock",
    source: "conversion_action_shell",
    anonymousSessionId: input.anonymousSessionId,
    homeId: input.homeId,
    schemeId: input.schemeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    stageId: "conversion_intent",
    metadata: {
      mode: "mock",
      actionId: "conversion-payment-started-mock"
    },
    createdAt: input.createdAt ?? v1BetaEventFixtureTimestamp
  });
}

export function buildV1BetaConversionDebugFixture(): V1BetaConversionDebugPayload {
  const base = {
    homeId: "home-beta-flow-fixture",
    schemeId: "scheme-beta-flow-fixture",
    floorplanRevisionId: "canonical-beta-flow-fixture",
    sceneContractId: "scene-beta-flow-fixture",
    geometryHash: v1BetaEventFixtureGeometryHash
  };
  const actionSet = buildV1BetaConversionActionSet(base);
  const paymentStartedMockEvent = createPaymentStartedMockEvent({
    ...base,
    anonymousSessionId: "session-v1-beta-fixture"
  });

  return V1BetaConversionDebugPayloadSchema.parse({
    ok: true,
    actionSet,
    paymentStartedMockEvent,
    generatedAt: v1BetaEventFixtureTimestamp
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
