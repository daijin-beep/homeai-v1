import { describe, expect, it } from "vitest";
import { V1BetaFixtureHarnessPayloadSchema } from "@homeai/contracts";
import { buildV1BetaFixtureHarness } from "@homeai/v1-beta-fixtures";

describe("V1 Beta fixture harness contract", () => {
  it("validates the deterministic beta harness payload", () => {
    const payload = buildV1BetaFixtureHarness();
    const parsed = V1BetaFixtureHarnessPayloadSchema.parse(payload);

    expect(parsed.source).toBe("deterministic_beta_fixture_harness");
    expect(parsed.summary.readyForBetaHarness).toBe(true);
    expect(parsed.guardrails.realProviderEnabled).toBe(false);
    expect(parsed.guardrails.confirmedGeometryMutable).toBe(false);
  });

  it("rejects trace drift across included beta artifacts", () => {
    const payload = buildV1BetaFixtureHarness();

    expect(() =>
      V1BetaFixtureHarnessPayloadSchema.parse({
        ...payload,
        softDecorPlan: {
          ...payload.softDecorPlan,
          geometryHash: `sha256:${"9".repeat(64)}`
        }
      })
    ).toThrow(/trace must match/);
  });

  it("rejects stale summary counts", () => {
    const payload = buildV1BetaFixtureHarness();

    expect(() =>
      V1BetaFixtureHarnessPayloadSchema.parse({
        ...payload,
        summary: {
          ...payload.summary,
          eventCount: payload.summary.eventCount + 1
        }
      })
    ).toThrow(/eventCount must match/);
  });
});
