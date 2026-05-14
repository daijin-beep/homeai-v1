import { describe, expect, it } from "vitest";
import {
  buildMockRenderCandidates,
  buildMockRenderVerificationReports,
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput
} from "@homeai/render-pipeline";

describe("RenderVerificationReport mock builder", () => {
  it("builds pass reports for all-pass scenario", () => {
    const { reports } = reportsForScenario("all_pass");

    expect(reports.every((report) => report.status === "pass")).toBe(true);
    expect(reports.every((report) => report.trace.networkCalls === false)).toBe(true);
  });

  it("fails when windows or doors are not preserved", () => {
    const windowFail = reportsForScenario("one_window_missing_fail").reports[0];
    const doorFail = reportsForScenario("one_door_blocked_fail").reports[0];

    expect(windowFail?.status).toBe("fail");
    expect(windowFail?.l1Checks.find((check) => check.checkType === "windows_preserved")?.status).toBe("fail");
    expect(doorFail?.status).toBe("fail");
    expect(doorFail?.l1Checks.find((check) => check.checkType === "doors_preserved")?.status).toBe("fail");
  });

  it("uses warning status for anchor zone review scenario", () => {
    const report = reportsForScenario("one_anchor_zone_warning").reports[0];

    expect(report?.status).toBe("warning");
    expect(report?.humanReview?.required).toBe(true);
  });
});

function reportsForScenario(scenario: Parameters<typeof buildMockRenderVerificationReports>[0]["scenario"]) {
  const fixture = createRenderLifecycleFixtureInput();
  const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
  const candidates = buildMockRenderCandidates({ renderJob, creativeRenderSpecs: fixture.creativeRenderSpecs });
  const reports = buildMockRenderVerificationReports({
    renderJob,
    candidates,
    creativeRenderSpecs: fixture.creativeRenderSpecs,
    scenario
  });
  return { reports };
}
