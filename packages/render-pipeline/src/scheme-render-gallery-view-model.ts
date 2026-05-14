import {
  GalleryEligibilityDecisionSchema,
  P1SceneContractV02Schema,
  RenderCandidateSchema,
  RenderJobSchema,
  RenderVerificationReportSchema,
  SchemeLiteContractSchema,
  SchemeRenderGalleryViewModelSchema,
  type GalleryEligibilityDecision,
  type P1SceneContractV02,
  type RenderCandidate,
  type RenderCandidateBlockSummary,
  type RenderCandidateCardViewModel,
  type RenderJob,
  type RenderVerificationReport,
  type RoomRenderGalleryViewModel,
  type RoomRenderStatus,
  type SchemeLiteContract,
  type SchemeRenderGallerySummary,
  type SchemeRenderGalleryViewModel
} from "@homeai/contracts";
import { renderPipelineTimestamp } from "./render-job-builder.js";

export interface BuildSchemeRenderGalleryViewModelInput {
  schemeLiteContract: SchemeLiteContract;
  sceneContract: P1SceneContractV02;
  renderJob: RenderJob;
  candidates: RenderCandidate[];
  verificationReports: RenderVerificationReport[];
  galleryEligibility: GalleryEligibilityDecision[];
  generatedAt?: string;
}

type NonEligibleGalleryStatus = Exclude<GalleryEligibilityDecision["status"], "eligible">;

type CandidateClassification =
  | { kind: "eligible"; card: RenderCandidateCardViewModel }
  | { kind: "warning"; summary: RenderCandidateBlockSummary }
  | { kind: "blocked"; summary: RenderCandidateBlockSummary };

export function buildSchemeRenderGalleryViewModel(
  input: BuildSchemeRenderGalleryViewModelInput
): SchemeRenderGalleryViewModel {
  const scheme = SchemeLiteContractSchema.parse(clone(input.schemeLiteContract));
  const scene = P1SceneContractV02Schema.parse(clone(input.sceneContract));
  const renderJob = RenderJobSchema.parse(clone(input.renderJob));
  const candidates = input.candidates.map((candidate) => RenderCandidateSchema.parse(clone(candidate)));
  const verificationReports = input.verificationReports.map((report) => RenderVerificationReportSchema.parse(clone(report)));
  const galleryEligibility = input.galleryEligibility.map((decision) => GalleryEligibilityDecisionSchema.parse(clone(decision)));
  const generatedAt = input.generatedAt ?? renderPipelineTimestamp;

  assertTopLevelTraceAlignment(scheme, scene, renderJob);

  const schemeRoomsById = new Map(scheme.rooms.map((room) => [room.roomId, room]));
  const roomJobsById = new Map(renderJob.roomJobs.map((roomJob) => [roomJob.roomId, roomJob]));
  const reportsById = new Map(verificationReports.map((report) => [report.renderVerificationReportId, report]));
  const decisionsByCandidateId = new Map(galleryEligibility.map((decision) => [decision.renderCandidateId, decision]));

  const rooms = [...scene.rooms]
    .sort((a, b) => a.roomId.localeCompare(b.roomId))
    .map((room): RoomRenderGalleryViewModel => {
      const roomJob = roomJobsById.get(room.roomId);
      const roomCandidates = candidates
        .filter((candidate) => candidate.roomId === room.roomId)
        .sort((a, b) => a.renderCandidateId.localeCompare(b.renderCandidateId));
      const classified = roomCandidates.map((candidate) => {
        const decision = decisionsByCandidateId.get(candidate.renderCandidateId);
        return classifyCandidate({
          candidate,
          scene,
          renderJob,
          reportsById,
          ...(decision === undefined ? {} : { decision })
        });
      });
      const eligibleCandidates = classified
        .filter((classification): classification is Extract<CandidateClassification, { kind: "eligible" }> => classification.kind === "eligible")
        .map((classification) => classification.card);
      const warningCandidates = classified
        .filter((classification): classification is Extract<CandidateClassification, { kind: "warning" }> => classification.kind === "warning")
        .map((classification) => classification.summary);
      const blockedCandidates = classified
        .filter((classification): classification is Extract<CandidateClassification, { kind: "blocked" }> => classification.kind === "blocked")
        .map((classification) => classification.summary);
      const issues = roomIssues(roomJob, blockedCandidates, warningCandidates);
      const renderStatus = renderStatusForRoom({
        eligibleCandidates,
        warningCandidates,
        blockedCandidates,
        ...(roomJob === undefined ? {} : { roomJob })
      });
      const schemeRoom = schemeRoomsById.get(room.roomId);

      return {
        roomId: room.roomId,
        roomDisplayName: schemeRoom?.displayLabel ?? room.roomType,
        roomType: room.roomType,
        renderStatus,
        eligibleCandidateCount: eligibleCandidates.length,
        blockedCandidateCount: blockedCandidates.length,
        warningCandidateCount: warningCandidates.length,
        eligibleCandidates,
        blockedCandidates,
        warningCandidates,
        issues
      };
    });
  const summary = buildSummary(rooms);

  return deepFreeze(SchemeRenderGalleryViewModelSchema.parse({
    version: "0.1",
    schemeId: scheme.schemeId,
    homeId: scheme.homeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scene.sceneContractId,
    geometryHash: scene.geometryHash,
    summary,
    rooms,
    generatedAt
  }));
}

