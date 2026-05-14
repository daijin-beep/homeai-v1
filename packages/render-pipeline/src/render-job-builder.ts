import {
  CreativeRenderSpecSchema,
  P1SceneContractV02Schema,
  RenderJobSchema,
  SchemeLiteContractSchema,
  type CreativeRenderSpec,
  type GalleryEligibilityDecision,
  type P1SceneContractV02,
  type RenderCandidate,
  type RenderJob,
  type RenderJobCoverageSummary,
  type RenderJobIssue,
  type RenderRoomJob,
  type RenderVerificationReport,
  type SchemeLiteContract
} from "@homeai/contracts";

export const renderPipelineTimestamp = "2026-05-14T00:00:00.000Z";

export function buildRenderJobFromCreativeRenderSpecs(input: {
  schemeLiteContract: SchemeLiteContract;
  sceneContract: P1SceneContractV02;
  creativeRenderSpecs: CreativeRenderSpec[];
  candidates?: RenderCandidate[];
  verificationReports?: RenderVerificationReport[];
  galleryEligibility?: GalleryEligibilityDecision[];
  createdAt?: string;
  updatedAt?: string;
}): RenderJob {
  const scheme = SchemeLiteContractSchema.parse(clone(input.schemeLiteContract));
  const scene = P1SceneContractV02Schema.parse(clone(input.sceneContract));
  const specs = input.creativeRenderSpecs.map((spec) => CreativeRenderSpecSchema.parse(clone(spec)));
  const candidates = clone(input.candidates ?? []);
  const verificationReports = clone(input.verificationReports ?? []);
  const galleryEligibility = clone(input.galleryEligibility ?? []);
  const createdAt = input.createdAt ?? renderPipelineTimestamp;
  const updatedAt = input.updatedAt ?? createdAt;

  assertTraceAlignment(scheme, scene, specs);

  const validRooms = [...scene.rooms].sort((a, b) => a.roomId.localeCompare(b.roomId));
  const roomJobs = validRooms.map((room): RenderRoomJob => {
    const roomSpecs = specs.filter((spec) => spec.roomId === room.roomId).sort((a, b) => a.renderSpecId.localeCompare(b.renderSpecId));
    const roomCandidates = candidates.filter((candidate) => candidate.roomId === room.roomId);
    const roomReports = verificationReports.filter((report) => report.roomId === room.roomId);
    const eligible = galleryEligibility.filter((decision) =>
      roomCandidates.some((candidate) => candidate.renderCandidateId === decision.renderCandidateId) &&
      decision.status === "eligible"
    );
    const issues = buildRoomIssues(room.roomId, roomSpecs);
    const verifiedPassCount = roomReports.filter((report) => report.status === "pass").length;
    const verifiedWarningCount = roomReports.filter((report) => report.status === "warning").length;
    const verifiedFailCount = roomReports.filter((report) => report.status === "fail").length;

    return {
      roomId: room.roomId,
      roomType: room.roomType,
      geometryHash: scene.geometryHash,
      status: roomStatus(roomSpecs.length, roomCandidates.length, roomReports.length, verifiedFailCount),
      renderSpecIds: roomSpecs.map((spec) => spec.renderSpecId),
      candidateIds: roomCandidates.map((candidate) => candidate.renderCandidateId).sort(),
      verificationReportIds: roomReports.map((report) => report.renderVerificationReportId).sort(),
      coverage: {
        expectedSpecCount: roomSpecs.length,
        candidateCount: roomCandidates.length,
        verifiedPassCount,
        verifiedWarningCount,
        verifiedFailCount,
        galleryEligibleCount: eligible.length
      },
      issues
    };
  });
  const coverage = buildCoverage(roomJobs);

  return deepFreeze(RenderJobSchema.parse({
    renderJobId: `render-job-${scheme.schemeId}`,
    schemeId: scheme.schemeId,
    homeId: scheme.homeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scene.sceneContractId,
    geometryHash: scene.geometryHash,
    source: {
      schemeLiteContractId: scheme.schemeId,
      compilerVersion: "0.1.0"
    },
    status: jobStatus(coverage, roomJobs),
    roomJobs,
    coverage,
    trace: {
      traceId: `render-job-trace-${scheme.schemeId}`,
      sourceModule: "render_job_builder",
      networkCalls: false,
      providerCalls: [
        {
          providerId: "none",
          providerKind: "none",
          startedAt: createdAt,
          completedAt: createdAt,
          status: "skipped"
        }
      ],
      inputHashes: {
        geometryHash: scene.geometryHash
      },
      warnings: coverage.missingRoomIds.length === 0 ? [] : ["one or more valid rooms are missing render spec coverage"]
    },
    createdAt,
    updatedAt
  }));
}

