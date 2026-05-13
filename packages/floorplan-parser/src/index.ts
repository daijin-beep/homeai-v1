import {
  CanonicalFloorplanRevisionSchema,
  DraftValidationStateSchema,
  FloorplanDraftRevisionSchema,
  FloorplanEditOperationSchema,
  P1DraftRoomSchema,
  P1DraftWallSegmentSchema,
  P1SceneContractV02Schema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type DraftDoorOpening,
  type DraftOpening,
  type DraftRoom,
  type DraftValidationIssue,
  type DraftValidationState,
  type DraftWallSegment,
  type DraftWindowOpening,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type P1RoomType,
  type P1SceneContractV02,
  type Point2D
} from "@homeai/contracts";
import {
  buildWallGraph,
  computeGeometryHash,
  computeSegmentLength,
  createCanonicalFloorplanRevision as createGeometryCanonicalFloorplanRevision,
  detectUnclosedBoundaries,
  filterInvalidFaces,
  polygonizeClosedFaces
} from "@homeai/geometry";
import { createSceneContractV02 } from "@homeai/scene";
import {
  createDraftFromCanonicalRevisionData,
  createInMemoryP1Repositories,
  type P1RepositorySet
} from "./repositories.js";

export { computeGeometryHash };
export * from "./api.js";
export * from "./events.js";
export * from "./invalidation.js";
export * from "./repositories.js";

export const P1_VALUE_BOUNDS = {
  wallThicknessMm: { min: 50, max: 600 },
  floorHeightMm: { min: 2000, max: 5000 },
  doorWidthMm: { min: 500, max: 2000 },
  doorHeightMm: { min: 1600, max: 3000 },
  windowWidthMm: { min: 300, max: 6000 },
  windowHeightMm: { min: 300, max: 3500 },
  bayProjectionDepthMm: { min: 100, max: 1500 }
} as const;

export type P1PersistenceStore = P1RepositorySet;

export type ConfirmFloorplanResult =
  | {
      ok: true;
      canonicalRevisionId: string;
      geometryHash: string;
      canonicalRevision: CanonicalFloorplanRevision;
    }
  | {
      ok: false;
      validation: DraftValidationState;
    };

export type OpeningDefaults = {
  widthMm: number;
  heightMm: number;
  sillHeightMm?: number;
  projectionDepthMm?: number;
  projectionSide?: "exterior";
};

export function createP1PersistenceStore(): P1PersistenceStore {
  return createInMemoryP1Repositories();
}

export function createDraftFromParsedFloorplan(
  parsedDraft: FloorplanDraftRevision,
  options: { draftRevisionId?: string; createdAt?: string; updatedAt?: string } = {},
  store?: P1PersistenceStore
): FloorplanDraftRevision {
  const source = FloorplanDraftRevisionSchema.parse(parsedDraft);
  const now = options.updatedAt ?? options.createdAt ?? source.updatedAt;
  const draft = FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(source),
    draftRevisionId: options.draftRevisionId ?? source.draftRevisionId,
    source: "ai_parse",
    operationLog: [],
    validation: undefined,
    createdAt: options.createdAt ?? source.createdAt,
    updatedAt: now
  });
  return createNewDraftRevision(draft, store);
}

export function createDraftFromCanonicalRevision(
  canonicalRevision: CanonicalFloorplanRevision,
  options: { draftRevisionId: string; createdAt: string; updatedAt?: string } ,
  store?: P1PersistenceStore
): FloorplanDraftRevision {
  const draft = createDraftFromCanonicalRevisionData(canonicalRevision, options);
  return store === undefined ? draft : store.drafts.createDraft(draft);
}

export function getDraftRevision(
  draftRevisionId: string,
  store: P1PersistenceStore
): FloorplanDraftRevision | undefined {
  return store.drafts.getDraftById(draftRevisionId);
}

export function createNewDraftRevision(
  draft: FloorplanDraftRevision,
  store?: P1PersistenceStore
): FloorplanDraftRevision {
  const parsed = FloorplanDraftRevisionSchema.parse(cloneDraft(draft));
  return store === undefined ? parsed : store.drafts.createDraft(parsed);
}

