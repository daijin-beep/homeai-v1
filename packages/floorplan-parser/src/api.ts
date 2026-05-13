import {
  DraftValidationStateSchema,
  FloorplanDraftRevisionSchema,
  FloorplanEditOperationSchema,
  P1OperationLogSummarySchema,
  P1ValidationSummarySchema,
  type CanonicalFloorplanRevision,
  type DraftValidationState,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type GeometryDependencyRecord,
  type P1InvalidationSummary,
  type P1OperationLogSummary,
  type P1SceneContractV02,
  type P1ValidationSummary
} from "@homeai/contracts";
import {
  buildWallGraph,
  detectUnclosedBoundaries,
  filterInvalidFaces,
  normalizeWallSegments,
  polygonizeClosedFaces,
  preserveRoomLabels
} from "@homeai/geometry";
import {
  applyFloorplanOperations,
  buildDraftValidationState,
  buildSceneContractFromCanonicalRevision,
  confirmFloorplanDraft,
  createDraftFromCanonicalRevision,
  createDraftFromParsedFloorplan,
  persistSceneContract
} from "./index.js";
import { emitP1Event, eventTypeForOperation, type P1EventActor } from "./events.js";
import {
  compareGeometryHash,
  invalidateArtifactsForNewRevision,
  listGeometryDependentArtifacts,
  returnInvalidationSummary
} from "./invalidation.js";
import type { BoundaryIssue, PolygonFace, WallGraph } from "@homeai/geometry";
import type { P1RepositorySet } from "./repositories.js";

export type P1ApiContext = {
  repositories: P1RepositorySet;
  fixtureDrafts?: Record<string, FloorplanDraftRevision>;
  actor?: P1EventActor;
  now?: () => string;
  idFactory?: (prefix: string, seed: string) => string;
};

export type P1SessionResponse = {
  draftRevisionId: string;
  source: FloorplanDraftRevision["source"];
  validationSummary: P1ValidationSummary;
  activeCanonicalRevisionId?: string;
  geometryHash?: string;
};

export type P1DraftResponse = {
  draft: FloorplanDraftRevision;
  validation: DraftValidationState;
};

export type P1OperationResponse = {
  draft: FloorplanDraftRevision;
  validationSummary: P1ValidationSummary;
  operationLogSummary: P1OperationLogSummary;
};

export type P1BoundaryResponse = {
  rooms: FloorplanDraftRevision["rooms"];
  boundaryIssues: BoundaryIssue[];
  validationSummary: P1ValidationSummary;
};

export type P1ConfirmResponse =
  | {
      ok: true;
      canonicalRevisionId: string;
      geometryHash: string;
      sceneContractId: string;
      invalidationSummary: P1InvalidationSummary;
      nextStage: "p2_scene_setup";
    }
  | {
      ok: false;
      validation: DraftValidationState;
    };

export type P1DebugPayload = {
  fixture: { homeId: string; sourceAssetId?: string; source?: FloorplanDraftRevision["source"] };
  currentDraft?: FloorplanDraftRevision;
  operationLog: FloorplanEditOperation[];
  normalizedWallSegments: FloorplanDraftRevision["walls"];
  roomBoundaryOutput: {
    graph?: WallGraph;
    faces: PolygonFace[];
    boundaryIssues: BoundaryIssue[];
  };
  validation?: DraftValidationState;
  canonicalRevision?: CanonicalFloorplanRevision;
  geometryHash?: string;
  sceneContract?: P1SceneContractV02;
  downstreamDependencies: GeometryDependencyRecord[];
  invalidationSummary: P1InvalidationSummary;
  events: ReturnType<P1RepositorySet["events"]["listEventsByHome"]>;
};

