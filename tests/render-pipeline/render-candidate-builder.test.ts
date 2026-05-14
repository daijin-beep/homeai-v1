import { describe, expect, it } from "vitest";
import {
  buildMockRenderCandidates,
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput
} from "@homeai/render-pipeline";

describe("RenderCandidate mock builder", () => {
  it("builds one candidate per CreativeRenderSpec without external calls", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const candidates = buildMockRenderCandidates({ renderJob, creativeRenderSpecs: fixture.creativeRenderSpecs });

    expect(candidates).toHaveLength(fixture.creativeRenderSpecs.length);
    expect(candidates.every((candidate) => candidate.trace.networkCalls === false)).toBe(true);
    expect(candidates.every((candidate) => candidate.provider.providerKind === "mock")).toBe(true);
  });

  it("can produce deterministic missing asset and geometry mismatch candidates", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);
    const missingAsset = buildMockRenderCandidates({
      renderJob,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      mode: "missing_asset_for_one_room"
    });
    const geometryMismatch = buildMockRenderCandidates({
      renderJob,
      creativeRenderSpecs: fixture.creativeRenderSpecs,
      mode: "geometry_mismatch_for_one_candidate"
    });

    expect(missingAsset[0]?.output.imageUrl).toBeUndefined();
    expect(missingAsset[0]?.galleryEligibility).toBe("blocked_missing_asset");
    expect(geometryMismatch[0]?.geometryHash).not.toBe(renderJob.geometryHash);
    expect(geometryMismatch[0]?.galleryEligibility).toBe("blocked_geometry_mismatch");
  });
});
