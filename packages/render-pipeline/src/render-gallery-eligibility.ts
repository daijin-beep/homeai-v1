import {
  GalleryEligibilityDecisionSchema,
  RenderCandidateSchema,
  RenderVerificationReportSchema,
  type GalleryEligibilityDecision,
  type RenderCandidate,
  type RenderVerificationReport
} from "@homeai/contracts";

export function evaluateGalleryEligibility(input: {
  candidate: RenderCandidate;
  verificationReport?: RenderVerificationReport;
}): GalleryEligibilityDecision {
  const candidate = RenderCandidateSchema.parse(clone(input.candidate));
  const verificationReport = input.verificationReport === undefined
    ? undefined
    : RenderVerificationReportSchema.parse(clone(input.verificationReport));

  if (candidate.output.imageUrl === undefined || candidate.output.artifactHash === undefined) {
    return decision(candidate.renderCandidateId, undefined, "blocked_missing_asset", ["candidate output asset is missing"]);
  }

  if (verificationReport === undefined) {
    return decision(candidate.renderCandidateId, undefined, "blocked_pending_verification", ["verification report is missing"]);
  }

  if (verificationReport.geometryHash !== candidate.geometryHash) {
    return decision(
      candidate.renderCandidateId,
      verificationReport.renderVerificationReportId,
      "blocked_geometry_mismatch",
      ["verification geometryHash does not match candidate"]
    );
  }

  if (verificationReport.status === "pass") {
    return decision(candidate.renderCandidateId, verificationReport.renderVerificationReportId, "eligible", ["verification passed"]);
  }

  if (verificationReport.status === "warning") {
    return decision(
      candidate.renderCandidateId,
      verificationReport.renderVerificationReportId,
      "human_review_required",
      ["verification produced warnings"]
    );
  }

  return decision(
    candidate.renderCandidateId,
    verificationReport.renderVerificationReportId,
    "blocked_failed_verification",
    ["verification failed"]
  );
}

function decision(
  renderCandidateId: string,
  renderVerificationReportId: string | undefined,
  status: GalleryEligibilityDecision["status"],
  reasons: string[]
): GalleryEligibilityDecision {
  return GalleryEligibilityDecisionSchema.parse({
    renderCandidateId,
    ...(renderVerificationReportId === undefined ? {} : { renderVerificationReportId }),
    status,
    reasons
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