export function markDraftDirty(
  draft: FloorplanDraftRevision,
  options: { updatedAt: string }
): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    validation: undefined,
    updatedAt: options.updatedAt
  });
}

export function applyFloorplanOperations(
  draft: FloorplanDraftRevision,
  operations: readonly FloorplanEditOperation[],
  options: { updatedAt?: string; store?: P1PersistenceStore } = {}
): FloorplanDraftRevision {
  let current = cloneDraft(draft);
  const applied: FloorplanEditOperation[] = [];
  for (const rawOperation of operations) {
    const operation = FloorplanEditOperationSchema.parse(rawOperation);
    current = applyOperation(current, operation);
    applied.push(operation);
  }

  const updated = FloorplanDraftRevisionSchema.parse({
    ...current,
    operationLog: [...draft.operationLog, ...applied],
    validation: undefined,
    updatedAt: options.updatedAt ?? applied[applied.length - 1]?.createdAt ?? draft.updatedAt
  });
  options.store?.drafts.updateDraft(updated);
  return updated;
}

export function replayOperationLog(
  baseDraft: FloorplanDraftRevision,
  operationLog: readonly FloorplanEditOperation[]
): FloorplanDraftRevision {
  const cleanBase = FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(baseDraft),
    operationLog: [],
    validation: undefined
  });
  return applyFloorplanOperations(cleanBase, operationLog);
}

export function createReentryDraftForHome(
  homeId: string,
  options: { draftRevisionId: string; createdAt: string },
  store: P1PersistenceStore
): FloorplanDraftRevision {
  const canonical = store.canonical.getActiveCanonicalRevisionForHome(homeId);
  if (canonical === undefined) {
    throw new Error("No confirmed canonical revision exists for P1 re-entry.");
  }
  return createDraftFromCanonicalRevision(canonical, options, store);
}

export function generateDefaultOpeningParams(
  type: "door" | "window",
  options: { windowKind?: DraftWindowOpening["windowKind"]; floorHeightMm?: number } = {}
): OpeningDefaults {
  if (type === "door") {
    return {
      widthMm: 800,
      heightMm: 2000
    };
  }

  if (options.windowKind === "floor_to_ceiling") {
    return {
      widthMm: 1200,
      heightMm: options.floorHeightMm ?? 2800,
      sillHeightMm: 0
    };
  }

  if (options.windowKind === "bay") {
    return {
      widthMm: 1200,
      heightMm: 1300,
      sillHeightMm: 900,
      projectionDepthMm: 500,
      projectionSide: "exterior"
    };
  }

  return {
    widthMm: 1200,
    heightMm: 1300,
    sillHeightMm: 900
  };
}

export function attachOpeningToWall(
  draft: FloorplanDraftRevision,
  opening: DraftOpening
): DraftOpening {
  const parsedOpening = opening.type === "door"
    ? opening
    : convertBayWindowToProjectionMetadata(opening);
  const issue = validateOpeningAttachment(draft, parsedOpening);
  if (issue !== null) {
    throw new Error(issue.message);
  }
  return parsedOpening;
}

export function validateOpeningAttachment(
  draft: FloorplanDraftRevision,
  opening: DraftOpening
): DraftValidationIssue | null {
  const wall = draft.walls.find((candidate) => candidate.wallId === opening.wallId);
  if (wall === undefined) {
    return issue("OPENING_ORPHANED", "Opening must be attached to an existing wall.", "opening", opening.openingId);
  }
  if (opening.positionOnWall < 0 || opening.positionOnWall > 1) {
    return issue("OPENING_POSITION_INVALID", "Opening position must be within the wall segment.", "opening", opening.openingId);
  }
  return null;
}

export function updateDoorSwing(
  draft: FloorplanDraftRevision,
  openingId: string,
  swing: DraftDoorOpening["swing"]
): FloorplanDraftRevision {
  return replaceOpening(draft, openingId, (opening) => {
    if (opening.type !== "door") {
      throw new Error("Only doors can update swing direction.");
    }
    return { ...opening, swing, source: "user_modified" };
  });
}