export function postP1Session(
  context: P1ApiContext,
  homeId: string,
  input: { draft?: FloorplanDraftRevision } = {}
): P1SessionResponse {
  const now = currentTimestamp(context);
  const previousCanonical = context.repositories.canonical.getActiveCanonicalRevisionForHome(homeId);
  let draft: FloorplanDraftRevision;

  if (previousCanonical !== undefined) {
    draft = createDraftFromCanonicalRevision(previousCanonical, {
      draftRevisionId: makeId(context, "draft-reentry", `${homeId}-${now}`),
      createdAt: now
    }, context.repositories);
    emitP1Event(context.repositories.events, {
      eventId: makeId(context, "event-reentry", draft.draftRevisionId),
      eventType: "p1_reentered_from_downstream",
      homeId,
      ...actor(context),
      draftRevisionId: draft.draftRevisionId,
      canonicalRevisionId: previousCanonical.canonicalRevisionId,
      geometryHash: previousCanonical.geometryHash,
      previousGeometryHash: previousCanonical.geometryHash,
      newGeometryHash: previousCanonical.geometryHash,
      timestamp: now
    });
  } else {
    const sourceDraft = input.draft ?? context.fixtureDrafts?.[homeId];
    if (sourceDraft === undefined) {
      throw new Error(`No parsed draft or fixture is available for home: ${homeId}`);
    }
    draft = createDraftFromParsedFloorplan(sourceDraft, {
      draftRevisionId: makeId(context, "draft-session", `${homeId}-${now}`),
      createdAt: now,
      updatedAt: now
    }, context.repositories);
    emitP1Event(context.repositories.events, {
      eventId: makeId(context, "event-entered", draft.draftRevisionId),
      eventType: "p1_entered",
      homeId,
      ...actor(context),
      draftRevisionId: draft.draftRevisionId,
      timestamp: now
    });
  }

  const validation = draft.validation ?? buildDraftValidationState(draft, { validatedAt: now });
  return {
    draftRevisionId: draft.draftRevisionId,
    source: draft.source,
    validationSummary: summarizeValidation(validation),
    ...(previousCanonical === undefined ? {} : { activeCanonicalRevisionId: previousCanonical.canonicalRevisionId }),
    ...(previousCanonical === undefined ? {} : { geometryHash: previousCanonical.geometryHash })
  };
}

export function getP1Draft(context: P1ApiContext, draftRevisionId: string): P1DraftResponse {
  const draft = requireDraft(context, draftRevisionId);
  const validation = draft.validation ?? buildDraftValidationState(draft, { validatedAt: currentTimestamp(context) });
  return { draft, validation };
}

export function patchP1DraftOperations(
  context: P1ApiContext,
  draftRevisionId: string,
  input: { operations: FloorplanEditOperation[] }
): P1OperationResponse {
  const draft = requireDraft(context, draftRevisionId);
  const operations = input.operations.map((operation) => FloorplanEditOperationSchema.parse(operation));
  const updated = applyFloorplanOperations(draft, operations, {
    store: context.repositories,
    updatedAt: operations[operations.length - 1]?.createdAt ?? currentTimestamp(context)
  });

  for (const operation of operations) {
    const eventType = eventTypeForOperation(operation.operationType);
    if (eventType === undefined) {
      continue;
    }
    emitP1Event(context.repositories.events, {
      eventId: makeId(context, "event-operation", operation.operationId),
      eventType,
      homeId: updated.homeId,
      ...actor(context),
      draftRevisionId,
      operationType: operation.operationType,
      timestamp: operation.createdAt
    });
  }

  const validation = buildDraftValidationState(updated, { validatedAt: currentTimestamp(context) });
  return {
    draft: updated,
    validationSummary: summarizeValidation(validation),
    operationLogSummary: summarizeOperationLog(updated.operationLog)
  };
}

export function postP1RecomputeBoundaries(context: P1ApiContext, draftRevisionId: string): P1BoundaryResponse {
  const draft = requireDraft(context, draftRevisionId);
  const graph = buildWallGraph(draft.walls);
  const faces = filterInvalidFaces(polygonizeClosedFaces(graph), 1);
  const rooms = preserveRoomLabels(faces, draft.rooms);
  const boundaryIssues = detectUnclosedBoundaries(graph);
  const updated = FloorplanDraftRevisionSchema.parse({
    ...draft,
    rooms,
    validation: undefined,
    updatedAt: currentTimestamp(context)
  });
  context.repositories.drafts.updateDraft(updated);
  const validation = buildDraftValidationState(updated, { validatedAt: currentTimestamp(context) });
  return {
    rooms,
    boundaryIssues,
    validationSummary: summarizeValidation(validation)
  };
}

