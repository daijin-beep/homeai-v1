import { describe, expect, it } from "vitest";
import {
  buildV1BetaEventDebugFixture,
  createInMemoryV1BetaEventRepository,
  createV1BetaEventFixture,
} from "@homeai/analytics";

describe("V1 Beta event repository", () => {
  it("records validated events and summarizes by type", () => {
    const repository = createInMemoryV1BetaEventRepository();
    const event = createV1BetaEventFixture();
    const response = repository.recordMany({ events: [event] });

    expect(response.acceptedCount).toBe(1);
    expect(response.totalStored).toBe(1);
    expect(response.summary.totalEvents).toBe(1);
    expect(response.summary.eventTypes.beta_flow_viewed).toBe(1);
  });

  it("deduplicates events by eventId while preserving deterministic ordering", () => {
    const repository = createInMemoryV1BetaEventRepository();
    const event = createV1BetaEventFixture();

    repository.recordMany({ events: [event, event] });

    expect(repository.list()).toHaveLength(1);
    expect(repository.list()[0]?.eventId).toBe(event.eventId);
  });

  it("rejects PII metadata through shared contract validation", () => {
    const repository = createInMemoryV1BetaEventRepository();

    expect(() =>
      repository.record(
        createV1BetaEventFixture({
          metadata: {
            phone: "123",
          },
        }),
      ),
    ).toThrow(/metadata/i);
  });

  it("builds a deterministic debug fixture", () => {
    const debug = buildV1BetaEventDebugFixture();

    expect(debug.ok).toBe(true);
    expect(debug.events.length).toBe(4);
    expect(debug.summary.totalEvents).toBe(4);
    expect(debug.summary.eventTypes.render_room_status_opened).toBe(1);
  });
});
