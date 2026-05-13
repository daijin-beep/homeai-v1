import {
  BudgetProfileSchema,
  DesignBriefLiteSchema,
  DesignKernelDebugPayloadSchema,
  DesignKernelInputSchema,
  DesignKernelProviderTraceSchema,
  RoomRolePlanSchema,
  RoomSchemeLiteSchema,
  SchemeLiteContractSchema,
  SchemeVerificationSchema,
  StylePacketSchema,
  UserBriefInputSchema,
  type BudgetProfile,
  type DesignBriefLite,
  type DesignKernelDebugPayload,
  type DesignKernelInput,
  type DesignKernelProviderTrace,
  type DesignKernelStatus,
  type LayoutIntentContract,
  type P1AnchorPlan,
  type P1RoomType,
  type RoomRolePlan,
  type RoomRolePlanItem,
  type RoomSchemeLite,
  type RoomSchemeLiteAnchorRef,
  type RoomSchemeLiteIssue,
  type RoomSchemeLiteLayoutIntentRef,
  type SchemeLiteContract,
  type SchemeVerification,
  type SchemeVerificationCheck,
  type StylePacket,
  type UserBriefInput
} from "@homeai/contracts";

export type BuildDesignKernelInputArgs = {
  inputId: string;
  homeId: string;
  floorplanRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  sceneContract: DesignKernelInput["sceneContract"];
  roomAffordanceGraph: DesignKernelInput["roomAffordanceGraph"];
  anchorPlans: readonly P1AnchorPlan[];
  cameraPlan?: DesignKernelInput["cameraPlan"];
  layoutIntentContract?: LayoutIntentContract;
  userBriefInput?: UserBriefInput;
  source?: DesignKernelInput["source"];
};

export type CompileMockSchemeLiteOptions = {
  schemeId?: string;
  createdAt?: string;
  traceId?: string;
  providerVersion?: string;
};

export interface DesignKernelProvider {
  compile(input: DesignKernelInput, options?: CompileMockSchemeLiteOptions): SchemeLiteContract;
}

export class DeterministicMockDesignKernelProvider implements DesignKernelProvider {
  compile(input: DesignKernelInput, options: CompileMockSchemeLiteOptions = {}): SchemeLiteContract {
    return compileMockSchemeLite(input, options);
  }
}

const DEFAULT_TIMESTAMP = "2026-05-13T00:00:00.000Z";

const ROOM_ROLE_BY_TYPE: Record<P1RoomType, string> = {
  bedroom: "sleep",
  primary_bedroom: "primary sleep",
  secondary_bedroom: "secondary sleep",
  kids_room: "kids room",
  living_room: "living",
  dining_room: "dining",
  kitchen: "cooking",
  bathroom: "bath",
  balcony: "balcony",
  study: "work",
  storage: "storage",
  entry: "entry",
  corridor: "circulation",
  cloakroom: "cloakroom",
  living_dining: "living and dining"
};

export function buildDesignKernelInputFromP1Artifacts(args: BuildDesignKernelInputArgs): DesignKernelInput {
  const userBriefInput = args.userBriefInput ?? defaultUserBriefInput(args.homeId);
  const rawInput = {
    inputId: args.inputId,
    homeId: args.homeId,
    floorplanRevisionId: args.floorplanRevisionId,
    sceneContractId: args.sceneContractId,
    geometryHash: args.geometryHash,
    sceneContract: clone(args.sceneContract),
    roomAffordanceGraph: clone(args.roomAffordanceGraph),
    anchorPlans: args.anchorPlans.map((plan) => clone(plan)),
    ...(args.cameraPlan === undefined ? {} : { cameraPlan: clone(args.cameraPlan) }),
    ...(args.layoutIntentContract === undefined
      ? {}
      : {
          layoutIntentContract: clone(args.layoutIntentContract),
          layoutIntentHash: args.layoutIntentContract.layoutIntentHash
        }),
    userBriefInput: clone(userBriefInput),
    source: args.source ?? "p1_confirmed_scene_contract"
  };

  return deepFreeze(DesignKernelInputSchema.parse(rawInput));
}

