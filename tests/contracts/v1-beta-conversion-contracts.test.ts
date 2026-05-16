import { describe, expect, it } from "vitest";
import {
  V1BetaConversionActionSchema,
  V1BetaConversionDebugPayloadSchema
} from "@homeai/contracts";
import { buildV1BetaConversionDebugFixture } from "@homeai/analytics";

describe("V1 Beta conversion contracts", () => {
  it("validates mock-only conversion actions and payment event", () => {
    const debug = buildV1BetaConversionDebugFixture();

    expect(V1BetaConversionDebugPayloadSchema.safeParse(debug).success).toBe(true);
    expect(debug.actionSet.source).toBe("mock_only");
    expect(debug.actionSet.actions.every((action) => action.requiresRealPaymentProvider === false)).toBe(true);
    expect(debug.paymentStartedMockEvent.eventType).toBe("payment_started_mock");
  });

  it("rejects payment mock action without payment mock event type", () => {
    expect(V1BetaConversionActionSchema.safeParse({
      actionId: "bad-payment-action",
      type: "payment_started_mock",
      label: "Bad action",
      status: "enabled_mock",
      requiresRealPaymentProvider: false,
      summary: "Invalid action."
    }).success).toBe(false);
  });
});
