import {
  DraftValidationStateSchema,
  FloorplanDraftRevisionSchema,
  FloorplanEditOperationSchema,
  LayoutIntentOperationSchema,
  P1OperationLogSummarySchema,
  P1ValidationSummarySchema,
  type CanonicalFloorplanRevision,
  type DraftValidationState,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type GeometryDependencyRecord,
  type LayoutIntentContract,
  type LayoutIntentInvalidationSummary,
  type LayoutIntentOperation,
  type LayoutIntentRevision,
  type LayoutIntentValidationState,
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
import { buildFullSpaceCoverageFromSceneContract } from "@homeai/scene";
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
import {
  applyLayoutIntentOperations,
  compareLayoutIntentHash,
  confirmLayoutIntentRevision,
  createInitialLayoutIntentFromSceneContract,
  emitLayoutIntentEvent,
  invalidateForLayoutIntentChange,
  invalidateLayoutIntentIfGeometryChanged,
  layoutEventTypeForOperation,
  validateLayoutIntent
} from "./layout-intent.js";
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

export type LayoutIntentSessionResponse = {
  layoutIntentRevisionId: string;
  canonicalRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  layoutIntentHash: string;
  aiAutofillEnabled: boolean;
  placeholders: LayoutIntentRevision["placeholders"];
  validation: LayoutIntentValidationState;
};

export type LayoutIntentOperationResponse = {
  layoutIntentRevision: LayoutIntentRevision;
  validation: LayoutIntentValidationState;
  layoutIntentHash: string;
};

export type LayoutIntentConfirmResponse =
  | {
      ok: true;
      layoutIntentRevisionId: string;
      layoutIntentContractId: string;
      layoutIntentHash: string;
      geometryHash: string;
      invalidationSummary: LayoutIntentInvalidationSummary;
    }
  | {
      ok: false;
      validation: LayoutIntentValidationState;
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
  sceneContractId?: string;
  sceneContract?: P1SceneContractV02;
  sceneContractSummary?: {
    sceneContractId: string;
    canonicalRevisionId: string;
    geometryHash: string;
    version: P1SceneContractV02["version"];
    readonly: true;
    roomCount: number;
    wallCount: number;
    openingCount: number;
  };
  downstreamBaselineSummary?: {
    whiteModel: {
      whiteModelId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      roomCount: number;
      wallCount: number;
    };
    controlScene: {
      controlSceneId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      roomCount: number;
    };
    cameraPlan: {
      cameraPlanBatchId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      roomPlanCount: number;
    };
    roomAffordanceGraph: {
      affordanceGraphId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      roomCount: number;
    };
    anchorPlan: {
      anchorPlanId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      anchorCount: number;
    };
    coverageReport: {
      coverageReportId: string;
      canonicalRevisionId: string;
      sceneContractId: string;
      geometryHash: string;
      status: string;
      issueCount: number;
      roomCoverageCount: number;
    };
  };
  downstreamDependencies: GeometryDependencyRecord[];
  invalidationSummary: P1InvalidationSummary;
  events: ReturnType<P1RepositorySet["events"]["listEventsByHome"]>;
  layoutIntent?: LayoutIntentRevision;
  activeLayoutIntentRevisionId?: string;
  activeLayoutIntentHash?: string;
  activeLayoutIntentContractId?: string;
  aiAutofillEnabled?: boolean;
  layoutPlaceholderSummary?: {
    count: number;
    byRoom: Record<string, number>;
    placeholderIds: string[];
  };
  layoutValidationSummary?: {
    status: LayoutIntentValidationState["status"];
    canConfirm: boolean;
    issueCount: number;
    errorCount: number;
  };
  layoutEvents: ReturnType<P1RepositorySet["layoutEvents"]["listLayoutIntentEventsByHome"]>;
  layoutInvalidationSummary?: LayoutIntentInvalidationSummary;
  hashComparison?: {
    geometryHash?: string;
    layoutIntentHash?: string;
    hashesAreSeparate: true;
  };
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

export function postLayoutIntentSession(context: P1ApiContext, homeId: string): LayoutIntentSessionResponse {
  const now = currentTimestamp(context);
  const canonical = context.repositories.canonical.getActiveCanonicalRevisionForHome(homeId);
  if (canonical === undefined) {
    throw new Error("Layout intent session requires an active canonical floorplan revision.");
  }
  const scene = context.repositories.sceneContracts.getActiveSceneContractForHome(homeId);
  if (scene === undefined) {
    throw new Error("Layout intent session requires an active SceneContract v0.2.");
  }
  const existing = context.repositories.layoutIntents.getActiveLayoutIntentForCanonicalRevision(canonical.canonicalRevisionId);
  const layoutIntent = existing ?? context.repositories.layoutIntents.createLayoutIntentRevision(
    createInitialLayoutIntentFromSceneContract(scene, {
      layoutIntentRevisionId: makeId(context, "layout-intent", `${homeId}-${canonical.canonicalRevisionId}`),
      createdAt: now
    })
  );
  emitLayoutIntentEvent(context.repositories.layoutEvents, {
    eventId: makeId(context, "event-layout-session", layoutIntent.layoutIntentRevisionId),
    eventType: "layout_intent_session_started",
    homeId,
    ...actor(context),
    canonicalRevisionId: layoutIntent.canonicalRevisionId,
    sceneContractId: layoutIntent.sceneContractId,
    geometryHash: layoutIntent.geometryHash,
    layoutIntentRevisionId: layoutIntent.layoutIntentRevisionId,
    layoutIntentHash: layoutIntent.layoutIntentHash,
    timestamp: now
  });

  return summarizeLayoutIntentSession(layoutIntent);
}

export function getLayoutIntentRevision(
  context: P1ApiContext,
  layoutIntentRevisionId: string
): LayoutIntentRevision {
  const layoutIntent = context.repositories.layoutIntents.getLayoutIntentRevision(layoutIntentRevisionId);
  if (layoutIntent === undefined) {
    throw new Error(`Layout intent revision not found: ${layoutIntentRevisionId}`);
  }
  return layoutIntent;
}

export function patchLayoutIntentOperations(
  context: P1ApiContext,
  layoutIntentRevisionId: string,
  input: { operations: LayoutIntentOperation[] }
): LayoutIntentOperationResponse {
  const layoutIntent = getLayoutIntentRevision(context, layoutIntentRevisionId);
  const scene = requireActiveSceneForLayout(context, layoutIntent);
  const operations = input.operations.map((operation) => LayoutIntentOperationSchema.parse(operation));
  const updated = applyLayoutIntentOperations(layoutIntent, operations, {
    sceneContract: scene,
    updatedAt: operations[operations.length - 1]?.createdAt ?? currentTimestamp(context),
    store: context.repositories.layoutIntents
  });
  for (const operation of operations) {
    emitLayoutIntentEvent(context.repositories.layoutEvents, {
      eventId: makeId(context, "event-layout-operation", operation.operationId),
      eventType: layoutEventTypeForOperation(operation.operationType),
      homeId: updated.homeId,
      ...actor(context),
      canonicalRevisionId: updated.canonicalRevisionId,
      sceneContractId: updated.sceneContractId,
      geometryHash: updated.geometryHash,
      layoutIntentRevisionId: updated.layoutIntentRevisionId,
      layoutIntentHash: updated.layoutIntentHash,
      ...(operation.placeholderId === undefined ? {} : { placeholderId: operation.placeholderId }),
      timestamp: operation.createdAt
    });
  }
  return {
    layoutIntentRevision: updated,
    validation: updated.validation,
    layoutIntentHash: updated.layoutIntentHash
  };
}

export function postLayoutIntentValidate(
  context: P1ApiContext,
  layoutIntentRevisionId: string
): LayoutIntentValidationState {
  const layoutIntent = getLayoutIntentRevision(context, layoutIntentRevisionId);
  const scene = requireActiveSceneForLayout(context, layoutIntent);
  const validation = validateLayoutIntent(layoutIntent, scene, { validatedAt: currentTimestamp(context) });
  const updated = context.repositories.layoutIntents.updateLayoutIntentRevision({
    ...layoutIntent,
    validation,
    updatedAt: currentTimestamp(context)
  });
  emitLayoutIntentEvent(context.repositories.layoutEvents, {
    eventId: makeId(context, "event-layout-validated", layoutIntentRevisionId),
    eventType: "layout_intent_validated",
    homeId: updated.homeId,
    ...actor(context),
    canonicalRevisionId: updated.canonicalRevisionId,
    sceneContractId: updated.sceneContractId,
    geometryHash: updated.geometryHash,
    layoutIntentRevisionId: updated.layoutIntentRevisionId,
    layoutIntentHash: updated.layoutIntentHash,
    timestamp: currentTimestamp(context)
  });
  return validation;
}

export function postLayoutIntentConfirm(
  context: P1ApiContext,
  layoutIntentRevisionId: string
): LayoutIntentConfirmResponse {
  const layoutIntent = getLayoutIntentRevision(context, layoutIntentRevisionId);
  const scene = requireActiveSceneForLayout(context, layoutIntent);
  const confirmedAt = currentTimestamp(context);
  const previousContract = context.repositories.layoutIntents.getActiveLayoutIntentContractForRevision(layoutIntentRevisionId);
  const result = confirmLayoutIntentRevision(layoutIntent, scene, {
    layoutIntentContractId: makeId(context, "layout-contract", layoutIntentRevisionId),
    confirmedAt,
    store: context.repositories.layoutIntents
  });
  if (!result.ok) {
    return {
      ok: false,
      validation: result.validation
    };
  }
  const invalidation = invalidateForLayoutIntentChange([], {
    ...(previousContract?.layoutIntentHash === undefined
      ? {}
      : { previousLayoutIntentHash: previousContract.layoutIntentHash }),
    newLayoutIntentHash: result.layoutIntentContract.layoutIntentHash,
    invalidatedAt: confirmedAt
  }).summary;
  emitLayoutIntentEvent(context.repositories.layoutEvents, {
    eventId: makeId(context, "event-layout-confirmed", layoutIntentRevisionId),
    eventType: "layout_intent_confirmed",
    homeId: result.layoutIntentRevision.homeId,
    ...actor(context),
    canonicalRevisionId: result.layoutIntentRevision.canonicalRevisionId,
    sceneContractId: result.layoutIntentRevision.sceneContractId,
    geometryHash: result.layoutIntentRevision.geometryHash,
    layoutIntentRevisionId,
    layoutIntentHash: result.layoutIntentRevision.layoutIntentHash,
    timestamp: confirmedAt
  });

  return {
    ok: true,
    layoutIntentRevisionId,
    layoutIntentContractId: result.layoutIntentContract.layoutIntentContractId,
    layoutIntentHash: result.layoutIntentContract.layoutIntentHash,
    geometryHash: result.layoutIntentContract.geometryHash,
    invalidationSummary: invalidation
  };
}

export function getLayoutIntentContract(
  context: P1ApiContext,
  layoutIntentRevisionId: string
): LayoutIntentContract {
  const contract = context.repositories.layoutIntents.getActiveLayoutIntentContractForRevision(layoutIntentRevisionId);
  if (contract === undefined) {
    throw new Error(`Layout intent contract not found for revision: ${layoutIntentRevisionId}`);
  }
  return contract;
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
  const layoutIntent = context.repositories.layoutIntents.getActiveLayoutIntentForHome(homeId);
  const layoutContract = layoutIntent === undefined
    ? undefined
    : context.repositories.layoutIntents.getActiveLayoutIntentContractForRevision(layoutIntent.layoutIntentRevisionId);
  const layoutEvents = context.repositories.layoutEvents.listLayoutIntentEventsByHome(homeId);
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
  const downstreamBaseline = sceneContract === undefined
    ? undefined
    : buildFullSpaceCoverageFromSceneContract(sceneContract);
  const layoutInvalidationSummary = layoutIntent === undefined || sceneContract === undefined
    ? undefined
    : invalidateLayoutIntentIfGeometryChanged(layoutIntent, sceneContract);

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
    ...(sceneContract === undefined ? {} : { sceneContractId: sceneContract.sceneContractId }),
    ...(sceneContract === undefined ? {} : { sceneContract }),
    ...(sceneContract === undefined
      ? {}
      : {
          sceneContractSummary: {
            sceneContractId: sceneContract.sceneContractId,
            canonicalRevisionId: sceneContract.canonicalRevisionId,
            geometryHash: sceneContract.geometryHash,
            version: sceneContract.version,
            readonly: true,
            roomCount: sceneContract.rooms.length,
            wallCount: sceneContract.walls.length,
            openingCount: sceneContract.openings.length
          }
        }),
    ...(downstreamBaseline === undefined
      ? {}
      : {
          downstreamBaselineSummary: {
            whiteModel: {
              whiteModelId: downstreamBaseline.whiteModel.whiteModelId,
              canonicalRevisionId: downstreamBaseline.whiteModel.canonicalRevisionId,
              sceneContractId: downstreamBaseline.whiteModel.sceneContractId,
              geometryHash: downstreamBaseline.whiteModel.geometryHash,
              status: downstreamBaseline.whiteModel.status,
              issueCount: downstreamBaseline.whiteModel.issues.length,
              roomCount: downstreamBaseline.whiteModel.rooms.length,
              wallCount: downstreamBaseline.whiteModel.walls.length
            },
            controlScene: {
              controlSceneId: downstreamBaseline.controlScene.controlSceneId,
              canonicalRevisionId: downstreamBaseline.controlScene.canonicalRevisionId,
              sceneContractId: downstreamBaseline.controlScene.sceneContractId,
              geometryHash: downstreamBaseline.controlScene.geometryHash,
              status: downstreamBaseline.controlScene.status,
              issueCount: downstreamBaseline.controlScene.issues.length,
              roomCount: downstreamBaseline.controlScene.rooms.length
            },
            cameraPlan: {
              cameraPlanBatchId: downstreamBaseline.cameraPlan.cameraPlanBatchId,
              canonicalRevisionId: downstreamBaseline.cameraPlan.canonicalRevisionId,
              sceneContractId: downstreamBaseline.cameraPlan.sceneContractId,
              geometryHash: downstreamBaseline.cameraPlan.geometryHash,
              status: downstreamBaseline.cameraPlan.status,
              issueCount: downstreamBaseline.cameraPlan.issues.length,
              roomPlanCount: downstreamBaseline.cameraPlan.roomPlans.length
            },
            roomAffordanceGraph: {
              affordanceGraphId: downstreamBaseline.affordanceGraph.affordanceGraphId,
              canonicalRevisionId: downstreamBaseline.affordanceGraph.canonicalRevisionId,
              sceneContractId: downstreamBaseline.affordanceGraph.sceneContractId,
              geometryHash: downstreamBaseline.affordanceGraph.geometryHash,
              status: downstreamBaseline.affordanceGraph.status,
              issueCount: downstreamBaseline.affordanceGraph.issues.length,
              roomCount: downstreamBaseline.affordanceGraph.rooms.length
            },
            anchorPlan: {
              anchorPlanId: downstreamBaseline.anchorPlan.anchorPlanId,
              canonicalRevisionId: downstreamBaseline.anchorPlan.canonicalRevisionId,
              sceneContractId: downstreamBaseline.anchorPlan.sceneContractId,
              geometryHash: downstreamBaseline.anchorPlan.geometryHash,
              status: downstreamBaseline.anchorPlan.status,
              issueCount: downstreamBaseline.anchorPlan.issues.length,
              anchorCount: downstreamBaseline.anchorPlan.anchors.length
            },
            coverageReport: {
              coverageReportId: downstreamBaseline.coverageReport.coverageReportId,
              canonicalRevisionId: downstreamBaseline.coverageReport.canonicalRevisionId,
              sceneContractId: downstreamBaseline.coverageReport.sceneContractId,
              geometryHash: downstreamBaseline.coverageReport.geometryHash,
              status: downstreamBaseline.coverageReport.status,
              issueCount: downstreamBaseline.coverageReport.issues.length,
              roomCoverageCount: downstreamBaseline.coverageReport.roomCoverage.length
            }
          }
        }),
    downstreamDependencies: dependencies,
    invalidationSummary: returnInvalidationSummary({
      comparison,
      invalidatedDependencyIds: dependencies.filter((record) => record.status === "invalidated").map((record) => record.dependencyId),
      archivedDependencyIds: dependencies.filter((record) => record.status === "archived").map((record) => record.dependencyId)
    }),
    events,
    ...(layoutIntent === undefined ? {} : { layoutIntent }),
    ...(layoutIntent === undefined ? {} : { activeLayoutIntentRevisionId: layoutIntent.layoutIntentRevisionId }),
    ...(layoutIntent === undefined ? {} : { activeLayoutIntentHash: layoutIntent.layoutIntentHash }),
    ...(layoutContract === undefined ? {} : { activeLayoutIntentContractId: layoutContract.layoutIntentContractId }),
    ...(layoutIntent === undefined ? {} : { aiAutofillEnabled: layoutIntent.aiAutofillEnabled }),
    ...(layoutIntent === undefined ? {} : { layoutPlaceholderSummary: summarizePlaceholders(layoutIntent) }),
    ...(layoutIntent === undefined ? {} : { layoutValidationSummary: summarizeLayoutValidation(layoutIntent.validation) }),
    layoutEvents,
    ...(layoutInvalidationSummary === undefined ? {} : { layoutInvalidationSummary }),
    hashComparison: {
      ...(canonicalRevision?.geometryHash === undefined ? {} : { geometryHash: canonicalRevision.geometryHash }),
      ...(layoutIntent?.layoutIntentHash === undefined ? {} : { layoutIntentHash: layoutIntent.layoutIntentHash }),
      hashesAreSeparate: true
    }
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

function summarizeLayoutIntentSession(layoutIntent: LayoutIntentRevision): LayoutIntentSessionResponse {
  return {
    layoutIntentRevisionId: layoutIntent.layoutIntentRevisionId,
    canonicalRevisionId: layoutIntent.canonicalRevisionId,
    sceneContractId: layoutIntent.sceneContractId,
    geometryHash: layoutIntent.geometryHash,
    layoutIntentHash: layoutIntent.layoutIntentHash,
    aiAutofillEnabled: layoutIntent.aiAutofillEnabled,
    placeholders: layoutIntent.placeholders,
    validation: layoutIntent.validation
  };
}

function requireActiveSceneForLayout(context: P1ApiContext, layoutIntent: LayoutIntentRevision): P1SceneContractV02 {
  const scene = context.repositories.sceneContracts.getSceneContract(layoutIntent.sceneContractId);
  if (scene === undefined) {
    throw new Error(`SceneContract not found for layout intent: ${layoutIntent.sceneContractId}`);
  }
  if (scene.geometryHash !== layoutIntent.geometryHash || scene.canonicalRevisionId !== layoutIntent.canonicalRevisionId) {
    throw new Error("Layout intent geometry trace does not match its SceneContract.");
  }
  return scene;
}

function summarizePlaceholders(layoutIntent: LayoutIntentRevision) {
  const byRoom: Record<string, number> = {};
  for (const placeholder of layoutIntent.placeholders) {
    byRoom[placeholder.roomId] = (byRoom[placeholder.roomId] ?? 0) + 1;
  }
  return {
    count: layoutIntent.placeholders.length,
    byRoom,
    placeholderIds: layoutIntent.placeholders.map((placeholder) => placeholder.placeholderId).sort()
  };
}

function summarizeLayoutValidation(validation: LayoutIntentValidationState) {
  return {
    status: validation.status,
    canConfirm: validation.canConfirm,
    issueCount: validation.issues.length,
    errorCount: validation.issues.filter((issue) => issue.severity === "error").length
  };
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
