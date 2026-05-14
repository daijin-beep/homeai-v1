import {
  P1SceneContractV02Schema,
  type P1SceneContractV02
} from "@homeai/contracts";
import {
  compileCreativeRenderSpecBatch,
  createCreativeRenderSpecFixtureInput
} from "@homeai/creative-render-spec";
import { buildMockRenderCandidates, type MockRenderCandidateMode } from "./render-candidate-builder.js";
import { buildMockRenderVerificationReports, type MockRenderVerificationScenario } from "./render-verification-mock.js";
import { evaluateGalleryEligibility } from "./render-gallery-eligibility.js";
import { buildRenderJobFromCreativeRenderSpecs } from "./render-job-builder.js";

export type RenderLifecycleScenario = MockRenderVerificationScenario | "missing_room_coverage";

export function createRenderLifecycleFixtureInput(options: { withLayoutIntent?: boolean } = {}) {
  const creativeInput = createCreativeRenderSpecFixtureInput({
    withLayoutIntent: options.withLayoutIntent ?? true,
    withWarnings: true
  });
  const creativeRenderSpecBatch = compileCreativeRenderSpecBatch(creativeInput);
  const sceneContract = sceneFromCreativeInput(creativeInput.scheme);

  return {
    schemeLiteContract: creativeInput.scheme,
    sceneContract,
    creativeRenderSpecBatch,
    creativeRenderSpecs: creativeRenderSpecBatch.specs
  };
}

export function buildRenderLifecycleDebugFixture(scenario: RenderLifecycleScenario = "all_pass") {
  const fixture = createRenderLifecycleFixtureInput();
  const missingCoverageRoomId = fixture.creativeRenderSpecs[0]?.roomId;
  const creativeRenderSpecs = scenario === "missing_room_coverage"
    ? fixture.creativeRenderSpecs.filter((spec) => spec.roomId !== missingCoverageRoomId)
    : fixture.creativeRenderSpecs;
  const initialJob = buildRenderJobFromCreativeRenderSpecs({
    ...fixture,
    creativeRenderSpecs
  });
  const candidateMode: MockRenderCandidateMode =
    scenario === "one_geometry_hash_mismatch_fail"
      ? "geometry_mismatch_for_one_candidate"
      : scenario === "one_missing_asset_fail"
        ? "missing_asset_for_one_room"
        : "all_pass_assets";
  const candidates = buildMockRenderCandidates({
    renderJob: initialJob,
    creativeRenderSpecs,
    mode: candidateMode
  });
  const verificationReports = buildMockRenderVerificationReports({
    renderJob: initialJob,
    candidates,
    creativeRenderSpecs,
    scenario: scenario === "missing_room_coverage" ? "all_pass" : scenario
  });
  const galleryEligibility = candidates.map((candidate) =>
    eligibilityForCandidate(candidate, verificationReports)
  );
  const renderJob = buildRenderJobFromCreativeRenderSpecs({
    ...fixture,
    creativeRenderSpecs,
    candidates,
    verificationReports,
    galleryEligibility
  });

  return {
    ...fixture,
    creativeRenderSpecs,
    renderJob,
    candidates,
    verificationReports,
    galleryEligibility
  };
}

function eligibilityForCandidate(
  candidate: Parameters<typeof evaluateGalleryEligibility>[0]["candidate"],
  verificationReports: ReturnType<typeof buildMockRenderVerificationReports>
) {
  const verificationReport = verificationReports.find((report) => report.renderCandidateId === candidate.renderCandidateId);
  return verificationReport === undefined
    ? evaluateGalleryEligibility({ candidate })
    : evaluateGalleryEligibility({ candidate, verificationReport });
}

function sceneFromCreativeInput(scheme: ReturnType<typeof createCreativeRenderSpecFixtureInput>["scheme"]): P1SceneContractV02 {
  return P1SceneContractV02Schema.parse({
    sceneContractId: scheme.sceneContractId,
    version: "0.2",
    readonly: true,
    homeId: scheme.homeId,
    canonicalRevisionId: scheme.floorplanRevisionId,
    geometryHash: scheme.geometryHash,
    unit: "mm",
    floorHeightMm: 2800,
    rooms: scheme.rooms.map((room, index) => ({
      roomId: room.roomId,
      roomType: room.roomType,
      polygon: squarePolygon(index)
    })),
    walls: [
      {
        wallId: "fixture-wall-main",
        start: { x: 0, y: 0 },
        end: { x: 10000, y: 0 },
        thicknessMm: 200,
        kind: "exterior"
      }
    ],
    openings: [],
    validation: {
      status: "valid",
      errors: [],
      warnings: []
    },
    createdAt: "2026-05-14T00:00:00.000Z"
  });
}

function squarePolygon(index: number) {
  const x = index * 1200;
  return [
    { x, y: 0 },
    { x: x + 1000, y: 0 },
    { x: x + 1000, y: 1000 },
    { x, y: 1000 }
  ];
}