export function compileMockSchemeLite(
  rawInput: DesignKernelInput,
  options: CompileMockSchemeLiteOptions = {}
): SchemeLiteContract {
  const input = DesignKernelInputSchema.parse(clone(rawInput));
  const createdAt = options.createdAt ?? DEFAULT_TIMESTAMP;
  const brief = buildBrief(input.userBriefInput);
  const budget = buildBudget(input.userBriefInput);
  const style = buildStyle(input.userBriefInput);
  const roomRolePlan = buildRoomRolePlan(input);
  const roomSchemes = input.sceneContract.rooms
    .map((room) => buildRoomScheme(input, roomRolePlan, room.roomId))
    .sort((a, b) => a.roomId.localeCompare(b.roomId));
  const provisionalTrace = buildProviderTrace(input, {
    createdAt,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
    ...(options.providerVersion === undefined ? {} : { providerVersion: options.providerVersion }),
    status: "pass",
    warnings: []
  });
  const provisional = SchemeLiteContractSchema.parse({
    version: "0.1",
    schemeId: options.schemeId ?? `scheme-lite-${input.inputId}`,
    homeId: input.homeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    ...(input.layoutIntentHash === undefined ? {} : { layoutIntentHash: input.layoutIntentHash }),
    brief,
    budget,
    style,
    roomRolePlan,
    rooms: roomSchemes,
    verification: {
      status: "pass",
      checks: []
    },
    trace: provisionalTrace,
    createdAt
  });
  const verification = verifySchemeLiteContract(input, provisional);
  const finalTrace = buildProviderTrace(input, {
    createdAt,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
    ...(options.providerVersion === undefined ? {} : { providerVersion: options.providerVersion }),
    status: verification.status,
    warnings: verification.checks
      .filter((check) => check.status === "warning")
      .map((check) => check.message)
  });

  return deepFreeze(SchemeLiteContractSchema.parse({
    ...provisional,
    verification,
    trace: finalTrace
  }));
}

export function verifySchemeLiteContract(
  rawInput: DesignKernelInput,
  rawScheme: SchemeLiteContract
): SchemeVerification {
  const input = DesignKernelInputSchema.parse(clone(rawInput));
  const scheme = SchemeLiteContractSchema.parse(clone(rawScheme));
  const checks: SchemeVerificationCheck[] = [];

  addTraceChecks(checks, input, scheme);
  addCoverageChecks(checks, input, scheme);
  addRoomIntegrityChecks(checks, input, scheme);
  addReferenceChecks(checks, input, scheme);
  addNoFinalCoordinateChecks(checks, scheme);

  return SchemeVerificationSchema.parse({
    status: aggregateStatus(checks),
    checks
  });
}

export function assertSchemeLiteFullSpaceCoverage(
  input: DesignKernelInput,
  scheme: SchemeLiteContract
): void {
  const verification = verifySchemeLiteContract(input, scheme);
  const blocking = verification.checks.filter((check) =>
    check.checkId.startsWith("coverage-") && check.status === "fail"
  );
  if (blocking.length > 0) {
    throw new Error(blocking.map((check) => check.message).join(" "));
  }
}

export function buildDesignKernelDebugPayload(
  input: DesignKernelInput,
  options: CompileMockSchemeLiteOptions = {}
): DesignKernelDebugPayload {
  const parsedInput = DesignKernelInputSchema.parse(clone(input));
  const scheme = compileMockSchemeLite(parsedInput, options);
  const anchorRefCount = scheme.rooms.reduce((count, room) => count + room.anchorRefs.length, 0);
  const layoutIntentRefCount = scheme.rooms.reduce((count, room) => count + room.layoutIntentRefs.length, 0);

  return deepFreeze(DesignKernelDebugPayloadSchema.parse({
    input: parsedInput,
    scheme,
    verification: scheme.verification,
    trace: scheme.trace,
    coverage: {
      sceneRoomCount: parsedInput.sceneContract.rooms.length,
      roomSchemeCount: scheme.rooms.length,
      hasLayoutIntent: parsedInput.layoutIntentContract !== undefined,
      anchorRefCount,
      layoutIntentRefCount
    }
  }));
}

export function defaultUserBriefInput(homeId: string): UserBriefInput {
  return UserBriefInputSchema.parse({
    homeId,
    language: "unknown",
    budgetBand: "unknown",
    source: "default"
  });
}

