import {
  CreativeRenderSpecSchema,
  RenderCandidateSchema,
  RenderJobSchema,
  RenderVerificationReportSchema,
  type CreativeRenderSpec,
  type DeterministicRenderCheck,
  type RenderCandidate,
  type RenderJob,
  type RenderVerificationReport,
  type RenderVerificationStatus,
  type VlmRenderChecklistResult
} from "@homeai/contracts";

export type MockRenderVerificationScenario =
  | "all_pass"
  | "one_window_missing_fail"
  | "one_door_blocked_fail"
  | "one_anchor_zone_warning"
  | "one_geometry_hash_mismatch_fail"
  | "one_missing_asset_fail";

const DEFAULT_CREATED_AT = "2026-05-14T00:00:00.000Z";

export function buildMockRenderVerificationReports(input: {
  renderJob: RenderJob;
  candidates: RenderCandidate[];
  creativeRenderSpecs: CreativeRenderSpec[];
  scenario: MockRenderVerificationScenario;
  createdAt?: string;
}): RenderVerificationReport[] {
  const renderJob = RenderJobSchema.parse(clone(input.renderJob));
  const candidates = input.candidates.map((candidate) => RenderCandidateSchema.parse(clone(candidate)));
  const specs = input.creativeRenderSpecs.map((spec) => CreativeRenderSpecSchema.parse(clone(spec)));
  const createdAt = input.createdAt ?? DEFAULT_CREATED_AT;
  const sortedCandidates = [...candidates].sort((a, b) => a.renderCandidateId.localeCompare(b.renderCandidateId));

  return deepFreeze(sortedCandidates.map((candidate, index) => {
    const spec = specs.find((candidateSpec) => candidateSpec.renderSpecId === candidate.renderSpecId);
    if (spec === undefined) {
      throw new Error(`Missing CreativeRenderSpec for candidate ${candidate.renderCandidateId}.`);
    }

    const reportGeometryHash = input.scenario === "one_geometry_hash_mismatch_fail" && index === 0
      ? `sha256:${"c".repeat(64)}`
      : candidate.geometryHash;
    const l1Checks = l1ChecksForScenario(input.scenario, index, candidate, spec, reportGeometryHash);
    const status = statusFromL1(l1Checks);
    const reportId = `render-verification-${candidate.renderCandidateId}`;

    return RenderVerificationReportSchema.parse({
      renderVerificationReportId: reportId,
      renderCandidateId: candidate.renderCandidateId,
      renderJobId: renderJob.renderJobId,
      renderSpecId: spec.renderSpecId,
      schemeId: spec.schemeId,
      roomId: spec.roomId,
      cameraId: spec.cameraId,
      geometryHash: reportGeometryHash,
      status,
      l1Checks,
      l2Checks: l2Checks(status),
      retryRecommendation: {
        recommended: status === "fail",
        reason: status === "fail" ? "blocking deterministic checks failed" : "retry is not needed",
        maxRetries: status === "fail" ? 1 : 0
      },
      humanReview: {
        required: status === "warning",
        reason: status === "warning" ? "warning requires review before gallery admission" : "review is not required"
      },
      trace: {
        traceId: `render-verification-trace-${reportId}`,
        sourceModule: "render_verifier_mock",
        networkCalls: false,
        providerCalls: [
          {
            providerId: "mock_vlm",
            providerKind: "mock",
            startedAt: createdAt,
            completedAt: createdAt,
            status: "success"
          }
        ],
        inputHashes: {
          geometryHash: reportGeometryHash,
          renderSpecHash: spec.renderSpecId,
          ...(candidate.output.artifactHash === undefined ? {} : { candidateOutputHash: candidate.output.artifactHash })
        },
        warnings: status === "warning" ? ["mock verifier produced a warning"] : []
      },
      createdAt
    });
  }));
}

function l1ChecksForScenario(
  scenario: MockRenderVerificationScenario,
  index: number,
  candidate: RenderCandidate,
  spec: CreativeRenderSpec,
  reportGeometryHash: string
): DeterministicRenderCheck[] {
  const checks: DeterministicRenderCheck[] = [
    check("geometry_hash_match", reportGeometryHash === spec.geometryHash && candidate.geometryHash === spec.geometryHash, "blocking"),
    check("room_id_match", candidate.roomId === spec.roomId, "blocking"),
    check("camera_id_match", candidate.cameraId === spec.cameraId, "blocking"),
    check("walls_preserved", true, "blocking"),
    check("doors_preserved", true, "blocking"),
    check("windows_preserved", true, "blocking"),
    check("room_proportion_preserved", true, "blocking"),
    check("anchor_zones_preserved", true, "blocking"),
    check("forbidden_region_clear", true, "warning"),
    check("output_asset_present", candidate.output.imageUrl !== undefined && candidate.output.artifactHash !== undefined, "blocking")
  ];

  if (index === 0 && scenario === "one_window_missing_fail") {
    checks[5] = check("windows_preserved", false, "blocking", "window preservation failed in mock scenario");
  }
  if (index === 0 && scenario === "one_door_blocked_fail") {
    checks[4] = check("doors_preserved", false, "blocking", "door preservation failed in mock scenario");
  }
  if (index === 0 && scenario === "one_anchor_zone_warning") {
    checks[7] = {
      checkType: "anchor_zones_preserved",
      status: "warning",
      severity: "warning",
      message: "anchor zone needs human review in mock scenario",
      expected: true,
      actual: "uncertain"
    };
  }
  if (index === 0 && scenario === "one_missing_asset_fail") {
    checks[9] = check("output_asset_present", false, "blocking", "candidate output asset is missing");
  }

  return checks;
}

function check(
  checkType: DeterministicRenderCheck["checkType"],
  passes: boolean,
  severity: DeterministicRenderCheck["severity"],
  message?: string
): DeterministicRenderCheck {
  return {
    checkType,
    status: passes ? "pass" : "fail",
    severity: passes ? "info" : severity,
    message: message ?? `${checkType} ${passes ? "passed" : "failed"}`,
    expected: true,
    actual: passes
  };
}

function statusFromL1(checks: readonly DeterministicRenderCheck[]): RenderVerificationStatus {
  if (checks.some((candidate) => candidate.status === "fail")) {
    return "fail";
  }
  if (checks.some((candidate) => candidate.status === "warning")) {
    return "warning";
  }
  return "pass";
}

function l2Checks(status: RenderVerificationStatus): VlmRenderChecklistResult[] {
  return [
    "room_type_consistent",
    "no_structural_change",
    "doors_windows_visible",
    "major_furniture_not_blocking_openings",
    "forbidden_changes_respected"
  ].map((questionId) => ({
    questionId: questionId as VlmRenderChecklistResult["questionId"],
    answer: status === "fail" ? "uncertain" : "yes",
    status: status === "fail" ? "warning" : "pass",
    rationale: "mock checklist only",
    provider: {
      providerId: "mock_vlm",
      modelId: "mock"
    }
  }));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