export function updateWindowKind(
  draft: FloorplanDraftRevision,
  openingId: string,
  windowKind: DraftWindowOpening["windowKind"]
): FloorplanDraftRevision {
  return replaceOpening(draft, openingId, (opening) => {
    if (opening.type !== "window") {
      throw new Error("Only windows can update window kind.");
    }
    if (windowKind === "bay") {
      return {
        ...opening,
        windowKind,
        projectionDepthMm: opening.windowKind === "bay" ? opening.projectionDepthMm : 500,
        projectionSide: "exterior",
        source: "user_modified"
      };
    }
    if (windowKind === "floor_to_ceiling") {
      return {
        openingId: opening.openingId,
        type: "window",
        wallId: opening.wallId,
        positionOnWall: opening.positionOnWall,
        widthMm: opening.widthMm,
        heightMm: draft.globalParams.floorHeightMm ?? opening.heightMm,
        sillHeightMm: 0,
        windowKind,
        source: "user_modified"
      };
    }
    return {
      openingId: opening.openingId,
      type: "window",
      wallId: opening.wallId,
      positionOnWall: opening.positionOnWall,
      widthMm: opening.widthMm,
      heightMm: opening.heightMm,
      ...(opening.sillHeightMm === undefined ? {} : { sillHeightMm: opening.sillHeightMm }),
      windowKind,
      source: "user_modified"
    };
  });
}

export function convertBayWindowToProjectionMetadata(opening: DraftWindowOpening): DraftWindowOpening {
  if (opening.windowKind !== "bay") {
    return opening;
  }
  return {
    ...opening,
    projectionDepthMm: opening.projectionDepthMm ?? 500,
    projectionSide: "exterior"
  };
}

export function createBalconyRoom(
  input: Omit<DraftRoom, "roomType" | "source"> & {
    source?: DraftRoom["source"];
    enclosureType?: "open" | "closed";
    adjacentInteriorRoomIds: string[];
    connectionWallIds: string[];
    exteriorEdgeIds: string[];
  }
): DraftRoom {
  return P1DraftRoomSchema.parse({
    roomId: input.roomId,
    roomType: "balcony",
    polygon: input.polygon.map(clonePoint),
    ...(input.labelPosition === undefined ? {} : { labelPosition: clonePoint(input.labelPosition) }),
    source: input.source ?? "user_labeled",
    balconyMeta: {
      enclosureType: input.enclosureType ?? "closed",
      isExteriorAttached: true,
      adjacentInteriorRoomIds: input.adjacentInteriorRoomIds,
      connectionWallIds: input.connectionWallIds,
      exteriorEdgeIds: input.exteriorEdgeIds
    }
  });
}

export function detectExteriorWallAttachment(
  draft: FloorplanDraftRevision,
  balconyRoom: DraftRoom
): string[] {
  if (balconyRoom.roomType !== "balcony") {
    return [];
  }
  const exteriorWallIds = new Set(draft.walls.filter((wall) => wall.kind === "exterior").map((wall) => wall.wallId));
  return balconyRoom.balconyMeta.connectionWallIds.filter((wallId) => exteriorWallIds.has(wallId));
}

export function setBalconyEnclosureType(
  draft: FloorplanDraftRevision,
  roomId: string,
  enclosureType: "open" | "closed"
): FloorplanDraftRevision {
  return replaceRoom(draft, roomId, (room) => {
    if (room.roomType !== "balcony") {
      throw new Error("Only balcony rooms can update enclosure type.");
    }
    return {
      ...room,
      source: "user_labeled",
      balconyMeta: {
        ...room.balconyMeta,
        enclosureType
      }
    };
  });
}

export function validateBalconyAttachment(
  draft: FloorplanDraftRevision,
  balconyRoom: DraftRoom
): DraftValidationIssue | null {
  if (balconyRoom.roomType !== "balcony") {
    return null;
  }
  if (detectExteriorWallAttachment(draft, balconyRoom).length === 0) {
    return issue("BALCONY_DETACHED", "Balcony must connect to an exterior wall before confirmation.", "room", balconyRoom.roomId);
  }
  const interiorIds = new Set(draft.rooms.filter((room) => room.roomType !== "balcony").map((room) => room.roomId));
  if (!balconyRoom.balconyMeta.adjacentInteriorRoomIds.some((roomId) => interiorIds.has(roomId))) {
    return issue("BALCONY_ADJACENCY_MISSING", "Balcony must reference an adjacent interior room.", "room", balconyRoom.roomId);
  }
  return null;
}

