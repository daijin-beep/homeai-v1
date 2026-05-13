import {
  CanonicalFloorplanRevisionSchema,
  FloorplanDraftRevisionSchema,
  FloorplanEditOperationSchema,
  GeometryDependencyRecordSchema,
  P1EventSchema,
  P1SceneContractV02Schema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type DraftRoom,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type GeometryDependencyRecord,
  type P1Event,
  type P1SceneContractV02,
  type Point2D
} from "@homeai/contracts";

export type DraftFromCanonicalOptions = {
  draftRevisionId: string;
  createdAt: string;
  updatedAt?: string;
};

export interface FloorplanDraftRepository {
  createDraft(draft: FloorplanDraftRevision): FloorplanDraftRevision;
  getDraftById(draftRevisionId: string): FloorplanDraftRevision | undefined;
  updateDraft(draft: FloorplanDraftRevision): FloorplanDraftRevision;
  appendOperation(draftRevisionId: string, operation: FloorplanEditOperation): FloorplanDraftRevision;
  listOperations(draftRevisionId: string): FloorplanEditOperation[];
  createDraftFromCanonicalRevision(
    canonicalRevision: CanonicalFloorplanRevision,
    options: DraftFromCanonicalOptions
  ): FloorplanDraftRevision;
}

export interface CanonicalFloorplanRepository {
  createCanonicalRevision(canonicalRevision: CanonicalFloorplanRevision): CanonicalFloorplanRevision;
  getCanonicalRevision(canonicalRevisionId: string): CanonicalFloorplanRevision | undefined;
  getActiveCanonicalRevisionForHome(homeId: string): CanonicalFloorplanRevision | undefined;
  setActiveCanonicalRevisionForHome(homeId: string, canonicalRevisionId: string): void;
}

export interface SceneContractRepository {
  createSceneContract(sceneContract: P1SceneContractV02): P1SceneContractV02;
  getSceneContract(sceneContractId: string): P1SceneContractV02 | undefined;
  getActiveSceneContractForHome(homeId: string): P1SceneContractV02 | undefined;
  archiveSceneContract(sceneContractId: string, archivedAt: string): void;
}

export interface GeometryDependencyRepository {
  createDependencyRecord(record: GeometryDependencyRecord): GeometryDependencyRecord;
  listByGeometryHash(geometryHash: string): GeometryDependencyRecord[];
  listByCanonicalRevisionId(canonicalRevisionId: string): GeometryDependencyRecord[];
  markInvalidated(dependencyId: string, invalidatedAt: string): GeometryDependencyRecord;
  markArchived(dependencyId: string, archivedAt: string): GeometryDependencyRecord;
}

export interface P1EventRepository {
  appendEvent(event: P1Event): P1Event;
  listEventsByHome(homeId: string): P1Event[];
  listEventsByDraftRevision(draftRevisionId: string): P1Event[];
}

export type P1RepositorySet = {
  drafts: FloorplanDraftRepository;
  canonical: CanonicalFloorplanRepository;
  sceneContracts: SceneContractRepository;
  geometryDependencies: GeometryDependencyRepository;
  events: P1EventRepository;
};

export function createInMemoryP1Repositories(): P1RepositorySet {
  const canonical = new InMemoryCanonicalFloorplanRepository();
  return {
    drafts: new InMemoryFloorplanDraftRepository(),
    canonical,
    sceneContracts: new InMemorySceneContractRepository(),
    geometryDependencies: new InMemoryGeometryDependencyRepository(),
    events: new InMemoryP1EventRepository()
  };
}

export class InMemoryFloorplanDraftRepository implements FloorplanDraftRepository {
  readonly #drafts = new Map<string, FloorplanDraftRevision>();

  createDraft(draft: FloorplanDraftRevision): FloorplanDraftRevision {
    const parsed = FloorplanDraftRevisionSchema.parse(clone(draft));
    this.#drafts.set(parsed.draftRevisionId, clone(parsed));
    return clone(parsed);
  }

  getDraftById(draftRevisionId: string): FloorplanDraftRevision | undefined {
    const draft = this.#drafts.get(draftRevisionId);
    return draft === undefined ? undefined : clone(draft);
  }

  updateDraft(draft: FloorplanDraftRevision): FloorplanDraftRevision {
    const parsed = FloorplanDraftRevisionSchema.parse(clone(draft));
    if (!this.#drafts.has(parsed.draftRevisionId)) {
      throw new Error(`Draft not found: ${parsed.draftRevisionId}`);
    }
    this.#drafts.set(parsed.draftRevisionId, clone(parsed));
    return clone(parsed);
  }