function assertTraceAlignment(
  scheme: SchemeLiteContract,
  scene: P1SceneContractV02,
  specs: CreativeRenderSpec[]
): void {
  if (
    scene.homeId !== scheme.homeId ||
    scene.canonicalRevisionId !== scheme.floorplanRevisionId ||
    scene.sceneContractId !== scheme.sceneContractId ||
    scene.geometryHash !== scheme.geometryHash
  ) {
    throw new Error("SceneContract trace does not match SchemeLiteContract.");
  }

  for (const spec of specs) {
    if (
      spec.schemeId !== scheme.schemeId ||
      spec.homeId !== scheme.homeId ||
      spec.floorplanRevisionId !== scheme.floorplanRevisionId ||
      spec.sceneContractId !== scheme.sceneContractId ||
      spec.geometryHash !== scheme.geometryHash
    ) {
      throw new Error(`CreativeRenderSpec trace does not match SchemeLiteContract: ${spec.renderSpecId}.`);
    }
  }
}

function buildRoomIssues(roomId: string, roomSpecs: CreativeRenderSpec[]): RenderJobIssue[] {
  if (roomSpecs.length > 0) {
    return [];
  }
  return [
    {
      issueId: `missing-render-spec-${roomId}`,
      severity: "blocking",
      code: "ROOM_RENDER_SPEC_MISSING",
      message: "Valid room is missing render spec coverage.",
      roomId
    }
  ];
}

function buildCoverage(roomJobs: RenderRoomJob[]): RenderJobCoverageSummary {
  const missingRoomIds = roomJobs.filter((roomJob) => roomJob.renderSpecIds.length === 0).map((roomJob) => roomJob.roomId).sort();
  const totalVerificationReportCount = roomJobs.reduce((sum, roomJob) => sum + roomJob.verificationReportIds.length, 0);
  const galleryEligibleCandidateCount = roomJobs.reduce((sum, roomJob) => sum + roomJob.coverage.galleryEligibleCount, 0);
  return {
    validRoomCount: roomJobs.length,
    coveredRoomCount: roomJobs.length - missingRoomIds.length,
    missingRoomIds,
    totalRenderSpecCount: roomJobs.reduce((sum, roomJob) => sum + roomJob.renderSpecIds.length, 0),
    totalCandidateCount: roomJobs.reduce((sum, roomJob) => sum + roomJob.candidateIds.length, 0),
    totalVerificationReportCount,
    galleryEligibleCandidateCount,
    status: missingRoomIds.length > 0 ? "fail" : totalVerificationReportCount === 0 ? "warning" : "pass"
  };
}

function roomStatus(
  specCount: number,
  candidateCount: number,
  reportCount: number,
  failedReportCount: number
): RenderRoomJob["status"] {
  if (specCount === 0) {
    return "skipped";
  }
  if (candidateCount === 0) {
    return "queued";
  }
  if (reportCount === 0) {
    return "running";
  }
  if (failedReportCount === 0) {
    return "completed";
  }
  return failedReportCount === reportCount ? "failed" : "partial_failed";
}

function jobStatus(coverage: RenderJobCoverageSummary, roomJobs: RenderRoomJob[]): RenderJob["status"] {
  if (coverage.status === "fail") {
    return "failed";
  }
  if (roomJobs.some((roomJob) => roomJob.status === "failed" || roomJob.status === "partial_failed")) {
    return "partial_failed";
  }
  if (roomJobs.every((roomJob) => roomJob.status === "completed")) {
    return "completed";
  }
  if (roomJobs.some((roomJob) => roomJob.status === "running")) {
    return "running";
  }
  return "queued";
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
