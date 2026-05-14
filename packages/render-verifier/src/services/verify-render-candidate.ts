import {
  RenderVerificationReportSchema,
  type CreativeRenderSpec,
  type DeterministicRenderCheck,
  type DeterministicRenderCheckType,
  type HumanReviewRecommendation,
  type RenderCandidate,
  type RenderTrace,
  type RenderVerificationReport,
  type RenderVerificationStatus,
  type RetryRecommendation
} from "@homeai/contracts";

import { isNotEvaluable, runDeterministicChecks } from "../checks/deterministic-checks.js";

const BLOCKING_CHECK_TYPES = new Set<DeterministicRenderCheckType>([
  "geometry_hash_match",
  "room_id_match",
  "camera_id_match",
  "walls_preserved",
  "doors_preserved",
  "windows_preserved",
  "room_proportion_preserved",
  "anchor_zones_preserved",
  "output_asset_present"
]);

const HARD_FAIL_NOT_RETRYABLE = new Set<DeterministicRenderCheckType>([
  "geometry_hash_match",
  "room_id_match",
  "camera_id_match"
]);

export interface VerifyRenderCandidateInput {
  spec: CreativeRenderSpec;
  candidate: RenderCandidate;
  reportId: string;
  renderJobId?: string;
  createdAt?: string;
}

/**
 * Track B's real L1 verifier. Distinct from
 * `@homeai/render-pipeline/render-verification-mock` (which scripts pass/fail
 * per scenario index for fixture testing).
 *
 * `verifyRenderCandidate` inspects the actual candidate vs spec content,
 * derives 10 deterministic checks (4 evaluable, 6 not-evaluable today —
 * the 6 require VLM or pixel comparison), and returns a canonical
 * `RenderVerificationReport`.
 *
 * Overall report.status logic
 * ---------------------------
 *   - any evaluable check with status="fail" and severity="blocking" → "fail"
 *   - else any evaluable check with status="fail" → "warning"
 *   - else any evaluable check with status="warning" → "warning"
 *   - else → "pass"
 *
 * Not-evaluable warnings are excluded from report.status computation so a
 * green candidate reports "pass" even though 6 L1 checks are deferred.
 */
export function verifyRenderCandidate(input: VerifyRenderCandidateInput): RenderVerificationReport {
  const { spec, candidate, reportId } = input;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const renderJobId = input.renderJobId ?? candidate.renderJobId;

  const l1Checks = runDeterministicChecks({ spec, candidate });
  const status = deriveReportStatus(l1Checks);
  const retryRecommendation = recommendRetry(l1Checks, status);
  const humanReview = recommendHumanReview(l1Checks, status);
  const trace = buildVerifierTrace({ reportId, candidate, spec, l1Checks, createdAt });

  const reportInput: Record<string, unknown> = {
    renderVerificationReportId: reportId,
    renderCandidateId: candidate.renderCandidateId,
    renderJobId,
    renderSpecId: candidate.renderSpecId,
    schemeId: candidate.schemeId,
    roomId: candidate.roomId,
    cameraId: candidate.cameraId,
    // The report's geometryHash mirrors the candidate's. If the candidate
    // hash drifted from the spec, the geometry_hash_match check fails and
    // report.status becomes "fail" — but the report itself still parses
    // (trace.inputHashes.geometryHash == report.geometryHash holds).
    geometryHash: candidate.geometryHash,
    status,
    l1Checks,
    l2Checks: [],
    trace,
    createdAt
  };
  if (retryRecommendation !== null) {
    reportInput.retryRecommendation = retryRecommendation;
  }
  if (humanReview !== null) {
    reportInput.humanReview = humanReview;
  }
  return RenderVerificationReportSchema.parse(reportInput);
}

function deriveReportStatus(checks: ReadonlyArray<DeterministicRenderCheck>): RenderVerificationStatus {
  const evaluable = checks.filter((c) => !isNotEvaluable(c));
  const hasBlockingFail = evaluable.some(
    (c) => c.status === "fail" && c.severity === "blocking" && BLOCKING_CHECK_TYPES.has(c.checkType)
  );
  if (hasBlockingFail) {
    return "fail";
  }
  const hasAnyFail = evaluable.some((c) => c.status === "fail");
  const hasAnyWarning = evaluable.some((c) => c.status === "warning");
  if (hasAnyFail || hasAnyWarning) {
    return "warning";
  }
  return "pass";
}

function recommendRetry(
  checks: ReadonlyArray<DeterministicRenderCheck>,
  status: RenderVerificationStatus
): RetryRecommendation | null {
  if (status !== "fail") {
    return null;
  }
  const fails = checks.filter((c) => c.status === "fail");
  const hardFails = fails.filter((c) => HARD_FAIL_NOT_RETRYABLE.has(c.checkType));
  if (hardFails.length > 0) {
    return {
      recommended: false,
      reason:
        "non-retryable failure: " +
        hardFails.map((c) => c.checkType).join(", ") +
        " require spec / job re-issuance, not a provider retry",
      maxRetries: 0
    };
  }
  return {
    recommended: true,
    reason: "transient provider failure: " + fails.map((c) => c.checkType).join(", "),
    maxRetries: 2
  };
}

function recommendHumanReview(
  checks: ReadonlyArray<DeterministicRenderCheck>,
  status: RenderVerificationStatus
): HumanReviewRecommendation | null {
  if (status === "warning") {
    const evaluable = checks.filter((c) => !isNotEvaluable(c));
    const warningTypes = evaluable
      .filter((c) => c.status === "warning" || c.status === "fail")
      .map((c) => c.checkType);
    return {
      required: true,
      reason:
        warningTypes.length > 0
          ? "evaluable checks raised warnings: " + warningTypes.join(", ")
          : "report status is warning"
    };
  }
  if (status === "fail") {
    return {
      required: true,
      reason: "deterministic verifier rejected the candidate; operator must triage retry vs reject"
    };
  }
  return null;
}

function buildVerifierTrace(params: {
  reportId: string;
  candidate: RenderCandidate;
  spec: CreativeRenderSpec;
  l1Checks: ReadonlyArray<DeterministicRenderCheck>;
  createdAt: string;
}): RenderTrace {
  const { reportId, candidate, spec, l1Checks, createdAt } = params;
  const warnings = l1Checks.filter(isNotEvaluable).map((c) => c.message);
  const inputHashes: RenderTrace["inputHashes"] = {
    geometryHash: candidate.geometryHash
  };
  inputHashes.renderSpecHash = spec.renderSpecId;
  if (typeof candidate.output.artifactHash === "string" && candidate.output.artifactHash.length > 0) {
    inputHashes.candidateOutputHash = candidate.output.artifactHash;
  }
  return {
    traceId: "verifier-trace-" + reportId,
    // Canonical RenderTraceSchema.sourceModule does not yet have a
    // "render_verifier_l1" value. Using "render_verifier_mock" keeps the
    // report parseable under the current enum; the distinction between
    // this real verifier and the render-pipeline scripted mock is documented
    // in the function's docstring and detectable by trace.providerCalls
    // being empty (the L1 verifier never invokes a provider).
    sourceModule: "render_verifier_mock",
    networkCalls: false,
    providerCalls: [],
    inputHashes,
    warnings
  };
}