export function postP1ValidateDraft(context: P1ApiContext, draftRevisionId: string): DraftValidationState {
  const draft = requireDraft(context, draftRevisionId);
  const validation = buildDraftValidationState(draft, { validatedAt: currentTimestamp(context) });
  context.repositories.drafts.updateDraft(FloorplanDraftRevisionSchema.parse({
    ...draft,
    validation,
    updatedAt: currentTimestamp(context)
  }));
  return validation;
}

export function postP1ConfirmDraft(context: P1ApiContext, draftRevisionId: string): P1ConfirmResponse {
  const draft = requireDraft(context, draftRevisionId);
  const previousCanonical = context.repositories.canonical.getActiveCanonicalRevisionForHome(draft.homeId);
  const confirmedAt = currentTimestamp(context);
  const result = confirmFloorplanDraft(draft, {
    canonicalRevisionId: makeId(context, "canonical", `${draft.homeId}-${confirmedAt}`),
    version: 1,
    confirmedAt,
    userConfirmed: true,
    store: context.repositories
  });

  if (!result.ok) {
    return {
      ok: false,
      validation: result.validation
    };
  }

  const scene = persistSceneContract(
    buildSceneContractFromCanonicalRevision(result.canonicalRevision, {
      sceneContractId: makeId(context, "scene", result.canonicalRevisionId),
      createdAt: confirmedAt
    }),
    context.repositories
  );
  context.repositories.geometryDependencies.createDependencyRecord({
    dependencyId: makeId(context, "dependency-scene", scene.sceneContractId),
    artifactId: scene.sceneContractId,
    artifactType: "SceneContract",
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    status: "active",
    active: true,
    createdAt: confirmedAt
  });

  const invalidationSummary = invalidateArtifactsForNewRevision(context.repositories, {
    ...(previousCanonical === undefined ? {} : { previousCanonicalRevision: previousCanonical }),
    newCanonicalRevision: result.canonicalRevision,
    invalidatedAt: confirmedAt
  });

  emitP1Event(context.repositories.events, {
    eventId: makeId(context, "event-confirmed", result.canonicalRevisionId),
    eventType: "p1_floorplan_confirmed",
    homeId: draft.homeId,
    ...actor(context),
    draftRevisionId,
    canonicalRevisionId: result.canonicalRevisionId,
    geometryHash: result.geometryHash,
    timestamp: confirmedAt
  });

  return {
    ok: true,
    canonicalRevisionId: result.canonicalRevisionId,
    geometryHash: result.geometryHash,
    sceneContractId: scene.sceneContractId,
    invalidationSummary,
    nextStage: "p2_scene_setup"
  };
}

export function getP1Canonical(
  context: P1ApiContext,
  canonicalRevisionId: string
): CanonicalFloorplanRevision {
  const canonical = context.repositories.canonical.getCanonicalRevision(canonicalRevisionId);
  if (canonical === undefined) {
    throw new Error(`Canonical revision not found: ${canonicalRevisionId}`);
  }
  return canonical;
}

export function getP1SceneContract(context: P1ApiContext, sceneContractId: string): P1SceneContractV02 {
  const scene = context.repositories.sceneContracts.getSceneContract(sceneContractId);
  if (scene === undefined) {
    throw new Error(`SceneContract not found: ${sceneContractId}`);
  }
  return scene;
}