export function restoreWallAfterBalconyDelete(
  draft: FloorplanDraftRevision,
  roomId: string
): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    rooms: draft.rooms.filter((room) => room.roomId !== roomId),
    validation: undefined
  });
}

export function validateDraftGeometry(draft: FloorplanDraftRevision): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  for (const wall of draft.walls) {
    if (computeSegmentLength(wall) <= 0) {
      issues.push(issue("WALL_LENGTH_INVALID", "Wall length must be greater than zero.", "wall", wall.wallId));
    }
    if (!inBounds(wall.thicknessMm, P1_VALUE_BOUNDS.wallThicknessMm)) {
      issues.push(issue("WALL_THICKNESS_OUT_OF_RANGE", "Wall thickness is outside the supported range.", "wall", wall.wallId));
    }
  }

  const exteriorGraph = buildWallGraph(draft.walls.filter((wall) => wall.kind === "exterior"));
  issues.push(...detectUnclosedBoundaries(exteriorGraph));
  return issues;
}

export function validateRooms(draft: FloorplanDraftRevision): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  const validRooms = draft.rooms.filter((room) => P1DraftRoomSchema.safeParse(room).success);
  if (validRooms.length === 0) {
    issues.push(issue("NO_VALID_ROOMS", "At least one valid room is required.", "draft"));
  }

  for (const rawRoom of draft.rooms) {
    if (!P1DraftRoomSchema.safeParse(rawRoom).success) {
      issues.push(issue("ROOM_TYPE_UNSUPPORTED", "Room type is not supported for P1 confirmation.", "room", rawRoom.roomId));
      continue;
    }
    if (!isClosedPolygon(rawRoom.polygon) || hasSelfIntersection(rawRoom.polygon)) {
      issues.push(issue("ROOM_POLYGON_INVALID", "Room polygon must be closed and non-intersecting.", "room", rawRoom.roomId));
    }
  }

  const faces = filterInvalidFaces(polygonizeClosedFaces(buildWallGraph(draft.walls.filter((wall) => wall.kind === "exterior"))), 1);
  if (faces.length === 0) {
    issues.push(issue("ROOM_BOUNDARY_UNCLOSED", "Room boundary must close before confirmation.", "draft"));
  }

  return issues;
}

export function validateOpenings(draft: FloorplanDraftRevision): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  for (const opening of draft.openings) {
    const attachmentIssue = validateOpeningAttachment(draft, opening);
    if (attachmentIssue !== null) {
      issues.push(attachmentIssue);
    }
    if (opening.type === "door") {
      if (!inBounds(opening.widthMm, P1_VALUE_BOUNDS.doorWidthMm)) {
        issues.push(issue("DOOR_WIDTH_OUT_OF_RANGE", "Door width is outside the supported range.", "opening", opening.openingId));
      }
      if (!inBounds(opening.heightMm, P1_VALUE_BOUNDS.doorHeightMm)) {
        issues.push(issue("DOOR_HEIGHT_OUT_OF_RANGE", "Door height is outside the supported range.", "opening", opening.openingId));
      }
    } else {
      if (!inBounds(opening.widthMm, P1_VALUE_BOUNDS.windowWidthMm)) {
        issues.push(issue("WINDOW_WIDTH_OUT_OF_RANGE", "Window width is outside the supported range.", "opening", opening.openingId));
      }
      if (!inBounds(opening.heightMm, P1_VALUE_BOUNDS.windowHeightMm)) {
        issues.push(issue("WINDOW_HEIGHT_OUT_OF_RANGE", "Window height is outside the supported range.", "opening", opening.openingId));
      }
      if (opening.windowKind === "bay") {
        if (opening.projectionDepthMm === undefined) {
          issues.push(issue("BAY_WINDOW_PROJECTION_MISSING", "Bay window projection depth is required.", "opening", opening.openingId));
        } else if (!inBounds(opening.projectionDepthMm, P1_VALUE_BOUNDS.bayProjectionDepthMm)) {
          issues.push(issue("BAY_WINDOW_PROJECTION_OUT_OF_RANGE", "Bay window projection depth is outside the supported range.", "opening", opening.openingId));
        }
      }
    }
  }
  return issues;
}

