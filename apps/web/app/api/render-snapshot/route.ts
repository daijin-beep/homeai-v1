import { buildRuntimeSnapshot } from "@homeai/ads-runtime";
import type { RenderLifecycleScenario } from "@homeai/render-pipeline";

const SCENARIOS: ReadonlyArray<RenderLifecycleScenario> = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail"
];

function pickScenario(raw: string | null): RenderLifecycleScenario {
  if (raw !== null && (SCENARIOS as ReadonlyArray<string>).includes(raw)) {
    return raw as RenderLifecycleScenario;
  }
  return "all_pass";
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const scenario = pickScenario(url.searchParams.get("scenario"));
  const { snapshot } = buildRuntimeSnapshot({ scenario });
  // Return a compact projection — full canonical objects can be re-derived
  // from @homeai/render-pipeline + @homeai/render-verifier on demand.
  return Response.json({
    scenario,
    renderJob: {
      renderJobId: snapshot.renderJob.renderJobId,
      schemeId: snapshot.renderJob.schemeId,
      status: snapshot.renderJob.status,
      coverage: snapshot.renderJob.coverage
    },
    candidates: snapshot.candidates.map((c) => ({
      renderCandidateId: c.renderCandidateId,
      renderSpecId: c.renderSpecId,
      roomId: c.roomId,
      cameraId: c.cameraId,
      status: c.status,
      galleryEligibility: c.galleryEligibility,
      hasOutput: c.output.imageUrl !== undefined && c.output.artifactHash !== undefined
    })),
    verificationReports: snapshot.verificationReports.map((r) => ({
      renderVerificationReportId: r.renderVerificationReportId,
      renderCandidateId: r.renderCandidateId,
      status: r.status,
      failedChecks: r.l1Checks
        .filter((c) => c.status === "fail")
        .map((c) => ({ checkType: c.checkType, message: c.message })),
      warningChecks: r.l1Checks
        .filter((c) => c.status === "warning")
        .map((c) => ({ checkType: c.checkType, message: c.message })),
      humanReviewRequired: r.humanReview?.required === true
    })),
    galleryEligibility: snapshot.galleryEligibility.map((g) => ({
      renderCandidateId: g.renderCandidateId,
      status: g.status,
      reasons: g.reasons
    })),
    humanReviewItems: snapshot.humanReviewItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      renderCandidateId: item.renderCandidateId,
      status: item.status,
      reason: item.reason
    }))
  });
}