export function getP1DebugPayload(context: P1ApiContext, homeId: string): P1DebugPayload {
  const events = context.repositories.events.listEventsByHome(homeId);
  const latestDraftId = [...events].reverse().find((event) => event.draftRevisionId !== undefined)?.draftRevisionId;
  const currentDraft = latestDraftId === undefined ? undefined : context.repositories.drafts.getDraftById(latestDraftId);
  const canonicalRevision = context.repositories.canonical.getActiveCanonicalRevisionForHome(homeId);
  const sceneContract = context.repositories.sceneContracts.getActiveSceneContractForHome(homeId);
  const graph = currentDraft === undefined ? undefined : buildWallGraph(currentDraft.walls);
  const faces = graph === undefined ? [] : filterInvalidFaces(polygonizeClosedFaces(graph), 1);
  const boundaryIssues = graph === undefined ? [] : detectUnclosedBoundaries(graph);
  const validation = currentDraft === undefined
    ? undefined
    : currentDraft.validation ?? buildDraftValidationState(currentDraft, { validatedAt: currentTimestamp(context) });
  const dependencies = canonicalRevision === undefined
    ? []
    : listGeometryDependentArtifacts(context.repositories.geometryDependencies, {
        canonicalRevisionId: canonicalRevision.canonicalRevisionId
      });
  const comparison = compareGeometryHash(canonicalRevision?.geometryHash, sceneContract?.geometryHash);

  return {
    fixture: {
      homeId,
      ...(currentDraft?.sourceAssetId === undefined ? {} : { sourceAssetId: currentDraft.sourceAssetId }),
      ...(currentDraft?.source === undefined ? {} : { source: currentDraft.source })
    },
    ...(currentDraft === undefined ? {} : { currentDraft }),
    operationLog: latestDraftId === undefined ? [] : context.repositories.drafts.listOperations(latestDraftId),
    normalizedWallSegments: currentDraft === undefined ? [] : normalizeWallSegments(currentDraft.walls),
    roomBoundaryOutput: {
      ...(graph === undefined ? {} : { graph }),
      faces,
      boundaryIssues
    },
    ...(validation === undefined ? {} : { validation }),
    ...(canonicalRevision === undefined ? {} : { canonicalRevision }),
    ...(canonicalRevision === undefined ? {} : { geometryHash: canonicalRevision.geometryHash }),
    ...(sceneContract === undefined ? {} : { sceneContract }),
    downstreamDependencies: dependencies,
    invalidationSummary: returnInvalidationSummary({
      comparison,
      invalidatedDependencyIds: dependencies.filter((record) => record.status === "invalidated").map((record) => record.dependencyId),
      archivedDependencyIds: dependencies.filter((record) => record.status === "archived").map((record) => record.dependencyId)
    }),
    events
  };
}

export function summarizeValidation(validation: DraftValidationState): P1ValidationSummary {
  return P1ValidationSummarySchema.parse({
    status: validation.status,
    canConfirm: validation.canConfirm,
    issueCount: validation.issues.length,
    blockingIssueCount: validation.issues.filter((issue) => issue.blocksConfirmation).length
  });
}

export function summarizeOperationLog(operations: readonly FloorplanEditOperation[]): P1OperationLogSummary {
  return P1OperationLogSummarySchema.parse({
    count: operations.length,
    ...(operations[operations.length - 1]?.operationId === undefined
      ? {}
      : { lastOperationId: operations[operations.length - 1]?.operationId })
  });
}

function requireDraft(context: P1ApiContext, draftRevisionId: string): FloorplanDraftRevision {
  const draft = context.repositories.drafts.getDraftById(draftRevisionId);
  if (draft === undefined) {
    throw new Error(`Draft not found: ${draftRevisionId}`);
  }
  return draft;
}

function actor(context: P1ApiContext): P1EventActor {
  return context.actor ?? { anonymousSessionId: "anonymous-p1-session" };
}

function currentTimestamp(context: P1ApiContext): string {
  return DraftValidationStateSchema.shape.validatedAt.parse(context.now?.() ?? new Date().toISOString());
}

function makeId(context: P1ApiContext, prefix: string, seed: string): string {
  if (context.idFactory !== undefined) {
    return context.idFactory(prefix, seed);
  }
  return `${prefix}-${seed.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}