  appendOperation(draftRevisionId: string, operation: FloorplanEditOperation): FloorplanDraftRevision {
    const draft = this.#drafts.get(draftRevisionId);
    if (draft === undefined) {
      throw new Error(`Draft not found: ${draftRevisionId}`);
    }
    const parsedOperation = FloorplanEditOperationSchema.parse(operation);
    const updated = FloorplanDraftRevisionSchema.parse({
      ...clone(draft),
      operationLog: [...draft.operationLog, parsedOperation],
      updatedAt: parsedOperation.createdAt
    });
    this.#drafts.set(draftRevisionId, clone(updated));
    return clone(updated);
  }

  listOperations(draftRevisionId: string): FloorplanEditOperation[] {
    const draft = this.#drafts.get(draftRevisionId);
    return draft === undefined ? [] : clone(draft.operationLog);
  }

  createDraftFromCanonicalRevision(
    canonicalRevision: CanonicalFloorplanRevision,
    options: DraftFromCanonicalOptions
  ): FloorplanDraftRevision {
    return this.createDraft(createDraftFromCanonicalRevisionData(canonicalRevision, options));
  }
}

export class InMemoryCanonicalFloorplanRepository implements CanonicalFloorplanRepository {
  readonly #canonicalRevisions = new Map<string, CanonicalFloorplanRevision>();
  readonly #activeByHome = new Map<string, string>();

  createCanonicalRevision(canonicalRevision: CanonicalFloorplanRevision): CanonicalFloorplanRevision {
    const parsed = CanonicalFloorplanRevisionSchema.parse(clone(canonicalRevision));
    this.#canonicalRevisions.set(parsed.canonicalRevisionId, deepFreeze(clone(parsed)));
    this.#activeByHome.set(parsed.homeId, parsed.canonicalRevisionId);
    return deepFreeze(clone(parsed));
  }

  getCanonicalRevision(canonicalRevisionId: string): CanonicalFloorplanRevision | undefined {
    const canonical = this.#canonicalRevisions.get(canonicalRevisionId);
    return canonical === undefined ? undefined : deepFreeze(clone(canonical));
  }

  getActiveCanonicalRevisionForHome(homeId: string): CanonicalFloorplanRevision | undefined {
    const canonicalRevisionId = this.#activeByHome.get(homeId);
    return canonicalRevisionId === undefined ? undefined : this.getCanonicalRevision(canonicalRevisionId);
  }

  setActiveCanonicalRevisionForHome(homeId: string, canonicalRevisionId: string): void {
    const canonical = this.#canonicalRevisions.get(canonicalRevisionId);
    if (canonical === undefined || canonical.homeId !== homeId) {
      throw new Error(`Canonical revision not found for home: ${canonicalRevisionId}`);
    }
    this.#activeByHome.set(homeId, canonicalRevisionId);
  }
}

export class InMemorySceneContractRepository implements SceneContractRepository {
  readonly #sceneContracts = new Map<string, P1SceneContractV02>();
  readonly #activeByHome = new Map<string, string>();
  readonly #archivedSceneContractIds = new Set<string>();

  createSceneContract(sceneContract: P1SceneContractV02): P1SceneContractV02 {
    const parsed = P1SceneContractV02Schema.parse(clone(sceneContract));
    if (!parsed.readonly || parsed.version !== "0.2") {
      throw new Error("SceneContract v0.2 must be readonly.");
    }
    this.#sceneContracts.set(parsed.sceneContractId, deepFreeze(clone(parsed)));
    this.#archivedSceneContractIds.delete(parsed.sceneContractId);
    this.#activeByHome.set(parsed.homeId, parsed.sceneContractId);
    return deepFreeze(clone(parsed));
  }

  getSceneContract(sceneContractId: string): P1SceneContractV02 | undefined {
    const scene = this.#sceneContracts.get(sceneContractId);
    return scene === undefined ? undefined : deepFreeze(clone(scene));
  }

  getActiveSceneContractForHome(homeId: string): P1SceneContractV02 | undefined {
    const sceneContractId = this.#activeByHome.get(homeId);
    if (sceneContractId === undefined || this.#archivedSceneContractIds.has(sceneContractId)) {
      return undefined;
    }
    return this.getSceneContract(sceneContractId);
  }

