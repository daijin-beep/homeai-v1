import {
  evaluateGalleryEligibility,
  type RenderLifecycleScenario
} from "@homeai/render-pipeline";
import { buildRenderLifecycleDebugFixture } from "@homeai/render-pipeline";
import { verifyRenderCandidate } from "@homeai/render-verifier";
import type {
  CreativeRenderSpec,
  GalleryEligibilityDecision,
  RenderCandidate,
  RenderJob,
  RenderVerificationReport
} from "@homeai/contracts";

import { createInMemoryHumanReviewRepository, type HumanReviewRepository } from "../human-review/repository.js";
import {
  enqueueIfReviewRequired,
  type EnqueueIfNeededInput
} from "../human-review/service.js";
import type { HumanReviewItem } from "../human-review/contract.js";

const DEFAULT_TIMESTAMP = "2026-05-14T00:00:00.000Z";

export interface RuntimeSnapshot {
  scenario: RenderLifecycleScenario;
  renderJob: RenderJob;
  candidates: ReadonlyArray<RenderCandidate>;
  // Verifier reports re-derived by Track B's real L1 verifier, not the
  // render-pipeline scripted mock. Keyed in the same order as candidates.
  verificationReports: ReadonlyArray<RenderVerificationReport>;
  galleryEligibility: ReadonlyArray<GalleryEligibilityDecision>;
  humanReviewItems: ReadonlyArray<HumanReviewItem>;
  creativeRenderSpecs: ReadonlyArray<CreativeRenderSpec>;
}

/**
 * Compute a full render lifecycle snapshot using:
 *   - Codex render-pipeline builders for job + candidate scaffolding
 *   - Track B real L1 verifier (verifyRenderCandidate) for each candidate
 *   - Codex evaluateGalleryEligibility for final gating
 *   - Track B human review queue for any candidate whose report demands review
 *
 * Pure in-process — never calls network. Returned data is plain (cloned
 * by callers if needed). The provided `humanReviewRepository` is used so
 * tests can inspect queued items; if omitted, a fresh in-memory repo is
 * created.
 */
export function buildRuntimeSnapshot(input: {
  scenario?: RenderLifecycleScenario;
  createdAt?: string;
  humanReviewRepository?: HumanReviewRepository;
}): {
  snapshot: RuntimeSnapshot;
  humanReviewRepository: HumanReviewRepository;
} {
  const scenario = input.scenario ?? "all_pass";
  const createdAt = input.createdAt ?? DEFAULT_TIMESTAMP;
  const humanReviewRepository = input.humanReviewRepository ?? createInMemoryHumanReviewRepository();

  const fixture = buildRenderLifecycleDebugFixture(scenario);
  const specsById = new Map(fixture.creativeRenderSpecs.map((spec) => [spec.renderSpecId, spec]));

  const verificationReports = fixture.candidates.map((candidate) => {
    const spec = specsById.get(candidate.renderSpecId);
    if (spec === undefined) {
      throw new Error(`fixture missing spec for candidate ${candidate.renderCandidateId}`);
    }
    return verifyRenderCandidate({
      spec,
      candidate,
      reportId: `runtime-snapshot-report-${candidate.renderCandidateId}`,
      createdAt
    });
  });

  const reportsByCandidate = new Map(
    verificationReports.map((report) => [report.renderCandidateId, report])
  );

  const galleryEligibility = fixture.candidates.map((candidate) => {
    const report = reportsByCandidate.get(candidate.renderCandidateId);
    return report === undefined
      ? evaluateGalleryEligibility({ candidate })
      : evaluateGalleryEligibility({ candidate, verificationReport: report });
  });

  const humanReviewItems: HumanReviewItem[] = [];
  for (const candidate of fixture.candidates) {
    const report = reportsByCandidate.get(candidate.renderCandidateId);
    if (report === undefined) continue;
    const enqueueInput: EnqueueIfNeededInput = {
      candidate,
      report,
      reviewItemId: `runtime-snapshot-review-${candidate.renderCandidateId}`,
      requestedAt: createdAt
    };
    const queued = enqueueIfReviewRequired(humanReviewRepository, enqueueInput);
    if (queued !== null) {
      humanReviewItems.push(queued);
    }
  }

  const snapshot: RuntimeSnapshot = {
    scenario,
    renderJob: fixture.renderJob,
    candidates: fixture.candidates,
    verificationReports,
    galleryEligibility,
    humanReviewItems,
    creativeRenderSpecs: fixture.creativeRenderSpecs
  };
  return { snapshot, humanReviewRepository };
}
