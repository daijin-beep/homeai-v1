import {
  SchemeLiteContractSchema,
  SchemePageDebugPayloadSchema,
  SchemePagePreviewRequestSchema,
  SchemePageRenderStatusShellSchema,
  SchemePageVerificationSchema,
  SchemePageViewModelSchema,
  SchemeRenderGalleryViewModelSchema,
  type RoomSchemeLite,
  type SchemeLiteContract,
  type SchemePageCoverageSummary,
  type SchemePageDebugPayload,
  type SchemePagePresentationDepth,
  type SchemePagePreviewRequest,
  type SchemePageRenderRoomStatus,
  type SchemePageRenderStatusShell,
  type SchemePageRenderStatusSource,
  type SchemePageRenderStatusSummary,
  type SchemePageRoomActionHint,
  type SchemePageRoomCard,
  type SchemePageVerification,
  type SchemePageVerificationCheck,
  type SchemePageViewModel,
  type SchemePageWarning,
  type SchemeRenderGalleryViewModel
} from "@homeai/contracts";

export {
  createSchemePageFixtureContract,
  schemePageFixtureGeometryHash,
  schemePageFixtureLayoutIntentHash,
  schemePageFixtureTimestamp
} from "./fixtures.js";

export type SchemePageBuildOptions = {
  generatedAt?: string;
  title?: string;
};

export type SchemePageRenderStatusShellInput = {
  viewModel: SchemePageViewModel;
  renderGalleryViewModel?: SchemeRenderGalleryViewModel;
  generatedAt?: string;
  source?: SchemePageRenderStatusSource;
};

const DEFAULT_GENERATED_AT = "2026-05-14T00:00:00.000Z";

const ROOM_GROUP_ORDER: Record<string, number> = {
  living_room: 1,
  living_dining: 1,
  dining_room: 1,
  kitchen: 1,
  entry: 1,
  primary_bedroom: 2,
  bedroom: 2,
  secondary_bedroom: 2,
  kids_room: 2,
  study: 2,
  bathroom: 3,
  cloakroom: 3,
  storage: 3,
  balcony: 4,
  corridor: 4
};

