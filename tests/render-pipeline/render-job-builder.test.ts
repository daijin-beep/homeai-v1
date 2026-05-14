import { describe, expect, it } from "vitest";
import {
  buildMockRenderCandidates,
  buildMockRenderVerificationReports,
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput,
  evaluateGalleryEligibility
} from "@homeai/render-pipeline";

describe("RenderJob builder", () => {
  it("builds lifecycle counts from candidates, reports, and gallery eligibility", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const initialJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const candidates = buildMockRenderCandidates({ renderJob: initialJob, creativeRenderSpecs: fixture.creativeRenderSpecs });
    const reports = buildMockRenderVerificationReports({
      renderJob: initialJob,
      candidates,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      scenario: "all_pass"
    });
    const decisions = candidates.map((candidate) =>
      evaluateGalleryEligibility({
        candidate,
        verificationReport: reports.find((report) => report.renderCandidateId === candidate.renderCandidateId)
      })
    );
    const completedJob = buildRenderJobFromCreativeRenderSpecs({
      ...fixture,
      candidates,
      verificationReports: reports,
      galleryEligibility: decisions
    });

    expect(completedJob.status).toBe("completed");
    expect(completedJob.coverage.totalCandidateCount).toBe(candidates.length);
    expect(completedJob.coverage.totalVerificationReportCount).toBe(reports.length);
    expect(completedJob.coverage.galleryEligibleCandidateCount).toBe(candidates.length);
  });

  it("does not mutate inputs", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const snapshot = JSON.stringify(fixture);

    buildRenderJobFromCreativeRenderSpecs(fixture);

    expect(JSON.stringify(fixture)).toBe(snapshot);
  });
});