export function validateBalconies(draft: FloorplanDraftRevision): DraftValidationIssue[] {
  return draft.rooms
    .map((room) => validateBalconyAttachment(draft, room))
    .filter((candidate): candidate is DraftValidationIssue => candidate !== null);
}

export function validateAdvancedValues(draft: FloorplanDraftRevision): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  const floorHeightMm = draft.globalParams.floorHeightMm;
  if (floorHeightMm !== undefined && !inBounds(floorHeightMm, P1_VALUE_BOUNDS.floorHeightMm)) {
    issues.push(issue("FLOOR_HEIGHT_OUT_OF_RANGE", "Floor height is outside the supported range.", "global_params"));
  }
  return issues;
}

export function buildDraftValidationState(
  draft: FloorplanDraftRevision,
  options: { validatedAt: string }
): DraftValidationState {
  const issues = [
    ...validateDraftGeometry(draft),
    ...validateRooms(draft),
    ...validateOpenings(draft),
    ...validateBalconies(draft),
    ...validateAdvancedValues(draft)
  ];
  const blocking = issues.some((item) => item.blocksConfirmation);
  return DraftValidationStateSchema.parse({
    status: blocking ? "invalid" : issues.length > 0 ? "warning" : "valid",
    topologyValid: !issues.some((item) => ["UNCLOSED_BOUNDARY", "ROOM_BOUNDARY_UNCLOSED", "ROOM_POLYGON_INVALID"].includes(item.code)),
    scaleValid: draft.globalParams.scale.source === "user_confirmed" && draft.globalParams.scale.confirmed,
    canConfirm: !blocking && draft.globalParams.scale.source === "user_confirmed" && draft.globalParams.scale.confirmed,
    issues,
    validatedAt: options.validatedAt
  });
}

export function runSpaceTruthGate(
  draft: FloorplanDraftRevision,
  options: { validatedAt: string }
): DraftValidationState {
  return buildDraftValidationState(draft, options);
}

export function confirmFloorplanDraft(
  draft: FloorplanDraftRevision,
  options: {
    canonicalRevisionId: string;
    version: number;
    confirmedAt: string;
    userConfirmed: boolean;
    store?: P1PersistenceStore;
  }
): ConfirmFloorplanResult {
  const validation = runSpaceTruthGate(draft, { validatedAt: options.confirmedAt });
  if (!validation.canConfirm || !options.userConfirmed) {
    return {
      ok: false,
      validation: options.userConfirmed
        ? validation
        : DraftValidationStateSchema.parse({
            ...validation,
            status: "invalid",
            canConfirm: false,
            issues: [
              ...validation.issues,
              issue("USER_CONFIRMATION_REQUIRED", "User confirmation is required before creating canonical geometry.", "draft")
            ]
          })
    };
  }

  const validatedDraft = FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    validation
  });
  const canonicalRevision = createCanonicalFloorplanRevision(validatedDraft, {
    canonicalRevisionId: options.canonicalRevisionId,
    version: options.version,
    confirmedAt: options.confirmedAt
  });
  persistCanonicalRevision(canonicalRevision, options.store);

  return {
    ok: true,
    canonicalRevisionId: canonicalRevision.canonicalRevisionId,
    geometryHash: canonicalRevision.geometryHash,
    canonicalRevision
  };
}

export function createCanonicalFloorplanRevision(
  draft: FloorplanDraftRevision,
  options: { canonicalRevisionId: string; version: number; confirmedAt: string }
): CanonicalFloorplanRevision {
  return createGeometryCanonicalFloorplanRevision(draft, options);
}

export function persistCanonicalRevision(
  canonicalRevision: CanonicalFloorplanRevision,
  store?: P1PersistenceStore
): CanonicalFloorplanRevision {
  const parsed = CanonicalFloorplanRevisionSchema.parse(canonicalRevision);
  return store === undefined ? parsed : store.canonical.createCanonicalRevision(parsed);
}