function buildBrief(input: UserBriefInput): DesignBriefLite {
  return DesignBriefLiteSchema.parse({
    summary: input.text ?? "Use the confirmed floorplan and room semantics as the design baseline.",
    language: input.language,
    householdProfile: input.householdHints ?? [],
    functionalNeeds: input.functionalNeeds ?? [],
    avoid: input.avoid ?? [],
    unknowns: input.source === "default" ? ["user brief not provided"] : [],
    source: input.source === "default" ? "default" : "deterministic_mock"
  });
}

function buildBudget(input: UserBriefInput): BudgetProfile {
  return BudgetProfileSchema.parse({
    currency: "CNY",
    band: input.budgetBand,
    ...(input.budgetMinCny === undefined ? {} : { minCny: input.budgetMinCny }),
    ...(input.budgetMaxCny === undefined ? {} : { maxCny: input.budgetMaxCny }),
    confidence: input.budgetBand === "unknown" ? 0.4 : 0.8,
    notes: input.budgetBand === "unknown"
      ? ["Budget preference is not specified."]
      : ["Budget preference is treated as planning guidance only."]
  });
}

function buildStyle(input: UserBriefInput): StylePacket {
  const tags = normalizeTags(input.styleTags ?? []);
  const selectedTags = tags.length === 0 ? ["practical", "quiet", "warm"] : tags;
  return StylePacketSchema.parse({
    styleId: `style-${input.homeId}-${selectedTags.join("-")}`,
    displayName: selectedTags.join(" / "),
    tags: selectedTags,
    palette: ["warm white", "soft gray", "natural wood"],
    materialTags: ["paint", "wood", "fabric"],
    avoidTokens: input.avoid ?? [],
    source: tags.length === 0 ? "deterministic_default" : "user_brief",
    confidence: tags.length === 0 ? 0.5 : 0.8
  });
}

function buildRoomRolePlan(input: DesignKernelInput): RoomRolePlan {
  const rooms = input.sceneContract.rooms
    .map((room): RoomRolePlanItem => {
      const graphRoom = input.roomAffordanceGraph.rooms.find((candidate) => candidate.roomId === room.roomId);
      const layoutRefs = input.layoutIntentContract?.placeholders.filter((placeholder) => placeholder.roomId === room.roomId) ?? [];
      return {
        roomId: room.roomId,
        roomType: room.roomType,
        inferredRole: ROOM_ROLE_BY_TYPE[room.roomType],
        confidence: graphRoom === undefined ? 0.55 : 0.8,
        source: layoutRefs.length > 0 ? "layout_intent" : graphRoom === undefined ? "scene_room_type" : "affordance_graph",
        reasons: [
          `roomType=${room.roomType}`,
          ...(graphRoom === undefined ? [] : [`usableAreaMm2=${Math.round(graphRoom.usableAreaMm2)}`]),
          ...(layoutRefs.length === 0 ? [] : [`layoutPlaceholders=${layoutRefs.length}`])
        ],
        riskFlags: graphRoom === undefined ? ["affordance_graph_room_missing"] : []
      };
    })
    .sort((a, b) => a.roomId.localeCompare(b.roomId));

  return RoomRolePlanSchema.parse({
    homeId: input.homeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    ...(input.layoutIntentHash === undefined ? {} : { layoutIntentHash: input.layoutIntentHash }),
    rooms
  });
}

