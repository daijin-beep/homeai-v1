import { describe, expect, it } from "vitest";
import {
  buildV1BetaConversionDebugFixture,
  createPaymentStartedMockEvent
} from "@homeai/analytics";

describe("V1 Beta conversion mock events", () => {
  it("creates a payment_started_mock event with trace fields", () => {
    const event = createPaymentStartedMockEvent({
      eventId: "event-payment-started-test",
      anonymousSessionId: "session-test",
      homeId: "home-test",
      schemeId: "scheme-test",
      floorplanRevisionId: "canonical-test",
      sceneContractId: "scene-test",
      geometryHash: `sha256:${"9".repeat(64)}`
    });

    expect(event.eventType).toBe("payment_started_mock");
    expect(event.source).toBe("conversion_action_shell");
    expect(event.metadata?.mode).toBe("mock");
  });

  it("builds mock-only conversion debug fixture", () => {
    const debug = buildV1BetaConversionDebugFixture();

    expect(debug.actionSet.actions.some((action) => action.type === "payment_started_mock")).toBe(true);
    expect(debug.paymentStartedMockEvent.geometryHash).toBe(debug.actionSet.geometryHash);
  });
});
