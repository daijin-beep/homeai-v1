import type {
  RenderCandidate,
  RenderVerificationReport
} from "@homeai/contracts";

import type {
  HumanReviewDecisionRecord,
  HumanReviewDecisionVerb,
  HumanReviewItem
} from "./contract.js";
import type { HumanReviewRepository } from "./repository.js";

export interface EnqueueIfNeededInput {
  candidate: RenderCandidate;
  report: RenderVerificationReport;
  reviewItemId: string;
  requestedAt: string;
}

/**
 * Enqueue a review item only when the canonical verification report flags
 * that human review is required (verifier.humanReview.required === true).
 *
 * Returns the queued HumanReviewItem if the report demanded review, or null
 * if no review is needed. Idempotent — the caller is responsible for
 * stable reviewItemId generation; the repository rejects duplicates.
 */
export function enqueueIfReviewRequired(
  repo: HumanReviewRepository,
  input: EnqueueIfNeededInput
): HumanReviewItem | null {
  if (input.report.humanReview === undefined || input.report.humanReview.required === false) {
    return null;
  }
  const item: HumanReviewItem = {
    reviewItemId: input.reviewItemId,
    renderCandidateId: input.candidate.renderCandidateId,
    renderVerificationReportId: input.report.renderVerificationReportId,
    renderJobId: input.candidate.renderJobId,
    renderSpecId: input.candidate.renderSpecId,
    schemeId: input.candidate.schemeId,
    roomId: input.candidate.roomId,
    cameraId: input.candidate.cameraId,
    geometryHash: input.candidate.geometryHash,
    requestedAt: input.requestedAt,
    status: "pending",
    reason: input.report.humanReview.reason
  };
  return repo.enqueue(item);
}

export interface SubmitDecisionInput {
  repo: HumanReviewRepository;
  reviewItemId: string;
  reviewerId: string;
  decision: HumanReviewDecisionVerb;
  reasonCode: string;
  notes?: string;
  decisionId: string;
  decidedAt: string;
}

export function submitHumanReviewDecision(input: SubmitDecisionInput): {
  item: HumanReviewItem;
  decision: HumanReviewDecisionRecord;
} {
  const { repo, reviewItemId } = input;
  const item = repo.get(reviewItemId);
  if (item === undefined) {
    throw new Error(`review item ${reviewItemId} not found`);
  }
  if (item.status !== "pending") {
    throw new Error(
      `review item ${reviewItemId} is in status ${item.status}; can only decide pending items`
    );
  }
  const decision: HumanReviewDecisionRecord = {
    decisionId: input.decisionId,
    reviewItemId,
    reviewerId: input.reviewerId,
    decision: input.decision,
    reasonCode: input.reasonCode,
    decidedAt: input.decidedAt,
    snapshot: {
      renderCandidateId: item.renderCandidateId,
      renderVerificationReportId: item.renderVerificationReportId,
      geometryHash: item.geometryHash
    },
    ...(input.notes === undefined ? {} : { notes: input.notes })
  };
  return repo.recordDecision(decision, "decided");
}
