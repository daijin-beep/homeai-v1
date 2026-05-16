import { describe, expect, it } from "vitest";
import {
  buildV1BetaFixtureHarness,
  evaluateV1BetaReleaseGate
} from "@homeai/v1-beta-fixtures";
import { V1BetaReleaseGateReportSchema } from "@homeai/contracts";

describe("V1 Beta release gate", () => {
  it("passes the deterministic fixture harness", () => {
    const report = evaluateV1BetaReleaseGate();
    const parsed = V1BetaReleaseGateReportSchema.parse(report);

    expect(parsed.status).toBe("pass");
    expect(parsed.failedCheckCount).toBe(0);
    expect(parsed.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("fails instead of throwing when the fixture harness schema is invalid", () => {
    const harness = buildV1BetaFixtureHarness();
    const report = evaluateV1BetaReleaseGate({
      ...harness,
      guardrails: {
        ...harness.guardrails,
        realProviderEnabled: true
      }
    });

    expect(report.status).toBe("fail");
    expect(report.failedCheckCount).toBe(1);
    expect(report.checks[0]?.checkId).toBe("release-gate-schema-valid");
  });

  it("fails when fixture coverage counts drift", () => {
    const harness = buildV1BetaFixtureHarness();
    const report = evaluateV1BetaReleaseGate({
      ...harness,
      summary: {
        ...harness.summary,
        creativeRenderSpecCount: 0
      }
    });

    expect(report.status).toBe("fail");
    expect(report.checks[0]?.checkId).toBe("release-gate-schema-valid");
  });
});
