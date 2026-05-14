import { describe, expect, it } from "vitest";

import { buildRenderLifecycleDebugFixture, createRenderLifecycleFixtureInput } from "@homeai/render-pipeline";
import { isNotEvaluable, verifyRenderCandidate } from "@homeai/render-verifier";
import {
  RenderVerificationReportSchema,
  type CreativeRenderSpec,
  type RenderCandidate
} from "@homeai/contracts";

function pickSpec(specs: ReadonlyArray<CreativeRenderSpec>, renderSpecId: string): CreativeRenderSpec {
  const found = specs.find((spec) => spec.renderSpecId === renderSpecId);
  if (found === undefined) {
    throw new Error(`fixture missing spec ${renderSpecId}`);
  }
  return found;
}

describe("Batch 03 — verifyRenderCandidate (real deterministic L1)", () => {
  it("returns canonical RenderVerificationReport with status=pass for an aligned candidate", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidate = fixture.candidates[0];
    if (candidate === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, candidate.renderSpecId);

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: `verifier-test-pass-${candidate.renderCandidateId}`,
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    // Canonical schema check
    expect(RenderVerificationReportSchema.safeParse(report).success).toBe(true);
    expect(report.status).toBe("pass");
    expect(report.l1Checks.length).toBe(10);

    // 4 evaluable checks pass, 6 not_evaluable warnings
    const evaluable = report.l1Checks.filter((c) => !isNotEvaluable(c));
    const notEvaluable = report.l1Checks.filter((c) => isNotEvaluable(c));
    expect(evaluable.length).toBe(4);
    expect(notEvaluable.length).toBe(6);
    expect(evaluable.every((c) => c.status === "pass")).toBe(true);

    // Pass case has no retry / human review (humanReview only for warning/fail)
    expect(report.retryRecommendation).toBeUndefined();
    expect(report.humanReview).toBeUndefined();
  });

  it("returns status=fail when candidate.geometryHash drifts from spec.geometryHash", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const original = fixture.candidates[0];
    if (original === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, original.renderSpecId);
    // Mutate a clone — fixtures are frozen.
    const candidate: RenderCandidate = {
      ...JSON.parse(JSON.stringify(original)),
      // Canonical GeometryHashSchema requires `^sha256:[a-f0-9]{64}$`; use a
      // valid-hex hash that simply does not match the spec.
      geometryHash: `sha256:${"f".repeat(64)}`
    };
    candidate.trace = {
      ...candidate.trace,
      inputHashes: { ...candidate.trace.inputHashes, geometryHash: candidate.geometryHash }
    };

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-hash-drift",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(report.status).toBe("fail");
    const hashCheck = report.l1Checks.find((c) => c.checkType === "geometry_hash_match");
    expect(hashCheck?.status).toBe("fail");
    expect(hashCheck?.severity).toBe("blocking");

    // Hard fail → no retry, manual triage required
    expect(report.retryRecommendation?.recommended).toBe(false);
    expect(report.humanReview?.required).toBe(true);
  });

  it("returns status=fail when roomId mismatches", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const original = fixture.candidates[0];
    if (original === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, original.renderSpecId);
    const candidate: RenderCandidate = JSON.parse(JSON.stringify(original));
    candidate.roomId = "room-imaginary";

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-room-mismatch",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(report.status).toBe("fail");
    const check = report.l1Checks.find((c) => c.checkType === "room_id_match");
    expect(check?.status).toBe("fail");
    expect(report.retryRecommendation?.recommended).toBe(false);
  });

  it("returns status=fail when cameraId mismatches", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const original = fixture.candidates[0];
    if (original === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, original.renderSpecId);
    const candidate: RenderCandidate = JSON.parse(JSON.stringify(original));
    candidate.cameraId = "camera-ghost";

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-camera-mismatch",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(report.status).toBe("fail");
    expect(report.l1Checks.find((c) => c.checkType === "camera_id_match")?.status).toBe("fail");
  });

  it("returns status=fail when output asset is missing (and recommends retry)", () => {
    const fixture = buildRenderLifecycleDebugFixture("one_missing_asset_fail");
    // Find the candidate that the mock builder marked as missing-asset
    // (its galleryEligibility is blocked_missing_asset)
    const missingAssetCandidate = fixture.candidates.find(
      (c) => c.galleryEligibility === "blocked_missing_asset"
    );
    if (missingAssetCandidate === undefined) {
      throw new Error("fixture did not produce a missing-asset candidate");
    }
    const spec = pickSpec(fixture.creativeRenderSpecs, missingAssetCandidate.renderSpecId);

    const report = verifyRenderCandidate({
      spec,
      candidate: missingAssetCandidate,
      reportId: "verifier-test-missing-asset",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    expect(report.status).toBe("fail");
    expect(report.l1Checks.find((c) => c.checkType === "output_asset_present")?.status).toBe("fail");
    // output_asset_present is retryable (provider may produce asset next attempt)
    expect(report.retryRecommendation?.recommended).toBe(true);
    expect(report.retryRecommendation?.maxRetries).toBeGreaterThan(0);
    expect(report.humanReview?.required).toBe(true);
  });

  it("reports the 6 image-dependent checks as not_evaluable (does NOT fake pass)", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidate = fixture.candidates[0];
    if (candidate === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, candidate.renderSpecId);

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-not-evaluable",
      createdAt: "2026-05-14T00:00:00.000Z"
    });

    const notEvaluableTypes = report.l1Checks.filter(isNotEvaluable).map((c) => c.checkType).sort();
    expect(notEvaluableTypes).toEqual(
      [
        "walls_preserved",
        "doors_preserved",
        "windows_preserved",
        "room_proportion_preserved",
        "anchor_zones_preserved",
        "forbidden_region_clear"
      ].sort()
    );
    // Not-evaluable checks must encode reason via message and status="warning"
    for (const c of report.l1Checks.filter(isNotEvaluable)) {
      expect(c.status).toBe("warning");
      expect(c.severity).toBe("info");
      expect(c.message).toMatch(/^not_evaluable: missing_fixture_input/);
    }
    // Not-evaluable warnings surface on trace.warnings for visibility
    expect(report.trace.warnings.length).toBe(6);
  });

  it("verifier never reports networkCalls=true and never includes providerCalls", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidate = fixture.candidates[0];
    if (candidate === undefined) throw new Error("fixture has no candidates");
    const spec = pickSpec(fixture.creativeRenderSpecs, candidate.renderSpecId);

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-no-network",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    expect(report.trace.networkCalls).toBe(false);
    expect(report.trace.providerCalls.length).toBe(0);
  });

  it("verifies every candidate in a multi-room fixture without throwing", () => {
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    expect(fixture.candidates.length).toBeGreaterThan(0);
    for (const candidate of fixture.candidates) {
      const spec = pickSpec(fixture.creativeRenderSpecs, candidate.renderSpecId);
      const report = verifyRenderCandidate({
        spec,
        candidate,
        reportId: `multi-room-${candidate.renderCandidateId}`,
        createdAt: "2026-05-14T00:00:00.000Z"
      });
      expect(RenderVerificationReportSchema.safeParse(report).success).toBe(true);
      expect(report.status).toBe("pass");
    }
  });

  it("integrates with createRenderLifecycleFixtureInput's plain (no-debug) shape", () => {
    // Sanity that the verifier works with the non-debug fixture path too.
    // The fixture has specs but no candidates; build a minimal candidate manually.
    const input = createRenderLifecycleFixtureInput({ withLayoutIntent: true });
    const spec = input.creativeRenderSpecs[0];
    if (spec === undefined) throw new Error("fixture has no specs");

    const candidate: RenderCandidate = {
      renderCandidateId: "candidate-manual-1",
      renderJobId: "job-manual-1",
      renderSpecId: spec.renderSpecId,
      schemeId: spec.schemeId,
      roomId: spec.roomId,
      cameraId: spec.cameraId,
      geometryHash: spec.geometryHash,
      provider: {
        providerId: "mock_render_provider",
        providerKind: "mock",
        modelId: "mock",
        adapterVersion: "0.1.0"
      },
      output: {
        imageUrl: "mock://test/image.png",
        artifactHash: "hash_test_1",
        thumbnailUrl: "mock://test/thumb.png",
        width: 1024,
        height: 768,
        mimeType: "image/png"
      },
      status: "verification_pending",
      galleryEligibility: "blocked_pending_verification",
      trace: {
        traceId: "candidate-manual-1-trace",
        sourceModule: "render_candidate_builder",
        networkCalls: false,
        providerCalls: [],
        inputHashes: {
          geometryHash: spec.geometryHash,
          renderSpecHash: spec.renderSpecId,
          candidateOutputHash: "hash_test_1"
        },
        warnings: []
      },
      createdAt: "2026-05-14T00:00:00.000Z"
    };

    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "verifier-test-manual-1",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    expect(report.status).toBe("pass");
  });
});
