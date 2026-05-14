import { describe, expect, it } from "vitest";
import {
  buildRenderLifecycleDebugFixture,
  buildSchemeRenderGalleryViewModel,
  buildSchemeRenderGalleryDebugFixture
} from "@homeai/render-pipeline";

describe("Scheme render gallery view model builder", () => {
  it("puts only eligible decisions into eligibleCandidates", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const eligibleIds = new Set(debug.galleryViewModel.rooms.flatMap((room) =>
      room.eligibleCandidates.map((candidate) => candidate.renderCandidateId)
    ));

    expect(eligibleIds.size).toBe(debug.candidates.length);
    expect(debug.galleryViewModel.rooms.every((room) => room.renderStatus === "has_eligible_render")).toBe(true);
  });

  it("keeps failed candidates out of eligible gallery cards", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_window_missing_fail");
    const blockedIds = new Set(debug.galleryViewModel.rooms.flatMap((room) =>
      room.blockedCandidates.map((candidate) => candidate.renderCandidateId)
    ));
    const eligibleIds = new Set(debug.galleryViewModel.rooms.flatMap((room) =>
      room.eligibleCandidates.map((candidate) => candidate.renderCandidateId)
    ));

    expect(blockedIds.size).toBeGreaterThan(0);
    for (const blockedId of blockedIds) {
      expect(eligibleIds.has(blockedId)).toBe(false);
    }
  });

  it("maps warning verification to human_review_required", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_anchor_zone_warning");
    const reviewRooms = debug.galleryViewModel.rooms.filter((room) => room.renderStatus === "human_review_required");

    expect(reviewRooms).toHaveLength(1);
    expect(reviewRooms[0]?.warningCandidates[0]?.status).toBe("human_review_required");
  });

  it("blocks candidates when the verification report is missing", () => {
    const lifecycle = buildRenderLifecycleDebugFixture("all_pass");
    const firstDecision = lifecycle.galleryEligibility[0];
    if (firstDecision?.renderVerificationReportId === undefined) {
      throw new Error("Expected first decision to reference a verification report.");
    }
    const gallery = buildSchemeRenderGalleryViewModel({
      schemeLiteContract: lifecycle.schemeLiteContract,
      sceneContract: lifecycle.sceneContract,
      renderJob: lifecycle.renderJob,
      candidates: lifecycle.candidates,
      verificationReports: lifecycle.verificationReports.filter(
        (report) => report.renderVerificationReportId !== firstDecision.renderVerificationReportId
      ),
      galleryEligibility: lifecycle.galleryEligibility
    });
    const blocked = gallery.rooms.flatMap((room) => room.blockedCandidates);

    expect(blocked.some((candidate) => candidate.status === "blocked_pending_verification")).toBe(true);
  });

  it("blocks candidates with missing output assets", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_missing_asset_fail");

    expect(debug.galleryViewModel.rooms.flatMap((room) => room.blockedCandidates)
      .some((candidate) => candidate.status === "blocked_missing_asset")).toBe(true);
  });

  it("blocks candidates with geometryHash mismatches", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_geometry_hash_mismatch_fail");

    expect(debug.galleryViewModel.rooms.flatMap((room) => room.blockedCandidates)
      .some((candidate) => candidate.status === "blocked_geometry_mismatch")).toBe(true);
  });

  it("marks missing room render coverage", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("missing_room_coverage");
    const missingRooms = debug.galleryViewModel.rooms.filter((room) => room.renderStatus === "missing_coverage");

    expect(missingRooms).toHaveLength(1);
    expect(debug.galleryViewModel.summary.status).toBe("fail");
  });

  it("includes every valid SceneContract room exactly once", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const sceneRoomIds = debug.sceneContract.rooms.map((room) => room.roomId).sort();
    const galleryRoomIds = debug.galleryViewModel.rooms.map((room) => room.roomId).sort();

    expect(galleryRoomIds).toEqual(sceneRoomIds);
    expect(new Set(galleryRoomIds).size).toBe(sceneRoomIds.length);
  });

  it("does not mutate inputs and returns frozen output", () => {
    const lifecycle = buildRenderLifecycleDebugFixture("all_pass");
    const before = JSON.stringify(lifecycle);
    const gallery = buildSchemeRenderGalleryViewModel({
      schemeLiteContract: lifecycle.schemeLiteContract,
      sceneContract: lifecycle.sceneContract,
      renderJob: lifecycle.renderJob,
      candidates: lifecycle.candidates,
      verificationReports: lifecycle.verificationReports,
      galleryEligibility: lifecycle.galleryEligibility
    });

    expect(JSON.stringify(lifecycle)).toBe(before);
    expect(Object.isFrozen(gallery)).toBe(true);
    expect(Object.isFrozen(gallery.rooms[0])).toBe(true);
  });

  it("fails closed on top-level trace mismatch", () => {
    const lifecycle = buildRenderLifecycleDebugFixture("all_pass");

    expect(() =>
      buildSchemeRenderGalleryViewModel({
        schemeLiteContract: lifecycle.schemeLiteContract,
        sceneContract: lifecycle.sceneContract,
        renderJob: {
          ...lifecycle.renderJob,
          schemeId: "different-scheme"
        },
        candidates: lifecycle.candidates,
        verificationReports: lifecycle.verificationReports,
        galleryEligibility: lifecycle.galleryEligibility
      })
    ).toThrow(/RenderJob trace/);
  });
});