function buildRoomScheme(
  input: DesignKernelInput,
  rolePlan: RoomRolePlan,
  roomId: string
): RoomSchemeLite {
  const sceneRoom = input.sceneContract.rooms.find((room) => room.roomId === roomId);
  if (sceneRoom === undefined) {
    throw new Error(`Scene room not found: ${roomId}`);
  }
  const role = rolePlan.rooms.find((candidate) => candidate.roomId === roomId);
  if (role === undefined) {
    throw new Error(`Room role not found: ${roomId}`);
  }
  const anchorRefs = collectAnchorRefs(input.anchorPlans, roomId);
  const layoutIntentRefs = collectLayoutIntentRefs(input.layoutIntentContract, roomId);
  const issues: RoomSchemeLiteIssue[] = [
    ...(anchorRefs.length === 0
      ? [{
          issueId: `issue-room-no-anchor-${roomId}`,
          severity: "warning" as const,
          code: "ROOM_ANCHOR_REFERENCE_MISSING",
          message: "No anchor reference is available for this room."
        }]
      : [])
  ];
  const riskFlags = [
    ...role.riskFlags,
    ...(anchorRefs.length === 0 ? ["missing_anchor_reference"] : [])
  ].sort();

  return RoomSchemeLiteSchema.parse({
    roomSchemeId: `room-scheme-${input.inputId}-${roomId}`,
    homeId: input.homeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    ...(input.layoutIntentHash === undefined ? {} : { layoutIntentHash: input.layoutIntentHash }),
    roomId,
    roomType: sceneRoom.roomType,
    role: role.inferredRole,
    status: issues.length === 0 ? "pass" : "warning",
    designIntent: `Keep ${sceneRoom.roomType} as ${role.inferredRole} while preserving confirmed room geometry.`,
    keyMoves: layoutIntentRefs.length === 0
      ? [`Use ${role.inferredRole} as the planning role.`]
      : [`Respect ${layoutIntentRefs.length} user layout placeholder reference(s).`],
    storageStrategy: sceneRoom.roomType === "storage" || sceneRoom.roomType === "cloakroom"
      ? "Prioritize storage access and clear circulation."
      : "Keep storage guidance lightweight until product selection starts.",
    circulationNotes: ["Keep door, window, and balcony access references unobstructed."],
    lightingNotes: sceneRoom.roomType === "balcony"
      ? ["Treat balcony daylight as adjacent space context."]
      : ["Use room role and window references as lighting context."],
    anchorRefs,
    layoutIntentRefs,
    riskFlags,
    issues
  });
}

function collectAnchorRefs(anchorPlans: readonly P1AnchorPlan[], roomId: string): RoomSchemeLiteAnchorRef[] {
  return anchorPlans
    .flatMap((plan) =>
      plan.anchors
        .filter((anchor) => anchor.roomId === roomId)
        .map((anchor) => ({
          anchorPlanId: plan.anchorPlanId,
          anchorId: anchor.anchorId,
          type: anchor.type,
          ...(anchor.targetId === undefined ? {} : { targetId: anchor.targetId })
        }))
    )
    .sort((a, b) => `${a.anchorPlanId}:${a.anchorId}`.localeCompare(`${b.anchorPlanId}:${b.anchorId}`));
}

function collectLayoutIntentRefs(
  layoutIntentContract: LayoutIntentContract | undefined,
  roomId: string
): RoomSchemeLiteLayoutIntentRef[] {
  if (layoutIntentContract === undefined) {
    return [];
  }
  return layoutIntentContract.placeholders
    .filter((placeholder) => placeholder.roomId === roomId)
    .map((placeholder) => ({
      layoutIntentRevisionId: layoutIntentContract.layoutIntentRevisionId,
      placeholderId: placeholder.placeholderId,
      category: placeholder.category,
      ...(placeholder.label === undefined ? {} : { label: placeholder.label })
    }))
    .sort((a, b) => a.placeholderId.localeCompare(b.placeholderId));
}

function buildProviderTrace(
  input: DesignKernelInput,
  options: {
    createdAt: string;
    traceId?: string;
    providerVersion?: string;
    status: DesignKernelStatus;
    warnings: string[];
  }
): DesignKernelProviderTrace {
  return DesignKernelProviderTraceSchema.parse({
    traceId: options.traceId ?? `trace-${input.inputId}`,
    providerName: "deterministic_mock",
    providerVersion: options.providerVersion ?? "0.1.0",
    mode: "contract_only",
    inputId: input.inputId,
    status: options.status,
    networkCalls: false,
    warnings: options.warnings,
    startedAt: options.createdAt,
    completedAt: options.createdAt
  });
}

function addTraceChecks(
  checks: SchemeVerificationCheck[],
  input: DesignKernelInput,
  scheme: SchemeLiteContract
): void {
  addCheck(checks, "trace-home", scheme.homeId === input.homeId, "Scheme homeId matches input.");
  addCheck(
    checks,
    "trace-floorplan-revision",
    scheme.floorplanRevisionId === input.floorplanRevisionId,
    "Scheme floorplanRevisionId matches input."
  );
  addCheck(
    checks,
    "trace-scene-contract",
    scheme.sceneContractId === input.sceneContractId,
    "Scheme sceneContractId matches input."
  );
  addCheck(
    checks,
    "trace-geometry-hash",
    scheme.geometryHash === input.geometryHash,
    "Scheme geometryHash matches input."
  );
  addCheck(
    checks,
    "trace-layout-intent-hash",
    scheme.layoutIntentHash === input.layoutIntentHash,
    "Scheme layoutIntentHash matches input state."
  );
}