function assertTopLevelTraceAlignment(
  scheme: SchemeLiteContract,
  scene: P1SceneContractV02,
  renderJob: RenderJob
): void {
  if (
    scene.homeId !== scheme.homeId ||
    scene.canonicalRevisionId !== scheme.floorplanRevisionId ||
    scene.sceneContractId !== scheme.sceneContractId ||
    scene.geometryHash !== scheme.geometryHash
  ) {
    throw new Error("SceneContract trace does not match SchemeLiteContract.");
  }

  if (
    renderJob.homeId !== scheme.homeId ||
    renderJob.floorplanRevisionId !== scheme.floorplanRevisionId ||
    renderJob.sceneContractId !== scheme.sceneContractId ||
    renderJob.geometryHash !== scheme.geometryHash ||
    renderJob.schemeId !== scheme.schemeId
  ) {
    throw new Error("RenderJob trace does not match SchemeLiteContract.");
  }
}

function classifyCandidate(input: {
  candidate: RenderCandidate;
  scene: P1SceneContractV02;
  renderJob: RenderJob;
  decision?: GalleryEligibilityDecision;
  reportsById: ReadonlyMap<string, RenderVerificationReport>;
}): CandidateClassification {
  const { candidate, scene, renderJob, decision, reportsById } = input;

  if (
    candidate.renderJobId !== renderJob.renderJobId ||
    candidate.schemeId !== renderJob.schemeId ||
    candidate.roomId === undefined ||
    candidate.roomId.length === 0
  ) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_pending_verification", ["candidate trace does not match render job"])
    };
  }

  if (candidate.geometryHash !== scene.geometryHash) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_geometry_mismatch", ["candidate geometryHash does not match scene"])
    };
  }

  if (candidate.output.imageUrl === undefined || candidate.output.artifactHash === undefined) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_missing_asset", ["candidate output asset is missing"])
    };
  }

  if (decision === undefined) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_pending_verification", ["gallery eligibility decision is missing"])
    };
  }

  const report = decision.renderVerificationReportId === undefined
    ? undefined
    : reportsById.get(decision.renderVerificationReportId);
  if (report === undefined) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_pending_verification", ["verification report is missing"], decision)
    };
  }

  if (
    report.renderCandidateId !== candidate.renderCandidateId ||
    report.renderJobId !== renderJob.renderJobId ||
    report.schemeId !== renderJob.schemeId ||
    report.roomId !== candidate.roomId ||
    report.cameraId !== candidate.cameraId
  ) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_pending_verification", ["verification report trace does not match candidate"], decision)
    };
  }

  if (report.geometryHash !== scene.geometryHash || report.geometryHash !== candidate.geometryHash) {
    return {
      kind: "blocked",
      summary: blockSummary(candidate, "blocked_geometry_mismatch", ["verification report geometryHash does not match scene"], decision)
    };
  }

  if (decision.status === "eligible" && report.status === "pass") {
    return {
      kind: "eligible",
      card: {
        renderCandidateId: candidate.renderCandidateId,
        renderJobId: candidate.renderJobId,
        renderSpecId: candidate.renderSpecId,
        roomId: candidate.roomId,
        cameraId: candidate.cameraId,
        geometryHash: candidate.geometryHash,
        verificationReportId: report.renderVerificationReportId,
        imageUrl: candidate.output.imageUrl,
        ...(candidate.output.thumbnailUrl === undefined ? {} : { thumbnailUrl: candidate.output.thumbnailUrl }),
        artifactHash: candidate.output.artifactHash,
        status: "eligible",
        reasons: decision.reasons,
        createdAt: candidate.createdAt
      }
    };
  }

  if (decision.status === "human_review_required" || report.status === "warning") {
    return {
      kind: "warning",
      summary: blockSummary(candidate, "human_review_required", ["candidate requires human review", ...decision.reasons], decision)
    };
  }

  return {
    kind: "blocked",
    summary: blockSummary(
      candidate,
      decision.status === "eligible" ? "blocked_failed_verification" : decision.status,
      decision.status === "eligible" ? ["eligible decision requires pass verification"] : decision.reasons,
      decision
    )
  };
}