export function buildSceneContractFromCanonicalRevision(
  canonicalRevision: CanonicalFloorplanRevision,
  options: { sceneContractId?: string; createdAt?: string } = {}
): P1SceneContractV02 {
  return createSceneContractV02(canonicalRevision, options);
}

export function verifyGeometryHashMatch(
  canonicalRevision: CanonicalFloorplanRevision,
  sceneContract: P1SceneContractV02
): boolean {
  return (
    sceneContract.canonicalRevisionId === canonicalRevision.canonicalRevisionId &&
    sceneContract.geometryHash === canonicalRevision.geometryHash
  );
}

export function persistSceneContract(
  sceneContract: P1SceneContractV02,
  store: P1PersistenceStore
): P1SceneContractV02 {
  const parsed = P1SceneContractV02Schema.parse(sceneContract);
  enforceReadonlySceneContract(parsed);
  return store.sceneContracts.createSceneContract(parsed);
}

export function getActiveSceneContractForHome(
  homeId: string,
  store: P1PersistenceStore
): P1SceneContractV02 | undefined {
  return store.sceneContracts.getActiveSceneContractForHome(homeId);
}

export function enforceReadonlySceneContract(sceneContract: P1SceneContractV02): P1SceneContractV02 {
  if (sceneContract.readonly !== true || sceneContract.version !== "0.2") {
    throw new Error("SceneContract v0.2 must be readonly.");
  }
  return sceneContract;
}

function applyOperation(
  draft: FloorplanDraftRevision,
  operation: FloorplanEditOperation
): FloorplanDraftRevision {
  const payload = operation.payload ?? {};
  switch (operation.operationType) {
    case "wall.add":
      return addWall(draft, requirePayload<DraftWallSegment>(payload.wall, "wall"));
    case "wall.delete":
      return deleteWall(draft, requireTarget(operation));
    case "wall.resize":
      return resizeWall(draft, requireTarget(operation), requirePoint(payload.start, "start"), requirePoint(payload.end, "end"));
    case "wall.moveEndpoint":
      return moveWallEndpoint(draft, requireTarget(operation), requireEndpoint(payload.endpoint), requirePoint(payload.point, "point"));
    case "wall.thickness.change":
      return changeWallThickness(draft, requireTarget(operation), requireNumber(payload.thicknessMm, "thicknessMm"));
    case "freeWall.draw":
      return addWall(draft, P1DraftWallSegmentSchema.parse({
        wallId: requireString(payload.wallId, "wallId"),
        start: requirePoint(payload.start, "start"),
        end: requirePoint(payload.end, "end"),
        thicknessMm: requireNumber(payload.thicknessMm, "thicknessMm"),
        kind: payload.kind ?? "interior",
        source: "user_created"
      }));
    case "door.add":
      return addOpening(draft, attachOpeningToWall(draft, requirePayload<DraftOpening>(payload.opening, "opening")));
    case "door.delete":
    case "window.delete":
      return deleteOpening(draft, requireTarget(operation));
    case "door.direction.change":
      return updateDoorSwing(draft, requireTarget(operation), requireDoorSwing(payload.swing));
    case "door.dimension.change":
      return replaceOpening(draft, requireTarget(operation), (opening) => {
        if (opening.type !== "door") {
          throw new Error("door.dimension.change requires a door target.");
        }
        return {
          ...opening,
          widthMm: requireNumber(payload.widthMm, "widthMm"),
          heightMm: requireNumber(payload.heightMm, "heightMm"),
          source: "user_modified"
        };
      });
    case "window.add":
      return addOpening(draft, attachOpeningToWall(draft, requirePayload<DraftOpening>(payload.opening, "opening")));
    case "window.type.change":
      return updateWindowKind(draft, requireTarget(operation), requireWindowKind(payload.windowKind));
    case "balcony.add":
      return addRoom(draft, requirePayload<DraftRoom>(payload.room, "room"));
    case "balcony.delete":
      return restoreWallAfterBalconyDelete(draft, requireTarget(operation));
    case "balcony.type.change":
      return setBalconyEnclosureType(draft, requireTarget(operation), requireEnclosureType(payload.enclosureType));
    case "room.type.change":
      return replaceRoom(draft, requireTarget(operation), (room) => ({
        ...room,
        roomType: requireNonBalconyRoomType(payload.roomType),
        source: "user_labeled"
      }));
    case "floorHeight.change":
      return FloorplanDraftRevisionSchema.parse({
        ...cloneDraft(draft),
        globalParams: {
          ...draft.globalParams,
          floorHeightMm: requireNumber(payload.floorHeightMm, "floorHeightMm")
        }
      });
    case "validate_draft":
    case "create_wall":
    case "modify_wall":
    case "delete_wall":
    case "create_opening":
    case "modify_opening":
    case "delete_opening":
    case "create_room":
    case "modify_room":
    case "delete_room":
    case "update_global_params":
      return cloneDraft(draft);
    default:
      throw new Error(`Unsupported operation type: ${operation.operationType satisfies never}`);
  }
}

