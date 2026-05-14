import type {
  CreativeRenderSpec,
  DeterministicRenderCheck,
  DeterministicRenderCheckType,
  RenderCandidate
} from "@homeai/contracts";

/**
 * Deterministic L1 check menu (real verifier, not the Codex render-pipeline
 * scripted mock). Each check inspects the candidate / spec content and
 * returns a `DeterministicRenderCheck` using canonical schema fields.
 *
 * Not-evaluable policy
 * --------------------
 * Per recovery task card §7, checks that cannot be evaluated from fixture
 * metadata alone (anything that needs a VLM, a generated image, or a pixel
 * comparison against the locked-geometry mask) are encoded as:
 *
 *     status:    "warning"
 *     severity:  "info"
 *     message:   "not_evaluable: <reason>"
 *
 * This satisfies the canonical schema (which does not have a "not_evaluable"
 * status) without faking a pass. The verifier's overall-status logic excludes
 * not-evaluable warnings from the report-level status so a green candidate
 * still reports `status: "pass"`.
 */

const NOT_EVALUABLE_PREFIX = "not_evaluable: ";

export function isNotEvaluable(check: DeterministicRenderCheck): boolean {
  return typeof check.message === "string" && check.message.startsWith(NOT_EVALUABLE_PREFIX);
}

export function runDeterministicChecks(input: {
  spec: CreativeRenderSpec;
  candidate: RenderCandidate;
}): DeterministicRenderCheck[] {
  const { spec, candidate } = input;
  return [
    geometryHashMatch(spec, candidate),
    roomIdMatch(spec, candidate),
    cameraIdMatch(spec, candidate),
    outputAssetPresent(candidate),
    notEvaluable(
      "walls_preserved",
      "missing_fixture_input: pixel-level wall preservation requires image diff against locked-geometry mask"
    ),
    notEvaluable(
      "doors_preserved",
      "missing_fixture_input: door visibility requires segmentation diff against semantic mask"
    ),
    notEvaluable(
      "windows_preserved",
      "missing_fixture_input: window-count check requires VLM or semantic-mask diff"
    ),
    notEvaluable(
      "room_proportion_preserved",
      "missing_fixture_input: room-proportion measurement requires depth-map or floor-plan projection"
    ),
    notEvaluable(
      "anchor_zones_preserved",
      "missing_fixture_input: anchor-zone IoU requires anchor-layout mask + candidate segmentation"
    ),
    notEvaluable(
      "forbidden_region_clear",
      "missing_fixture_input: forbidden-region occupation requires semantic mask + spec.forbiddenChanges enforcement"
    )
  ];
}

function geometryHashMatch(spec: CreativeRenderSpec, candidate: RenderCandidate): DeterministicRenderCheck {
  const matches = spec.geometryHash === candidate.geometryHash;
  return {
    checkType: "geometry_hash_match",
    status: matches ? "pass" : "fail",
    severity: matches ? "info" : "blocking",
    message: matches
      ? "candidate geometryHash matches spec"
      : "candidate geometryHash does not match spec",
    expected: spec.geometryHash,
    actual: candidate.geometryHash
  };
}

function roomIdMatch(spec: CreativeRenderSpec, candidate: RenderCandidate): DeterministicRenderCheck {
  const matches = spec.roomId === candidate.roomId;
  return {
    checkType: "room_id_match",
    status: matches ? "pass" : "fail",
    severity: matches ? "info" : "blocking",
    message: matches ? "candidate roomId matches spec" : "candidate roomId does not match spec",
    expected: spec.roomId,
    actual: candidate.roomId
  };
}

function cameraIdMatch(spec: CreativeRenderSpec, candidate: RenderCandidate): DeterministicRenderCheck {
  const matches = spec.cameraId === candidate.cameraId;
  return {
    checkType: "camera_id_match",
    status: matches ? "pass" : "fail",
    severity: matches ? "info" : "blocking",
    message: matches ? "candidate cameraId matches spec" : "candidate cameraId does not match spec",
    expected: spec.cameraId,
    actual: candidate.cameraId
  };
}

function outputAssetPresent(candidate: RenderCandidate): DeterministicRenderCheck {
  const hasImage =
    typeof candidate.output.imageUrl === "string" && candidate.output.imageUrl.length > 0;
  const hasHash =
    typeof candidate.output.artifactHash === "string" && candidate.output.artifactHash.length > 0;
  const present = hasImage && hasHash;
  return {
    checkType: "output_asset_present",
    status: present ? "pass" : "fail",
    severity: present ? "info" : "blocking",
    message: present
      ? "candidate output has imageUrl and artifactHash"
      : "candidate output is missing imageUrl or artifactHash",
    expected: { imageUrl: true, artifactHash: true },
    actual: { imageUrl: hasImage, artifactHash: hasHash }
  };
}

function notEvaluable(
  checkType: DeterministicRenderCheckType,
  reason: string
): DeterministicRenderCheck {
  return {
    checkType,
    status: "warning",
    severity: "info",
    message: NOT_EVALUABLE_PREFIX + reason,
    expected: "evaluation",
    actual: "skipped"
  };
}