function blockSummary(
  candidate: RenderCandidate,
  status: NonEligibleGalleryStatus,
  reasons: string[],
  decision?: GalleryEligibilityDecision
): RenderCandidateBlockSummary {
  return {
    renderCandidateId: candidate.renderCandidateId,
    renderSpecId: candidate.renderSpecId,
    roomId: candidate.roomId,
    cameraId: candidate.cameraId,
    geometryHash: candidate.geometryHash,
    ...(decision?.renderVerificationReportId === undefined ? {} : { verificationReportId: decision.renderVerificationReportId }),
    status,
    reasons: uniqueSorted(reasons)
  };
}

function renderStatusForRoom(input: {
  roomJob?: RenderJob["roomJobs"][number];
  eligibleCandidates: readonly RenderCandidateCardViewModel[];
  warningCandidates: readonly RenderCandidateBlockSummary[];
  blockedCandidates: readonly RenderCandidateBlockSummary[];
}): RoomRenderStatus {
  if (input.roomJob === undefined || input.roomJob.renderSpecIds.length === 0) {
    return "missing_coverage";
  }
  if (input.eligibleCandidates.length > 0) {
    return "has_eligible_render";
  }
  if (input.warningCandidates.length > 0) {
    return "human_review_required";
  }
  if (input.blockedCandidates.length > 0) {
    return "failed";
  }
  if (input.roomJob.status === "queued" || input.roomJob.status === "running") {
    return "pending";
  }
  return "not_started";
}

function roomIssues(
  roomJob: RenderJob["roomJobs"][number] | undefined,
  blockedCandidates: readonly RenderCandidateBlockSummary[],
  warningCandidates: readonly RenderCandidateBlockSummary[]
): string[] {
  const issues = [
    ...(roomJob?.issues.map((issue) => issue.code) ?? []),
    ...blockedCandidates.flatMap((candidate) => candidate.reasons),
    ...warningCandidates.flatMap((candidate) => candidate.reasons)
  ];
  if (roomJob === undefined || roomJob.renderSpecIds.length === 0) {
    issues.push("room is missing render coverage");
  }
  return uniqueSorted(issues);
}

function buildSummary(rooms: readonly RoomRenderGalleryViewModel[]): SchemeRenderGallerySummary {
  const eligibleCandidateCount = rooms.reduce((sum, room) => sum + room.eligibleCandidateCount, 0);
  const blockedCandidateCount = rooms.reduce((sum, room) => sum + room.blockedCandidateCount, 0);
  const warningCandidateCount = rooms.reduce((sum, room) => sum + room.warningCandidateCount, 0);
  const roomsWithEligibleRender = rooms.filter((room) => room.renderStatus === "has_eligible_render").length;
  const roomsNeedingHumanReview = rooms.filter((room) => room.renderStatus === "human_review_required").length;
  const roomsFailed = rooms.filter((room) => room.renderStatus === "failed").length;
  const roomsMissingCoverage = rooms.filter((room) => room.renderStatus === "missing_coverage").length;
  const status = roomsFailed > 0 || roomsMissingCoverage > 0
    ? "fail"
    : roomsNeedingHumanReview > 0 || rooms.some((room) => room.renderStatus === "pending")
      ? "warning"
      : "pass";

  return {
    totalRooms: rooms.length,
    roomsWithEligibleRender,
    roomsNeedingHumanReview,
    roomsFailed,
    roomsMissingCoverage,
    eligibleCandidateCount,
    blockedCandidateCount,
    warningCandidateCount,
    status
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
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
