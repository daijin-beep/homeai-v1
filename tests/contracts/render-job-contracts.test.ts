import { describe, expect, it } from "vitest";
import {
  GalleryEligibilityDecisionSchema,
  RenderCandidateSchema,
  RenderJobSchema,
  RenderVerificationReportSchema
} from "@homeai/contracts";
import {
  buildMockRenderCandidates,
  buildMockRenderVerificationReports,
  buildRenderLifecycleDebugFixture
} from "@homeai/render-pipeline";

describe("Render lifecycle contracts", () => {
  it("validates RenderJob objects", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");

    expect(RenderJobSchema.safeParse(fixture.renderJob).success).toBe(true);
  });

  it("rejects malformed RenderJob status", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");

    expect(RenderJobSchema.safeParse({
      ...fixture.renderJob,
      status: "done"
    }).success).toBe(false);
  });

  it("rejects RenderCandidate without renderSpecId", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidate = fixture.candidates[0];
    if (candidate === undefined) {
      throw new Error("Expected candidate.");
    }

    expect(RenderCandidateSchema.safeParse({
      ...candidate,
      renderSpecId: undefined
    }).success).toBe(false);
  });

  it("rejects malformed RenderVerificationReport l1 checks", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const report = fixture.verificationReports[0];
    if (report === undefined) {
      throw new Error("Expected verification report.");
    }

    expect(RenderVerificationReportSchema.safeParse({
      ...report,
      l1Checks: [
        {
          checkType: "geometry_hash_match",
          status: "maybe",
          severity: "blocking",
          message: "bad"
        }
      ]
    }).success).toBe(false);
  });

  it("rejects invalid GalleryEligibilityDecision status", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const decision = fixture.galleryEligibility[0];
    if (decision === undefined) {
      throw new Error("Expected gallery eligibility decision.");
    }

    expect(GalleryEligibilityDecisionSchema.safeParse({
      ...decision,
      status: "gallery"
    }).success).toBe(false);
  });

  it("keeps mock builders contract-valid", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidates = buildMockRenderCandidates({
      renderJob: fixture.renderJob,
      creativeRenderSpecs: fixture.creativeRenderSpecs
    });
    const reports = buildMockRenderVerificationReports({
      renderJob: fixture.renderJob,
      candidates,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      scenario: "all_pass"
    });

    expect(candidates.every((candidate) => RenderCandidateSchema.safeParse(candidate).success)).toBe(true);
    expect(reports.every((report) => RenderVerificationReportSchema.safeParse(report).success)).toBe(true);
  });
});