function addWall(draft: FloorplanDraftRevision, wall: DraftWallSegment): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    walls: [...draft.walls, P1DraftWallSegmentSchema.parse(wall)]
  });
}

function deleteWall(draft: FloorplanDraftRevision, wallId: string): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    walls: draft.walls.filter((wall) => wall.wallId !== wallId),
    openings: draft.openings.filter((opening) => opening.wallId !== wallId)
  });
}

function resizeWall(draft: FloorplanDraftRevision, wallId: string, start: Point2D, end: Point2D): FloorplanDraftRevision {
  return replaceWall(draft, wallId, (wall) => ({ ...wall, start, end, source: "user_modified" }));
}

function moveWallEndpoint(
  draft: FloorplanDraftRevision,
  wallId: string,
  endpoint: "start" | "end",
  point: Point2D
): FloorplanDraftRevision {
  return replaceWall(draft, wallId, (wall) => ({ ...wall, [endpoint]: point, source: "user_modified" }));
}

function changeWallThickness(draft: FloorplanDraftRevision, wallId: string, thicknessMm: number): FloorplanDraftRevision {
  return replaceWall(draft, wallId, (wall) => ({ ...wall, thicknessMm, source: "user_modified" }));
}

function addOpening(draft: FloorplanDraftRevision, opening: DraftOpening): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    openings: [...draft.openings, opening]
  });
}

function deleteOpening(draft: FloorplanDraftRevision, openingId: string): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    openings: draft.openings.filter((opening) => opening.openingId !== openingId)
  });
}

function addRoom(draft: FloorplanDraftRevision, room: DraftRoom): FloorplanDraftRevision {
  return FloorplanDraftRevisionSchema.parse({
    ...cloneDraft(draft),
    rooms: [...draft.rooms, P1DraftRoomSchema.parse(room)]
  });
}

function replaceWall(
  draft: FloorplanDraftRevision,
  wallId: string,
  update: (wall: DraftWallSegment) => DraftWallSegment
): FloorplanDraftRevision {
  let found = false;
  const walls = draft.walls.map((wall) => {
    if (wall.wallId !== wallId) {
      return wall;
    }
    found = true;
    return P1DraftWallSegmentSchema.parse(update(wall));
  });
  if (!found) {
    throw new Error(`Wall not found: ${wallId}`);
  }
  return FloorplanDraftRevisionSchema.parse({ ...cloneDraft(draft), walls });
}

function replaceOpening(
  draft: FloorplanDraftRevision,
  openingId: string,
  update: (opening: DraftOpening) => DraftOpening
): FloorplanDraftRevision {
  let found = false;
  const openings = draft.openings.map((opening) => {
    if (opening.openingId !== openingId) {
      return opening;
    }
    found = true;
    return update(opening);
  });
  if (!found) {
    throw new Error(`Opening not found: ${openingId}`);
  }
  return FloorplanDraftRevisionSchema.parse({ ...cloneDraft(draft), openings });
}

function replaceRoom(
  draft: FloorplanDraftRevision,
  roomId: string,
  update: (room: DraftRoom) => DraftRoom
): FloorplanDraftRevision {
  let found = false;
  const rooms = draft.rooms.map((room) => {
    if (room.roomId !== roomId) {
      return room;
    }
    found = true;
    return P1DraftRoomSchema.parse(update(room));
  });
  if (!found) {
    throw new Error(`Room not found: ${roomId}`);
  }
  return FloorplanDraftRevisionSchema.parse({ ...cloneDraft(draft), rooms });
}

