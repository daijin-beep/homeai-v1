import {
  CanonicalFloorplanRevisionSchema,
  FloorplanDraftRevisionSchema,
  FloorplanEditOperationSchema,
  GeometryDependencyRecordSchema,
  LayoutIntentContractSchema,
  LayoutIntentEventSchema,
  LayoutIntentOperationSchema,
  LayoutIntentRevisionSchema,
  P1EventSchema,
  P1SceneContractV02Schema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type DraftRoom,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type GeometryDependencyRecord,
  type LayoutIntentContract,
  type LayoutIntentEvent,
  type LayoutIntentOperation,
  type LayoutIntentRevision,
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

export interface LayoutIntentRepository {
  createLayoutIntentRevision(layoutIntentRevision: LayoutIntentRevision): LayoutIntentRevision;
  getLayoutIntentRevision(layoutIntentRevisionId: string): LayoutIntentRevision | undefined;
  getActiveLayoutIntentForHome(homeId: string): LayoutIntentRevision | undefined;
  getActiveLayoutIntentForCanonicalRevision(canonicalRevisionId: string): LayoutIntentRevision | undefined;
  setActiveLayoutIntentForHome(homeId: string, layoutIntentRevisionId: string): void;
  archiveLayoutIntentRevision(layoutIntentRevisionId: string, archivedAt: string): void;
  updateLayoutIntentRevision(layoutIntentRevision: LayoutIntentRevision): LayoutIntentRevision;
  appendOperation(layoutIntentRevisionId: string, operation: LayoutIntentOperation): LayoutIntentRevision;
  listOperations(layoutIntentRevisionId: string): LayoutIntentOperation[];
  createLayoutIntentContract(layoutIntentContract: LayoutIntentContract): LayoutIntentContract;
  getLayoutIntentContract(layoutIntentContractId: string): LayoutIntentContract | undefined;
  getActiveLayoutIntentContractForRevision(layoutIntentRevisionId: string): LayoutIntentContract | undefined;
}

export interface LayoutIntentEventRepository {
  appendLayoutIntentEvent(event: LayoutIntentEvent): LayoutIntentEvent;
  listLayoutIntentEventsByHome(homeId: string): LayoutIntentEvent[];
  listLayoutIntentEventsByRevision(layoutIntentRevisionId: string): LayoutIntentEvent[];
}

export type P1RepositorySet = {
  drafts: FloorplanDraftRepository;
  canonical: CanonicalFloorplanRepository;
  sceneContracts: SceneContractRepository;
  geometryDependencies: GeometryDependencyRepository;
  events: P1EventRepository;
  layoutIntents: LayoutIntentRepository;
  layoutEvents: LayoutIntentEventRepository;
};

export function createInMemoryP1Repositories(): P1RepositorySet {
  const canonical = new InMemoryCanonicalFloorplanRepository();
  return {
    drafts: new InMemoryFloorplanDraftRepository(),
    canonical,
    sceneContracts: new InMemorySceneContractRepository(),
    geometryDependencies: new InMemoryGeometryDependencyRepository(),
    events: new InMemoryP1EventRepository(),
    layoutIntents: new InMemoryLayoutIntentRepository(),
    layoutEvents: new InMemoryLayoutIntentEventRepository()
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

export class InMemoryLayoutIntentRepository implements LayoutIntentRepository {
  readonly #layoutIntentRevisions = new Map<string, LayoutIntentRevision>();
  readonly #activeByHome = new Map<string, string>();
  readonly #activeByCanonicalRevision = new Map<string, string>();
  readonly #operations = new Map<string, LayoutIntentOperation[]>();
  readonly #contracts = new Map<string, LayoutIntentContract>();
  readonly #activeContractByRevision = new Map<string, string>();

  createLayoutIntentRevision(layoutIntentRevision: LayoutIntentRevision): LayoutIntentRevision {
    const parsed = LayoutIntentRevisionSchema.parse(clone(layoutIntentRevision));
    this.#layoutIntentRevisions.set(parsed.layoutIntentRevisionId, deepFreeze(clone(parsed)));
    this.#operations.set(parsed.layoutIntentRevisionId, []);
    this.#activeByHome.set(parsed.homeId, parsed.layoutIntentRevisionId);
    this.#activeByCanonicalRevision.set(parsed.canonicalRevisionId, parsed.layoutIntentRevisionId);
    return deepFreeze(clone(parsed));
  }

  getLayoutIntentRevision(layoutIntentRevisionId: string): LayoutIntentRevision | undefined {
    const revision = this.#layoutIntentRevisions.get(layoutIntentRevisionId);
    return revision === undefined ? undefined : deepFreeze(clone(revision));
  }

  getActiveLayoutIntentForHome(homeId: string): LayoutIntentRevision | undefined {
    const revisionId = this.#activeByHome.get(homeId);
    return revisionId === undefined ? undefined : this.getLayoutIntentRevision(revisionId);
  }

  getActiveLayoutIntentForCanonicalRevision(canonicalRevisionId: string): LayoutIntentRevision | undefined {
    const revisionId = this.#activeByCanonicalRevision.get(canonicalRevisionId);
    return revisionId === undefined ? undefined : this.getLayoutIntentRevision(revisionId);
  }

  setActiveLayoutIntentForHome(homeId: string, layoutIntentRevisionId: string): void {
    const revision = this.#layoutIntentRevisions.get(layoutIntentRevisionId);
    if (revision === undefined || revision.homeId !== homeId || revision.archivedAt !== undefined) {
      throw new Error(`Layout intent revision not found for home: ${layoutIntentRevisionId}`);
    }
    this.#activeByHome.set(homeId, layoutIntentRevisionId);
    this.#activeByCanonicalRevision.set(revision.canonicalRevisionId, layoutIntentRevisionId);
  }

  archiveLayoutIntentRevision(layoutIntentRevisionId: string, archivedAt: string): void {
    const existing = this.#layoutIntentRevisions.get(layoutIntentRevisionId);
    if (existing === undefined) {
      throw new Error(`Layout intent revision not found: ${layoutIntentRevisionId}`);
    }
    const archived = LayoutIntentRevisionSchema.parse({
      ...clone(existing),
      archivedAt,
      updatedAt: archivedAt
    });
    this.#layoutIntentRevisions.set(layoutIntentRevisionId, deepFreeze(clone(archived)));
    for (const [homeId, activeRevisionId] of this.#activeByHome.entries()) {
      if (activeRevisionId === layoutIntentRevisionId) {
        this.#activeByHome.delete(homeId);
      }
    }
    for (const [canonicalRevisionId, activeRevisionId] of this.#activeByCanonicalRevision.entries()) {
      if (activeRevisionId === layoutIntentRevisionId) {
        this.#activeByCanonicalRevision.delete(canonicalRevisionId);
      }
    }
  }

  updateLayoutIntentRevision(layoutIntentRevision: LayoutIntentRevision): LayoutIntentRevision {
    const parsed = LayoutIntentRevisionSchema.parse(clone(layoutIntentRevision));
    if (!this.#layoutIntentRevisions.has(parsed.layoutIntentRevisionId)) {
      throw new Error(`Layout intent revision not found: ${parsed.layoutIntentRevisionId}`);
    }
    this.#layoutIntentRevisions.set(parsed.layoutIntentRevisionId, deepFreeze(clone(parsed)));
    if (parsed.archivedAt === undefined) {
      this.#activeByHome.set(parsed.homeId, parsed.layoutIntentRevisionId);
      this.#activeByCanonicalRevision.set(parsed.canonicalRevisionId, parsed.layoutIntentRevisionId);
    }
    return deepFreeze(clone(parsed));
  }

  appendOperation(layoutIntentRevisionId: string, operation: LayoutIntentOperation): LayoutIntentRevision {
    const revision = this.#layoutIntentRevisions.get(layoutIntentRevisionId);
    if (revision === undefined) {
      throw new Error(`Layout intent revision not found: ${layoutIntentRevisionId}`);
    }
    const parsedOperation = LayoutIntentOperationSchema.parse(operation);
    const operations = this.#operations.get(layoutIntentRevisionId) ?? [];
    this.#operations.set(layoutIntentRevisionId, [...operations, parsedOperation]);
    return deepFreeze(clone(revision));
  }

  listOperations(layoutIntentRevisionId: string): LayoutIntentOperation[] {
    return clone(this.#operations.get(layoutIntentRevisionId) ?? []);
  }

  createLayoutIntentContract(layoutIntentContract: LayoutIntentContract): LayoutIntentContract {
    const parsed = LayoutIntentContractSchema.parse(clone(layoutIntentContract));
    this.#contracts.set(parsed.layoutIntentContractId, deepFreeze(clone(parsed)));
    this.#activeContractByRevision.set(parsed.layoutIntentRevisionId, parsed.layoutIntentContractId);
    return deepFreeze(clone(parsed));
  }

  getLayoutIntentContract(layoutIntentContractId: string): LayoutIntentContract | undefined {
    const contract = this.#contracts.get(layoutIntentContractId);
    return contract === undefined ? undefined : deepFreeze(clone(contract));
  }

  getActiveLayoutIntentContractForRevision(layoutIntentRevisionId: string): LayoutIntentContract | undefined {
    const contractId = this.#activeContractByRevision.get(layoutIntentRevisionId);
    return contractId === undefined ? undefined : this.getLayoutIntentContract(contractId);
  }
}

export class InMemoryLayoutIntentEventRepository implements LayoutIntentEventRepository {
  readonly #events: LayoutIntentEvent[] = [];

  appendLayoutIntentEvent(event: LayoutIntentEvent): LayoutIntentEvent {
    const parsed = LayoutIntentEventSchema.parse(clone(event));
    this.#events.push(clone(parsed));
    return clone(parsed);
  }

  listLayoutIntentEventsByHome(homeId: string): LayoutIntentEvent[] {
    return this.#events
      .filter((event) => event.homeId === homeId)
      .map(clone)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId));
  }

  listLayoutIntentEventsByRevision(layoutIntentRevisionId: string): LayoutIntentEvent[] {
    return this.#events
      .filter((event) => event.layoutIntentRevisionId === layoutIntentRevisionId)
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