  archiveSceneContract(sceneContractId: string, _archivedAt: string): void {
    this.#archivedSceneContractIds.add(sceneContractId);
    for (const [homeId, activeSceneContractId] of this.#activeByHome.entries()) {
      if (activeSceneContractId === sceneContractId) {
        this.#activeByHome.delete(homeId);
      }
    }
  }
}

export class InMemoryGeometryDependencyRepository implements GeometryDependencyRepository {
  readonly #records = new Map<string, GeometryDependencyRecord>();

  createDependencyRecord(record: GeometryDependencyRecord): GeometryDependencyRecord {
    const parsed = GeometryDependencyRecordSchema.parse(clone(record));
    this.#records.set(parsed.dependencyId, clone(parsed));
    return clone(parsed);
  }

  listByGeometryHash(geometryHash: string): GeometryDependencyRecord[] {
    return [...this.#records.values()]
      .filter((record) => record.geometryHash === geometryHash)
      .map(clone)
      .sort((a, b) => a.dependencyId.localeCompare(b.dependencyId));
  }

  listByCanonicalRevisionId(canonicalRevisionId: string): GeometryDependencyRecord[] {
    return [...this.#records.values()]
      .filter((record) => record.canonicalRevisionId === canonicalRevisionId)
      .map(clone)
      .sort((a, b) => a.dependencyId.localeCompare(b.dependencyId));
  }

  markInvalidated(dependencyId: string, invalidatedAt: string): GeometryDependencyRecord {
    const existing = this.#records.get(dependencyId);
    if (existing === undefined) {
      throw new Error(`Geometry dependency not found: ${dependencyId}`);
    }
    const updated = GeometryDependencyRecordSchema.parse({
      ...clone(existing),
      status: "invalidated",
      active: false,
      invalidatedAt
    });
    this.#records.set(dependencyId, clone(updated));
    return clone(updated);
  }

  markArchived(dependencyId: string, archivedAt: string): GeometryDependencyRecord {
    const existing = this.#records.get(dependencyId);
    if (existing === undefined) {
      throw new Error(`Geometry dependency not found: ${dependencyId}`);
    }
    const updated = GeometryDependencyRecordSchema.parse({
      ...clone(existing),
      status: "archived",
      active: false,
      archivedAt
    });
    this.#records.set(dependencyId, clone(updated));
    return clone(updated);
  }
}

export class InMemoryP1EventRepository implements P1EventRepository {
  readonly #events: P1Event[] = [];

  appendEvent(event: P1Event): P1Event {
    const parsed = P1EventSchema.parse(clone(event));
    this.#events.push(clone(parsed));
    return clone(parsed);
  }

  listEventsByHome(homeId: string): P1Event[] {
    return this.#events
      .filter((event) => event.homeId === homeId)
      .map(clone)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId));
  }

  listEventsByDraftRevision(draftRevisionId: string): P1Event[] {
    return this.#events
      .filter((event) => event.draftRevisionId === draftRevisionId)
      .map(clone)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId));
  }
}

export function createDraftFromCanonicalRevisionData(
  canonicalRevision: CanonicalFloorplanRevision,
  options: DraftFromCanonicalOptions
): FloorplanDraftRevision {
  const canonical = CanonicalFloorplanRevisionSchema.parse(canonicalRevision);
  return FloorplanDraftRevisionSchema.parse({
    draftRevisionId: options.draftRevisionId,
    homeId: canonical.homeId,
    baseCanonicalRevisionId: canonical.canonicalRevisionId,
    source: "reentry_edit",
    unit: "mm",
    walls: canonical.walls.map((wall) => ({
      ...wall,
      start: clonePoint(wall.start),
      end: clonePoint(wall.end),
      source: "fixture"
    })),
    openings: canonical.openings.map((opening) => ({ ...opening, source: "fixture" })),
    rooms: canonical.rooms.map((room) => ({
      ...room,
      polygon: room.polygon.map(clonePoint),
      ...(room.labelPosition === undefined ? {} : { labelPosition: clonePoint(room.labelPosition) }),
      ...(room.roomType === "balcony" ? { balconyMeta: cloneBalconyMeta(room.balconyMeta) } : {}),
      source: "boundary_recomputed"
    })),
    globalParams: {
      ...canonical.globalParams,
      scale: {
        ...canonical.globalParams.scale,
        confirmed: true
      }
    },
    operationLog: [],
    validation: undefined,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt ?? options.createdAt
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
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

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }

  return Object.freeze(value);
}
