import { describe, expect, it } from "vitest";
import {
  buildMockRenderCandidates,
  buildMockRenderVerificationReports,
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput,
  evaluateGalleryEligibility
} from "@homeai/render-pipeline";

describe("Render lifecycle geometryHash guards", () => {
  it("blocks RenderJob when SceneContract geometryHash mismatches", () => {
    const fixture = createRenderLifecycleFixtureInput();

    expect(() => buildRenderJobFromCreativeRenderSpecs({
      ...fixture,
      sceneContract: {
        ...fixture.sceneContract,
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    })).toThrow(/SceneContract trace/);
  });

  it("blocks RenderJob when CreativeRenderSpec geometryHash mismatches", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const firstSpec = fixture.creativeRenderSpecs[0];
    if (firstSpec === undefined) {
      throw new Error("Expected render spec.");
    }

    expect(() => buildRenderJobFromCreativeRenderSpecs({
      ...fixture,
      creativeRenderSpecs: [
        {
          ...firstSpec,
          geometryHash: `sha256:${"b".repeat(64)}`
        },
        ...fixture.creativeRenderSpecs.slice(1)
      ]
    })).toThrow();
  });

  it("blocks gallery eligibility for candidate geometry mismatch", () => {
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
    const decision = evaluateGalleryEligibility({
      candidate: requireFirst(candidates),
      verificationReport: requireFirst(reports)
    });

    expect(decision.status).toBe("blocked_geometry_mismatch");
  });

  it("fails verification report for geometryHash mismatch", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const candidates = buildMockRenderCandidates({ renderJob, creativeRenderSpecs: fixture.creativeRenderSpecs });
    const reports = buildMockRenderVerificationReports({
      renderJob,
      candidates,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      scenario: "one_geometry_hash_mismatch_fail"
    });

    expect(requireFirst(reports).status).toBe("fail");
    expect(requireFirst(reports).l1Checks.find((check) => check.checkType === "geometry_hash_match")?.status).toBe("fail");
  });
});

function requireFirst<T>(values: T[]): T {
  const first = values[0];
  if (first === undefined) {
    throw new Error("Expected at least one value.");
  }
  return first;
}
