import { describe, expect, it } from "vitest";
import {
  buildMockRenderCandidates,
  buildMockRenderVerificationReports,
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput,
  evaluateGalleryEligibility
} from "@homeai/render-pipeline";

describe("Gallery eligibility evaluator", () => {
  it("marks pass reports eligible", () => {
    const { candidate, report } = fixtureCandidateAndReport("all_pass");

    expect(evaluateGalleryEligibility({ candidate, verificationReport: report }).status).toBe("eligible");
  });

  it("marks warning reports for human review", () => {
    const { candidate, report } = fixtureCandidateAndReport("one_anchor_zone_warning");

    expect(evaluateGalleryEligibility({ candidate, verificationReport: report }).status).toBe("human_review_required");
  });

  it("blocks failed reports", () => {
    const { candidate, report } = fixtureCandidateAndReport("one_window_missing_fail");

    expect(evaluateGalleryEligibility({ candidate, verificationReport: report }).status).toBe("blocked_failed_verification");
  });

  it("blocks missing reports", () => {
    const { candidate } = fixtureCandidateAndReport("all_pass");

    expect(evaluateGalleryEligibility({ candidate }).status).toBe("blocked_pending_verification");
  });

  it("blocks missing assets", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const candidates = buildMockRenderCandidates({
      renderJob,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      mode: "missing_asset_for_one_room"
    });
    const reports = buildMockRenderVerificationReports({
      renderJob,
      candidates,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      scenario: "one_missing_asset_fail"
    });

    expect(evaluateGalleryEligibility({ candidate: requireFirst(candidates), verificationReport: requireFirst(reports) }).status)
      .toBe("blocked_missing_asset");
  });

  it("blocks geometry mismatches", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const candidates = buildMockRenderCandidates({
      renderJob,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      mode: "geometry_mismatch_for_one_candidate"
    });
    const reports = buildMockRenderVerificationReports({
      renderJob,
      candidates,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      scenario: "one_geometry_hash_mismatch_fail"
    });

    expect(evaluateGalleryEligibility({ candidate: requireFirst(candidates), verificationReport: requireFirst(reports) }).status)
      .toBe("blocked_geometry_mismatch");
  });
});

function fixtureCandidateAndReport(scenario: Parameters<typeof buildMockRenderVerificationReports>[0]["scenario"]) {
  const fixture = createRenderLifecycleFixtureInput();
  const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
  const candidates = buildMockRenderCandidates({ renderJob, creativeRenderSpecs: fixture.creativeRenderSpecs });
  const reports = buildMockRenderVerificationReports({
    renderJob,
    candidates,
    creativeRenderSpecs: fixture.creativeRenderSpecs,
    scenario
  });
  return {
    candidate: requireFirst(candidates),
    report: requireFirst(reports)
  };
}

function requireFirst<T>(values: T[]): T {
  const first = values[0];
  if (first === undefined) {
    throw new Error("Expected at least one value.");
  }
  return first;
}