function inBounds(value: number, bounds: { min: number; max: number }): boolean {
  return value >= bounds.min && value <= bounds.max;
}

function issue(
  code: string,
  message: string,
  targetType: DraftValidationIssue["targetType"],
  targetId?: string
): DraftValidationIssue {
  return {
    issueId: `issue-${code.toLowerCase()}${targetId === undefined ? "" : `-${targetId}`}`,
    severity: "blocking",
    code,
    message,
    targetType,
    ...(targetId === undefined ? {} : { targetId }),
    blocksConfirmation: true
  };
}

function isClosedPolygon(points: readonly Point2D[]): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  return first !== undefined && last !== undefined && first.x === last.x && first.y === last.y;
}

function hasSelfIntersection(points: readonly Point2D[]): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a1 = points[i];
    const a2 = points[i + 1];
    if (a1 === undefined || a2 === undefined) {
      continue;
    }
    for (let j = i + 1; j < points.length - 1; j += 1) {
      const b1 = points[j];
      const b2 = points[j + 1];
      if (b1 === undefined || b2 === undefined) {
        continue;
      }
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 2);
      if (!adjacent && segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

function orientation(a: Point2D, b: Point2D, c: Point2D): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

function requireTarget(operation: FloorplanEditOperation): string {
  if (operation.targetId === undefined) {
    throw new Error(`${operation.operationType} requires targetId.`);
  }
  return operation.targetId;
}

function requirePayload<T>(value: unknown, key: string): T {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Operation payload requires ${key}.`);
  }
  return value as T;
}

function requirePoint(value: unknown, key: string): Point2D {
  if (typeof value !== "object" || value === null || !("x" in value) || !("y" in value)) {
    throw new Error(`Operation payload requires point ${key}.`);
  }
  const point = value as Record<string, unknown>;
  return {
    x: requireNumber(point.x, `${key}.x`),
    y: requireNumber(point.y, `${key}.y`)
  };
}

function requireNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Operation payload requires numeric ${key}.`);
  }
  return value;
}

function requireString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Operation payload requires string ${key}.`);
  }
  return value;
}

function requireEndpoint(value: unknown): "start" | "end" {
  if (value !== "start" && value !== "end") {
    throw new Error("Endpoint must be start or end.");
  }
  return value;
}

function requireDoorSwing(value: unknown): DraftDoorOpening["swing"] {
  if (value === "left_in" || value === "right_in" || value === "left_out" || value === "right_out") {
    return value;
  }
  throw new Error("Invalid door swing.");
}

function requireWindowKind(value: unknown): DraftWindowOpening["windowKind"] {
  if (value === "standard" || value === "bay" || value === "floor_to_ceiling") {
    return value;
  }
  throw new Error("Invalid window kind.");
}

function requireEnclosureType(value: unknown): "open" | "closed" {
  if (value === "open" || value === "closed") {
    return value;
  }
  throw new Error("Invalid balcony enclosure type.");
}

function requireRoomType(value: unknown): P1RoomType {
  const candidate = { roomId: "tmp", roomType: value, polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }], source: "fixture" };
  const parsed = P1DraftRoomSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data.roomType;
  }
  throw new Error("Unsupported room type.");
}

function requireNonBalconyRoomType(value: unknown): Exclude<P1RoomType, "balcony"> {
  const roomType = requireRoomType(value);
  if (roomType === "balcony") {
    throw new Error("Use balcony.add to create balcony rooms with metadata.");
  }
  return roomType;
}

function cloneDraft(draft: FloorplanDraftRevision): FloorplanDraftRevision {
  return structuredClone(draft);
}

function clonePoint(point: Point2D): Point2D {
  return { x: point.x, y: point.y };
}

function cloneBalconyMeta(meta: BalconyMeta): BalconyMeta {
  return {
    enclosureType: meta.enclosureType,
    isExteriorAttached: true as const,
    adjacentInteriorRoomIds: [...meta.adjacentInteriorRoomIds],
    connectionWallIds: [...meta.connectionWallIds],
    exteriorEdgeIds: [...meta.exteriorEdgeIds]
  };
}