function addCoverageChecks(
  checks: SchemeVerificationCheck[],
  input: DesignKernelInput,
  scheme: SchemeLiteContract
): void {
  const sceneRoomIds = input.sceneContract.rooms.map((room) => room.roomId).sort();
  const schemeRoomIds = scheme.rooms.map((room) => room.roomId).sort();
  addCheck(
    checks,
    "coverage-room-count",
    sceneRoomIds.length === schemeRoomIds.length,
    "RoomSchemeLite count matches SceneContract room count."
  );
  for (const roomId of sceneRoomIds) {
    const count = scheme.rooms.filter((room) => room.roomId === roomId).length;
    addCheck(checks, `coverage-room-${roomId}`, count === 1, `Scene room ${roomId} has exactly one RoomSchemeLite.`, roomId);
  }
  const extraRooms = schemeRoomIds.filter((roomId) => !sceneRoomIds.includes(roomId));
  addCheck(checks, "coverage-no-extra-rooms", extraRooms.length === 0, "Scheme does not include rooms outside SceneContract.");
}

function addRoomIntegrityChecks(
  checks: SchemeVerificationCheck[],
  input: DesignKernelInput,
  scheme: SchemeLiteContract
): void {
  for (const room of scheme.rooms) {
    const sceneRoom = input.sceneContract.rooms.find((candidate) => candidate.roomId === room.roomId);
    addCheck(
      checks,
      `room-type-preserved-${room.roomId}`,
      sceneRoom !== undefined && sceneRoom.roomType === room.roomType,
      `Room ${room.roomId} preserves SceneContract roomType.`,
      room.roomId
    );
  }
}

function addReferenceChecks(
  checks: SchemeVerificationCheck[],
  input: DesignKernelInput,
  scheme: SchemeLiteContract
): void {
  const anchorIndex = new Map<string, string>();
  for (const plan of input.anchorPlans) {
    for (const anchor of plan.anchors) {
      anchorIndex.set(`${plan.anchorPlanId}:${anchor.anchorId}`, anchor.roomId);
    }
  }
  const placeholderIds = new Set(input.layoutIntentContract?.placeholders.map((placeholder) => placeholder.placeholderId) ?? []);

  for (const room of scheme.rooms) {
    for (const ref of room.anchorRefs) {
      const anchorRoomId = anchorIndex.get(`${ref.anchorPlanId}:${ref.anchorId}`);
      addCheck(
        checks,
        `anchor-ref-${room.roomId}-${ref.anchorId}`,
        anchorRoomId === room.roomId,
        `Anchor reference ${ref.anchorId} belongs to room ${room.roomId}.`,
        room.roomId
      );
    }
    for (const ref of room.layoutIntentRefs) {
      addCheck(
        checks,
        `layout-ref-${room.roomId}-${ref.placeholderId}`,
        placeholderIds.has(ref.placeholderId),
        `Layout intent reference ${ref.placeholderId} exists in LayoutIntentContract.`,
        room.roomId
      );
    }
    if (room.anchorRefs.length === 0) {
      checks.push({
        checkId: `anchor-warning-${room.roomId}`,
        status: "warning",
        message: `Room ${room.roomId} has no anchor references.`,
        roomId: room.roomId
      });
    }
  }
}

function addNoFinalCoordinateChecks(checks: SchemeVerificationCheck[], scheme: SchemeLiteContract): void {
  for (const room of scheme.rooms) {
    addCheck(
      checks,
      `no-final-coordinates-${room.roomId}`,
      !containsFinalCoordinateKey(room),
      `Room ${room.roomId} does not contain final furniture coordinates.`,
      room.roomId
    );
  }
}

function addCheck(
  checks: SchemeVerificationCheck[],
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

function aggregateStatus(checks: readonly SchemeVerificationCheck[]): DesignKernelStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  return "pass";
}

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))].sort();
}

function containsFinalCoordinateKey(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsFinalCoordinateKey(item));
  }
  const object = value as Record<string, unknown>;
  const coordinateKeys = new Set(["center", "position", "rotationDeg", "displaySizeMm", "x", "y"]);
  return Object.entries(object).some(([key, child]) => coordinateKeys.has(key) || containsFinalCoordinateKey(child));
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
