import { describe, expect, it } from "vitest";

import { buildRenderLifecycleDebugFixture } from "@homeai/render-pipeline";
import { verifyRenderCandidate } from "@homeai/render-verifier";
import {
  HumanReviewItemSchema,
  buildRuntimeSnapshot,
  createInMemoryHumanReviewRepository,
  enqueueIfReviewRequired,
  submitHumanReviewDecision
} from "@homeai/ads-runtime";

describe("Batch 04 — Human Review Queue", () => {
  it("does not enqueue when verifier did not request human review", () => {
    const repo = createInMemoryHumanReviewRepository();
    const fixture = buildRenderLifecycleDebugFixture("all_pass");
    const candidate = fixture.candidates[0];
    const spec = fixture.creativeRenderSpecs.find((s) => s.renderSpecId === candidate?.renderSpecId);
    if (candidate === undefined || spec === undefined) throw new Error("fixture missing");
    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "test-no-review-needed",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    // all_pass case → status=pass → humanReview undefined → no enqueue
    expect(report.humanReview).toBeUndefined();
    const queued = enqueueIfReviewRequired(repo, {
      candidate,
      report,
      reviewItemId: "review-1",
      requestedAt: "2026-05-14T00:00:00.000Z"
    });
    expect(queued).toBeNull();
    expect(repo.list().length).toBe(0);
  });

  it("enqueues when verifier requests human review (and snapshot matches geometryHash)", () => {
    const repo = createInMemoryHumanReviewRepository();
    const fixture = buildRenderLifecycleDebugFixture("one_missing_asset_fail");
    const missingAssetCandidate = fixture.candidates.find(
      (c) => c.galleryEligibility === "blocked_missing_asset"
    );
    const spec = fixture.creativeRenderSpecs.find(
      (s) => s.renderSpecId === missingAssetCandidate?.renderSpecId
    );
    if (missingAssetCandidate === undefined || spec === undefined) throw new Error("fixture missing");
    const report = verifyRenderCandidate({
      spec,
      candidate: missingAssetCandidate,
      reportId: "test-review-required",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    expect(report.status).toBe("fail");
    expect(report.humanReview?.required).toBe(true);

    const queued = enqueueIfReviewRequired(repo, {
      candidate: missingAssetCandidate,
      report,
      reviewItemId: "review-test-missing-asset",
      requestedAt: "2026-05-14T00:00:00.000Z"
    });
    expect(queued).not.toBeNull();
    if (queued === null) throw new Error("queue item should exist");
    expect(HumanReviewItemSchema.safeParse(queued).success).toBe(true);
    expect(queued.status).toBe("pending");
    expect(queued.geometryHash).toBe(missingAssetCandidate.geometryHash);
    expect(repo.list({ status: "pending" }).length).toBe(1);
  });

  it("submitHumanReviewDecision transitions item to decided and stores the decision", () => {
    const repo = createInMemoryHumanReviewRepository();
    const fixture = buildRenderLifecycleDebugFixture("one_missing_asset_fail");
    const candidate = fixture.candidates.find(
      (c) => c.galleryEligibility === "blocked_missing_asset"
    );
    const spec = fixture.creativeRenderSpecs.find(
      (s) => s.renderSpecId === candidate?.renderSpecId
    );
    if (candidate === undefined || spec === undefined) throw new Error("fixture missing");
    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "test-review-decision-flow",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    const queued = enqueueIfReviewRequired(repo, {
      candidate,
      report,
      reviewItemId: "review-decision-1",
      requestedAt: "2026-05-14T00:00:00.000Z"
    });
    if (queued === null) throw new Error("expected queued item");

    const result = submitHumanReviewDecision({
      repo,
      reviewItemId: queued.reviewItemId,
      reviewerId: "kim",
      decision: "request_regenerate",
      reasonCode: "transient_provider_miss",
      decisionId: "decision-1",
      decidedAt: "2026-05-14T01:00:00.000Z",
      notes: "ask for re-render"
    });

    expect(result.item.status).toBe("decided");
    expect(result.decision.decision).toBe("request_regenerate");
    expect(result.decision.snapshot.geometryHash).toBe(queued.geometryHash);
    const records = repo.decisionsForItem(queued.reviewItemId);
    expect(records.length).toBe(1);
    expect(records[0]?.decisionId).toBe("decision-1");
  });

  it("refuses to decide a non-pending item (double decide)", () => {
    const repo = createInMemoryHumanReviewRepository();
    const fixture = buildRenderLifecycleDebugFixture("one_missing_asset_fail");
    const candidate = fixture.candidates.find(
      (c) => c.galleryEligibility === "blocked_missing_asset"
    );
    const spec = fixture.creativeRenderSpecs.find(
      (s) => s.renderSpecId === candidate?.renderSpecId
    );
    if (candidate === undefined || spec === undefined) throw new Error("fixture missing");
    const report = verifyRenderCandidate({
      spec,
      candidate,
      reportId: "test-double-decide-report",
      createdAt: "2026-05-14T00:00:00.000Z"
    });
    const queued = enqueueIfReviewRequired(repo, {
      candidate,
      report,
      reviewItemId: "review-double-decide",
      requestedAt: "2026-05-14T00:00:00.000Z"
    });
    if (queued === null) throw new Error("expected queued item");

    submitHumanReviewDecision({
      repo,
      reviewItemId: queued.reviewItemId,
      reviewerId: "kim",
      decision: "reject",
      reasonCode: "irrecoverable",
      decisionId: "decision-once",
      decidedAt: "2026-05-14T01:00:00.000Z"
    });

    expect(() =>
      submitHumanReviewDecision({
        repo,
        reviewItemId: queued.reviewItemId,
        reviewerId: "kim",
        decision: "approve_for_gallery",
        reasonCode: "reverse",
        decisionId: "decision-twice",
        decidedAt: "2026-05-14T01:30:00.000Z"
      })
    ).toThrow(/can only decide pending items/);
  });

  it("buildRuntimeSnapshot wires verifier + Codex pipeline + queue without throwing", () => {
    const { snapshot, humanReviewRepository } = buildRuntimeSnapshot({
      scenario: "one_missing_asset_fail"
    });
    expect(snapshot.renderJob.renderJobId.length).toBeGreaterThan(0);
    expect(snapshot.candidates.length).toBeGreaterThan(0);
    expect(snapshot.verificationReports.length).toBe(snapshot.candidates.length);
    expect(snapshot.galleryEligibility.length).toBe(snapshot.candidates.length);
    // At least one item should be queued for review under this failing scenario
    expect(snapshot.humanReviewItems.length).toBeGreaterThan(0);
    expect(humanReviewRepository.list({ status: "pending" }).length).toBe(snapshot.humanReviewItems.length);
  });

  it("buildRuntimeSnapshot reuses caller-provided repository", () => {
    const repo = createInMemoryHumanReviewRepository();
    const { snapshot } = buildRuntimeSnapshot({
      scenario: "one_missing_asset_fail",
      humanReviewRepository: repo
    });
    expect(snapshot.humanReviewItems.length).toBeGreaterThan(0);
    expect(repo.list().length).toBeGreaterThan(0);
  });
});