export function buildSchemePageViewModelFromSchemeLite(
  rawScheme: SchemeLiteContract,
  options: SchemePageBuildOptions = {}
): SchemePageViewModel {
  const scheme = SchemeLiteContractSchema.parse(clone(rawScheme));
  const orderedRooms = [...scheme.rooms].sort(compareRoomSchemes);
  const cards = orderedRooms.map((room) => buildRoomCard(scheme, room));
  const warnings = buildWarnings(scheme, cards);
  const coverage = buildCoverage(cards, warnings);
  const viewModel = SchemePageViewModelSchema.parse({
    version: "0.1",
    header: {
      title: options.title ?? `Scheme ${scheme.schemeId}`,
      schemeId: scheme.schemeId,
      status: scheme.verification.status,
      briefSummary: scheme.brief.summary,
      createdAt: scheme.createdAt
    },
    coverage,
    trace: traceForScheme(scheme),
    budget: {
      band: scheme.budget.band,
      currency: "CNY",
      ...(scheme.budget.minCny === undefined ? {} : { minCny: scheme.budget.minCny }),
      ...(scheme.budget.maxCny === undefined ? {} : { maxCny: scheme.budget.maxCny }),
      notes: scheme.budget.notes
    },
    style: {
      displayName: scheme.style.displayName,
      tags: scheme.style.tags,
      palette: scheme.style.palette,
      materialTags: scheme.style.materialTags
    },
    rooms: cards,
    warnings,
    actions: buildActions(scheme, warnings),
    generatedAt: options.generatedAt ?? DEFAULT_GENERATED_AT
  });

  const verification = verifySchemePageViewModel(viewModel, scheme);
  if (verification.status === "fail") {
    throw new Error(verification.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "));
  }

  return deepFreeze(viewModel);
}

export function verifySchemePageViewModel(
  rawViewModel: SchemePageViewModel,
  rawScheme: SchemeLiteContract
): SchemePageVerification {
  const scheme = SchemeLiteContractSchema.parse(clone(rawScheme));
  const viewModel = SchemePageViewModelSchema.parse(clone(rawViewModel));
  const checks: SchemePageVerificationCheck[] = [];

  addTraceChecks(checks, viewModel, scheme);
  addCoverageChecks(checks, viewModel, scheme);
  addRoomTraceChecks(checks, viewModel);
  addForbiddenClaimChecks(checks, viewModel);

  return SchemePageVerificationSchema.parse({
    status: aggregateStatus(checks),
    checks
  });
}

export function assertSchemePageFullSpaceCoverage(
  viewModel: SchemePageViewModel,
  scheme: SchemeLiteContract
): void {
  const verification = verifySchemePageViewModel(viewModel, scheme);
  const failures = verification.checks.filter((check) =>
    check.status === "fail" && check.checkId.startsWith("coverage-")
  );
  if (failures.length > 0) {
    throw new Error(failures.map((check) => check.message).join(" "));
  }
}

export function buildSchemePageDebugPayload(
  rawInput: SchemePagePreviewRequest
): SchemePageDebugPayload {
  const input = SchemePagePreviewRequestSchema.parse(clone(rawInput));
  const viewModel = buildSchemePageViewModelFromSchemeLite(input.scheme);
  const renderStatusShell = buildSchemePageRenderStatusShell({ viewModel });
  const pageVerification = verifySchemePageViewModel(viewModel, input.scheme);

  if (pageVerification.status === "fail") {
    throw new Error(pageVerification.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "));
  }

  return deepFreeze(SchemePageDebugPayloadSchema.parse({
    request: {
      schemeId: input.scheme.schemeId
    },
    scheme: input.scheme,
    viewModel,
    schemeVerification: input.scheme.verification,
    pageVerification,
    trace: viewModel.trace,
    coverage: viewModel.coverage,
    renderStatusShell,
    warnings: viewModel.warnings
  }));
}

export function buildSchemePageRenderStatusShell(
  rawInput: SchemePageRenderStatusShellInput
): SchemePageRenderStatusShell {
  const viewModel = SchemePageViewModelSchema.parse(clone(rawInput.viewModel));
  const gallery = rawInput.renderGalleryViewModel === undefined
    ? undefined
    : SchemeRenderGalleryViewModelSchema.parse(clone(rawInput.renderGalleryViewModel));

  if (gallery !== undefined) {
    assertRenderGalleryTraceAlignment(viewModel, gallery);
  }

  const galleryRoomsById = new Map((gallery?.rooms ?? []).map((room) => [room.roomId, room]));
  const rooms = viewModel.rooms.map((room): SchemePageRenderRoomStatus => {
    const galleryRoom = galleryRoomsById.get(room.roomId);
    const issues = uniqueSorted(galleryRoom?.issues ?? []);

    return {
      roomId: room.roomId,
      roomLabel: room.roomLabel,
      roomType: room.roomType,
      presentationDepth: room.presentationDepth,
      renderStatus: galleryRoom?.renderStatus ?? "not_started",
      eligibleCandidateCount: galleryRoom?.eligibleCandidateCount ?? 0,
      blockedCandidateCount: galleryRoom?.blockedCandidateCount ?? 0,
      warningCandidateCount: galleryRoom?.warningCandidateCount ?? 0,
      issueCount: issues.length,
      issues
    };
  });
  const summary = buildRenderStatusSummary(rooms);

  return deepFreeze(SchemePageRenderStatusShellSchema.parse({
    version: "0.1",
    source: rawInput.source ?? (gallery === undefined ? "view_model" : "deterministic_fixture"),
    trace: viewModel.trace,
    summary,
    rooms,
    generatedAt: rawInput.generatedAt ?? viewModel.generatedAt
  }));
}

function buildRoomCard(scheme: SchemeLiteContract, room: RoomSchemeLite): SchemePageRoomCard {
  const depth = presentationDepthForRoom(room);
  const roomWarnings = [
    ...room.issues.map((issue) => issue.message),
    ...room.riskFlags.map((flag) => `Review ${flag}.`)
  ].sort();

  return {
    roomId: room.roomId,
    roomType: room.roomType,
    roomLabel: labelForRoom(room),
    role: room.role,
    presentationDepth: depth,
    summary: room.designIntent,
    keyMoves: [
      ...room.keyMoves,
      room.storageStrategy,
      ...room.circulationNotes,
      ...room.lightingNotes
    ],
    warnings: roomWarnings,
    anchorRefs: room.anchorRefs.map((ref) => ref.anchorId).sort(),
    ...(room.layoutIntentRefs.length === 0 ? {} : { layoutIntentRefs: room.layoutIntentRefs.map((ref) => ref.placeholderId).sort() }),
    trace: {
      homeId: scheme.homeId,
      floorplanRevisionId: scheme.floorplanRevisionId,
      sceneContractId: scheme.sceneContractId,
      geometryHash: scheme.geometryHash,
      ...(scheme.layoutIntentHash === undefined ? {} : { layoutIntentHash: scheme.layoutIntentHash })
    }
  };
}

function buildCoverage(cards: readonly SchemePageRoomCard[], warnings: readonly SchemePageWarning[]): SchemePageCoverageSummary {
  return {
    totalRooms: cards.length,
    primaryRooms: cards.filter((card) => card.presentationDepth === "primary").length,
    standardRooms: cards.filter((card) => card.presentationDepth === "standard").length,
    lightRooms: cards.filter((card) => card.presentationDepth === "light").length,
    warningCount: warnings.filter((warning) => warning.severity === "warning").length,
    failCount: warnings.filter((warning) => warning.severity === "error").length
  };
}

function buildWarnings(scheme: SchemeLiteContract, cards: readonly SchemePageRoomCard[]): SchemePageWarning[] {
  const schemeWarnings = [
    ...scheme.verification.checks
      .filter((check) => check.status !== "pass")
      .map((check): SchemePageWarning => ({
        warningId: `scheme-warning-${check.checkId}`,
        severity: check.status === "fail" ? "error" : "warning",
        message: check.message,
        ...(check.roomId === undefined ? {} : { roomId: check.roomId })
      })),
    ...scheme.trace.warnings.map((message, index): SchemePageWarning => ({
      warningId: `trace-warning-${index + 1}`,
      severity: "warning",
      message
    }))
  ];
  const roomWarnings = cards.flatMap((card) =>
    card.warnings.map((message, index): SchemePageWarning => ({
      warningId: `room-warning-${card.roomId}-${index + 1}`,
      severity: "warning",
      message,
      roomId: card.roomId
    }))
  );

  return [...schemeWarnings, ...roomWarnings].sort((a, b) => a.warningId.localeCompare(b.warningId));
}

function buildActions(
  scheme: SchemeLiteContract,
  warnings: readonly SchemePageWarning[]
): SchemePageRoomActionHint[] {
  return [
    {
      actionId: "ready-for-render-spec-later",
      kind: "ready_for_render_spec_later",
      label: "Ready for later visual planning"
    },
    ...(warnings.length === 0
      ? []
      : [{
          actionId: "needs-human-review",
          kind: "needs_human_review" as const,
          label: "Review warnings before the next stage"
        }]),
    ...(scheme.layoutIntentHash === undefined
      ? []
      : [{
          actionId: "layout-intent-present",
          kind: "layout_intent_present" as const,
          label: "Layout intent references included"
        }])
  ];
}

function assertRenderGalleryTraceAlignment(
  viewModel: SchemePageViewModel,
  gallery: SchemeRenderGalleryViewModel
): void {
  if (
    gallery.schemeId !== viewModel.trace.schemeId ||
    gallery.homeId !== viewModel.trace.homeId ||
    gallery.floorplanRevisionId !== viewModel.trace.floorplanRevisionId ||
    gallery.sceneContractId !== viewModel.trace.sceneContractId ||
    gallery.geometryHash !== viewModel.trace.geometryHash
  ) {
    throw new Error("Render gallery view model trace does not match Scheme Page view model.");
  }
}

function buildRenderStatusSummary(
  rooms: readonly SchemePageRenderRoomStatus[]
): SchemePageRenderStatusSummary {
  const notStartedRooms = rooms.filter((room) => room.renderStatus === "not_started").length;
  const pendingRooms = rooms.filter((room) => room.renderStatus === "pending").length;
  const roomsWithEligibleRender = rooms.filter((room) => room.renderStatus === "has_eligible_render").length;
  const roomsNeedingHumanReview = rooms.filter((room) => room.renderStatus === "human_review_required").length;
  const roomsFailed = rooms.filter((room) => room.renderStatus === "failed").length;
  const roomsMissingCoverage = rooms.filter((room) => room.renderStatus === "missing_coverage").length;
  const eligibleCandidateCount = rooms.reduce((sum, room) => sum + room.eligibleCandidateCount, 0);
  const blockedCandidateCount = rooms.reduce((sum, room) => sum + room.blockedCandidateCount, 0);
  const warningCandidateCount = rooms.reduce((sum, room) => sum + room.warningCandidateCount, 0);

  return {
    totalRooms: rooms.length,
    notStartedRooms,
    pendingRooms,
    roomsWithEligibleRender,
    roomsNeedingHumanReview,
    roomsFailed,
    roomsMissingCoverage,
    eligibleCandidateCount,
    blockedCandidateCount,
    warningCandidateCount,
    status: renderStatusSummaryStatus({
      totalRooms: rooms.length,
      notStartedRooms,
      pendingRooms,
      roomsWithEligibleRender,
      roomsNeedingHumanReview,
      roomsFailed,
      roomsMissingCoverage
    })
  };
}

function renderStatusSummaryStatus(input: {
  totalRooms: number;
  notStartedRooms: number;
  pendingRooms: number;
  roomsWithEligibleRender: number;
  roomsNeedingHumanReview: number;
  roomsFailed: number;
  roomsMissingCoverage: number;
}): SchemePageRenderStatusSummary["status"] {
  if (input.roomsFailed > 0 || input.roomsMissingCoverage > 0) {
    return "blocked";
  }
  if (input.roomsNeedingHumanReview > 0) {
    return "needs_review";
  }
  if (input.roomsWithEligibleRender === input.totalRooms && input.totalRooms > 0) {
    return "ready";
  }
  if (input.pendingRooms > 0 || input.roomsWithEligibleRender > 0) {
    return "in_progress";
  }
  return "not_started";
}

function compareRoomSchemes(a: RoomSchemeLite, b: RoomSchemeLite): number {
  const groupDelta = roomGroup(a.roomType) - roomGroup(b.roomType);
  if (groupDelta !== 0) {
    return groupDelta;
  }
  const depthDelta = depthRank(presentationDepthForRoom(a)) - depthRank(presentationDepthForRoom(b));
  if (depthDelta !== 0) {
    return depthDelta;
  }
  return a.roomId.localeCompare(b.roomId);
}

function roomGroup(roomType: string): number {
  return ROOM_GROUP_ORDER[roomType] ?? 5;
}

function presentationDepthForRoom(room: RoomSchemeLite): SchemePagePresentationDepth {
  if (room.roomType === "living_room" || room.roomType === "living_dining" || room.roomType === "primary_bedroom") {
    return "primary";
  }
  if (
    room.roomType === "bedroom" ||
    room.roomType === "secondary_bedroom" ||
    room.roomType === "kids_room" ||
    room.roomType === "study" ||
    room.roomType === "kitchen" ||
    room.roomType === "bathroom"
  ) {
    return "standard";
  }
  return "light";
}

function depthRank(depth: SchemePagePresentationDepth): number {
  switch (depth) {
    case "primary":
      return 1;
    case "standard":
      return 2;
    case "light":
      return 3;
  }
}

function labelForRoom(room: RoomSchemeLite): string {
  return room.displayLabel ?? room.roomType.replaceAll("_", " ");
}

function traceForScheme(scheme: SchemeLiteContract) {
  return {
    homeId: scheme.homeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scheme.sceneContractId,
    geometryHash: scheme.geometryHash,
    ...(scheme.layoutIntentHash === undefined ? {} : { layoutIntentHash: scheme.layoutIntentHash }),
    schemeId: scheme.schemeId
  };
}

function addTraceChecks(
  checks: SchemePageVerificationCheck[],
  viewModel: SchemePageViewModel,
  scheme: SchemeLiteContract
): void {
  addCheck(checks, "trace-home", viewModel.trace.homeId === scheme.homeId, "View model homeId matches scheme.");
  addCheck(
    checks,
    "trace-floorplan-revision",
    viewModel.trace.floorplanRevisionId === scheme.floorplanRevisionId,
    "View model floorplanRevisionId matches scheme."
  );
  addCheck(
    checks,
    "trace-scene-contract",
    viewModel.trace.sceneContractId === scheme.sceneContractId,
    "View model sceneContractId matches scheme."
  );
  addCheck(
    checks,
    "trace-geometry-hash",
    viewModel.trace.geometryHash === scheme.geometryHash,
    "View model geometryHash matches scheme."
  );
  addCheck(
    checks,
    "trace-layout-intent-hash",
    viewModel.trace.layoutIntentHash === scheme.layoutIntentHash,
    "View model layoutIntentHash matches scheme state."
  );
  addCheck(checks, "trace-scheme-id", viewModel.trace.schemeId === scheme.schemeId, "View model schemeId matches scheme.");
}

function addCoverageChecks(
  checks: SchemePageVerificationCheck[],
  viewModel: SchemePageViewModel,
  scheme: SchemeLiteContract
): void {
  const schemeRoomIds = scheme.rooms.map((room) => room.roomId).sort();
  const cardRoomIds = viewModel.rooms.map((room) => room.roomId).sort();
  addCheck(
    checks,
    "coverage-room-count",
    schemeRoomIds.length === cardRoomIds.length,
    "Room card count matches SchemeLite room count."
  );
  for (const roomId of schemeRoomIds) {
    const count = viewModel.rooms.filter((room) => room.roomId === roomId).length;
    addCheck(checks, `coverage-room-${roomId}`, count === 1, `Room ${roomId} has exactly one visible card.`, roomId);
  }
  const extraRoomIds = cardRoomIds.filter((roomId) => !schemeRoomIds.includes(roomId));
  addCheck(checks, "coverage-no-extra-rooms", extraRoomIds.length === 0, "View model has no extra room cards.");
}

function addRoomTraceChecks(checks: SchemePageVerificationCheck[], viewModel: SchemePageViewModel): void {
  for (const room of viewModel.rooms) {
    addCheck(
      checks,
      `room-trace-${room.roomId}`,
      room.trace.homeId === viewModel.trace.homeId &&
        room.trace.floorplanRevisionId === viewModel.trace.floorplanRevisionId &&
        room.trace.sceneContractId === viewModel.trace.sceneContractId &&
        room.trace.geometryHash === viewModel.trace.geometryHash &&
        room.trace.layoutIntentHash === viewModel.trace.layoutIntentHash,
      `Room card ${room.roomId} trace matches page trace.`,
      room.roomId
    );
  }
}

function addForbiddenClaimChecks(checks: SchemePageVerificationCheck[], viewModel: SchemePageViewModel): void {
  const serialized = JSON.stringify(viewModel);
  const forbidden = [
    pattern(["s", "ku"]),
    pattern(["product", "Url"]),
    pattern(["check", "out"]),
    pattern(["pay", "ment"]),
    pattern(["p", "df"]),
    pattern(["d", "wg"]),
    pattern(["d", "xf"]),
    pattern(["load", "-", "bearing"]),
    pattern(["struct", "ural"])
  ];
  addCheck(
    checks,
    "forbidden-claims-absent",
    !forbidden.some((pattern) => pattern.test(serialized)),
    "View model avoids unsupported downstream claims."
  );
}

function pattern(parts: string[]): RegExp {
  return new RegExp(parts.join(""), "i");
}

function addCheck(
  checks: SchemePageVerificationCheck[],
  checkId: string,
  passes: boolean,
  message: string,
  roomId?: string
): void {
  checks.push({
    checkId,
    status: passes ? "pass" : "fail",
    message,
    ...(roomId === undefined ? {} : { roomId })
  });
}

function aggregateStatus(checks: readonly SchemePageVerificationCheck[]): SchemePageVerification["status"] {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  return "pass";
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
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
