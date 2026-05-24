import { describe, expect, it } from "vitest";
import {
  V1BetaEventDebugPayloadSchema,
  V1BetaEventIntakeRequestSchema,
  V1BetaEventSchema,
  V1BetaEventSummarySchema,
  type V1BetaEvent,
} from "@homeai/contracts";

const timestamp = "2026-05-16T00:00:00.000Z";
const geometryHash = `sha256:${"8".repeat(64)}`;

describe("V1 Beta event contracts", () => {
  it("validates a beta flow event with geometry trace", () => {
    const event = createEvent();

    expect(V1BetaEventSchema.safeParse(event).success).toBe(
      true,
    );
    expect(event.geometryHash).toBe(geometryHash);
  });

  it("requires stageId and roomId for stage and room-specific events", () => {
    expect(
      V1BetaEventSchema.safeParse(
        createEventInput({
          eventId: "event-stage",
          eventType: "beta_stage_viewed",
          stageId: "render_review",
        }),
      ).success,
    ).toBe(true);
    expect(
      V1BetaEventSchema.safeParse(
        createEventInput({
          eventId: "event-stage-missing",
          eventType: "beta_stage_viewed",
        }),
      ).success,
    ).toBe(false);
    expect(
      V1BetaEventSchema.safeParse(
        createEventInput({
          eventId: "event-room-missing",
          eventType: "render_room_status_opened",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects unnecessary PII metadata", () => {
    expect(
      V1BetaEventSchema.safeParse(
        createEventInput({
          metadata: {
            email: "person@example.com",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("validates intake and debug response payloads", () => {
    const events = [
      createEvent(),
      createEvent({
        eventId: "event-render-status",
        eventType: "render_status_viewed",
        source: "render_status_shell",
      }),
    ];
    const summary = {
      totalEvents: 2,
      uniqueSessions: 1,
      eventTypes: {
        beta_flow_viewed: 1,
        beta_stage_viewed: 0,
        scheme_page_viewed: 0,
        render_status_viewed: 1,
        render_room_status_opened: 0,
        decor_matching_locked_viewed: 0,
        conversion_intent_locked_viewed: 0,
      },
    };

    expect(
      V1BetaEventIntakeRequestSchema.safeParse({ events })
        .success,
    ).toBe(true);
    expect(
      V1BetaEventSummarySchema.safeParse(summary).success,
    ).toBe(true);
    expect(
      V1BetaEventDebugPayloadSchema.safeParse({
        ok: true,
        events,
        summary,
        generatedAt: timestamp,
      }).success,
    ).toBe(true);
  });
});

function createEvent(
  overrides: Partial<V1BetaEvent> = {},
): V1BetaEvent {
  return V1BetaEventSchema.parse(
    createEventInput(overrides),
  );
}

function createEventInput(
  overrides: Partial<V1BetaEvent> = {},
) {
  return {
    eventId: "event-flow-viewed",
    eventType: "beta_flow_viewed",
    source: "v1_beta_flow_shell",
    anonymousSessionId: "session-v1-beta",
    homeId: "home-v1-beta",
    schemeId: "scheme-v1-beta",
    floorplanRevisionId: "canonical-v1-beta",
    sceneContractId: "scene-v1-beta",
    geometryHash,
    metadata: {
      surface: "beta-flow",
    },
    createdAt: timestamp,
    ...overrides,
  };
}
