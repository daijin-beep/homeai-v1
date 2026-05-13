import {
  P1AnchorPlanSchema,
  P1ControlSceneSchema,
  P1DownstreamCoverageReportSchema,
  P1RoomAffordanceGraphSchema,
  P1RoomCameraPlanBatchSchema,
  P1SceneContractV02Schema,
  P1WhiteModelSchema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type GeometryHash,
  type P1AnchorPlan,
  type P1ControlScene,
  type P1DownstreamCoverageReport,
  type P1DownstreamIssue,
  type P1RoomAffordanceGraph,
  type P1RoomCameraPlanBatch,
  type P1SceneContractV02,
  type P1SceneOpening,
  type P1WhiteModel,
  type Point2D
} from "@homeai/contracts";
import { computeFloorplanBBox } from "@homeai/geometry";

type SceneBuildOptions = {
  expectedGeometryHash?: GeometryHash;
  createdAt?: string;
};

type WhiteModelOptions = SceneBuildOptions & {
  whiteModelId?: string;
  ceilingHeightMm?: number;
  wallHeightMm?: number;
};

type ControlSceneOptions = SceneBuildOptions & {
  controlSceneId?: string;
};

type CameraPlanOptions = SceneBuildOptions & {
  cameraPlanBatchId?: string;
};

type AffordanceGraphOptions = SceneBuildOptions & {
  affordanceGraphId?: string;
};

type AnchorPlanOptions = {
  anchorPlanId?: string;
  expectedGeometryHash?: GeometryHash;
  createdAt?: string;
};

type CoverageOptions = SceneBuildOptions & {
  coverageReportId?: string;
};

export type P1DownstreamBaselineBundle = {
  whiteModel: P1WhiteModel;
  controlScene: P1ControlScene;
  cameraPlan: P1RoomCameraPlanBatch;
  affordanceGraph: P1RoomAffordanceGraph;
  anchorPlan: P1AnchorPlan;
  coverageReport: P1DownstreamCoverageReport;
};

export class P1GeometryHashMismatchError extends Error {
  readonly code = "GEOMETRY_HASH_MISMATCH";
  readonly artifactType: string;
  readonly sourceId: string;
  readonly expectedGeometryHash: GeometryHash;
  readonly actualGeometryHash: GeometryHash;

  constructor(input: {
    artifactType: string;
    sourceId: string;
    expectedGeometryHash: GeometryHash;
    actualGeometryHash: GeometryHash;
  }) {
    super(
      `${input.artifactType} rejected geometryHash mismatch for ${input.sourceId}: expected ${input.expectedGeometryHash}, got ${input.actualGeometryHash}.`
    );
    this.name = "P1GeometryHashMismatchError";
    this.artifactType = input.artifactType;
    this.sourceId = input.sourceId;
    this.expectedGeometryHash = input.expectedGeometryHash;
    this.actualGeometryHash = input.actualGeometryHash;
  }

  toJSON() {
    return {
      code: this.code,
      artifactType: this.artifactType,
      sourceId: this.sourceId,
      expectedGeometryHash: this.expectedGeometryHash,
      actualGeometryHash: this.actualGeometryHash,
      message: this.message
    };
  }
}

export function createSceneContractV02(
  canonicalRevision: CanonicalFloorplanRevision,
  options: { sceneContractId?: string; createdAt?: string } = {}
): P1SceneContractV02 {
  const scene = {
    sceneContractId: options.sceneContractId ?? `scene-${canonicalRevision.canonicalRevisionId}`,
    version: "0.2" as const,
    readonly: true as const,
    homeId: canonicalRevision.homeId,
    canonicalRevisionId: canonicalRevision.canonicalRevisionId,
    geometryHash: canonicalRevision.geometryHash,
    unit: "mm" as const,
    rooms: canonicalRevision.rooms.map((room) => ({
      roomId: room.roomId,
      roomType: room.roomType,
      polygon: room.polygon.map(clonePoint),
      ...(room.roomType === "balcony" ? { balconyMeta: cloneBalconyMeta(room.balconyMeta) } : {})
    })),
    walls: canonicalRevision.walls.map((wall) => ({
      wallId: wall.wallId,
      start: clonePoint(wall.start),
      end: clonePoint(wall.end),
      thicknessMm: wall.thicknessMm,
      kind: wall.kind
    })),
    openings: canonicalRevision.openings.map(toSceneOpening),
    validation: {
      status: "valid" as const,
      errors: [],
      warnings: []
    },
    createdAt: options.createdAt ?? canonicalRevision.confirmedAt
  };

  return deepFreeze(P1SceneContractV02Schema.parse(scene));
}

export function buildWhiteModelFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: WhiteModelOptions = {}
): P1WhiteModel {
  const scene = verifySceneContractForDownstream(sceneContract, "WhiteModel", options.expectedGeometryHash);
  const model = {
    whiteModelId: options.whiteModelId ?? `white-model-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    source: "scene_contract_v0.2" as const,
    status: "ready" as const,
    issues: [],
    createdAt: options.createdAt ?? scene.createdAt,
    readonly: true as const,
    unit: "mm" as const,
    rooms: scene.rooms.map((room) => ({
      roomId: room.roomId,
      roomType: room.roomType,
      floorPolygon: room.polygon.map(clonePoint),
      floorElevationMm: 0,
      ceilingHeightMm: options.ceilingHeightMm ?? 2800
    })),
    walls: scene.walls.map((wall) => ({
      wallId: wall.wallId,
      start: clonePoint(wall.start),
      end: clonePoint(wall.end),
      thicknessMm: wall.thicknessMm,
      heightMm: options.wallHeightMm ?? 2800
    })),
    openingProxies: scene.openings.map(toOpeningProxy)
  };

  return deepFreeze(P1WhiteModelSchema.parse(model));
}

export function buildControlSceneFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: ControlSceneOptions = {}
): P1ControlScene {
  const scene = verifySceneContractForDownstream(sceneContract, "ControlScene", options.expectedGeometryHash);
  const controlScene = {
    controlSceneId: options.controlSceneId ?? `control-scene-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    source: "scene_contract_v0.2" as const,
    status: "ready" as const,
    issues: [],
    createdAt: options.createdAt ?? scene.createdAt,
    readonly: true as const,
    unit: "mm" as const,
    rooms: scene.rooms.map((room) => ({
      roomId: room.roomId,
      roomType: room.roomType,
      boundary: room.polygon.map(clonePoint),
      center: polygonCenter(room.polygon),
      status: "covered" as const
    })),
    walls: scene.walls.map((wall) => ({
      wallId: wall.wallId,
      start: clonePoint(wall.start),
      end: clonePoint(wall.end),
      thicknessMm: wall.thicknessMm,
      kind: wall.kind
    })),
    openingProxies: scene.openings.map(toOpeningProxy)
  };

  return deepFreeze(P1ControlSceneSchema.parse(controlScene));
}

export function buildCameraPlanFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: CameraPlanOptions = {}
): P1RoomCameraPlanBatch {
  const scene = verifySceneContractForDownstream(sceneContract, "CameraPlan", options.expectedGeometryHash);
  const issues = scene.rooms.flatMap((room) => room.polygon.length < 4
    ? [downstreamIssue("CAMERA_ROOM_POLYGON_INVALID", room.roomId, "camera_plan")]
    : []);
  const batch = {
    cameraPlanBatchId: options.cameraPlanBatchId ?? `camera-batch-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    source: "scene_contract_v0.2" as const,
    status: issues.length === 0 ? "ready" as const : "failed" as const,
    issues,
    createdAt: options.createdAt ?? scene.createdAt,
    unit: "mm" as const,
    roomPlans: scene.rooms.map((room) => {
      const center = polygonCenter(room.polygon);
      return {
        roomId: room.roomId,
        status: "covered" as const,
        issues: [],
        cameras: [
          {
            cameraId: `camera-${room.roomId}-overview`,
            position: { x: center.x, y: center.y },
            target: { x: center.x, y: center.y },
            heightMm: 1600,
            fovDegrees: 65,
            valid: true as const
          }
        ]
      };
    })
  };

  return deepFreeze(P1RoomCameraPlanBatchSchema.parse(batch));
}

export function createRoomCameraPlans(
  scene: P1SceneContractV02,
  options: CameraPlanOptions = {}
): P1RoomCameraPlanBatch {
  return buildCameraPlanFromSceneContract(scene, options);
}

export function buildRoomAffordanceGraphFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: AffordanceGraphOptions = {}
): P1RoomAffordanceGraph {
  const scene = verifySceneContractForDownstream(sceneContract, "RoomAffordanceGraph", options.expectedGeometryHash);
  const wallIds = scene.walls.map((wall) => wall.wallId).sort();
  const blockedOpeningIds = scene.openings
    .filter((opening) => scene.walls.some((wall) => wall.wallId === opening.wallId))
    .map((opening) => opening.openingId)
    .sort();
  const graph = {
    affordanceGraphId: options.affordanceGraphId ?? `affordance-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    source: "scene_contract_v0.2" as const,
    status: "ready" as const,
    issues: [],
    createdAt: options.createdAt ?? scene.createdAt,
    rooms: scene.rooms.map((room) => {
      const anchorId = `anchor-${room.roomId}-center`;
      return {
        roomId: room.roomId,
        roomType: room.roomType,
        usableAreaMm2: polygonArea(room.polygon),
        usableWallSegmentIds: wallIds,
        blockedOpeningIds,
        forbiddenZoneIds: blockedOpeningIds.map((openingId) => `forbidden-opening-${openingId}`),
        circulationHints: blockedOpeningIds.length === 0 ? [] : ["keep door/window clearance zones open"],
        candidateAnchorIds: [anchorId],
        candidateAnchors: [
          {
            anchorId,
            type: "room_center" as const,
            position: polygonCenter(room.polygon),
            blocksDoorOrWindow: false as const
          }
        ]
      };
    })
  };

  return deepFreeze(P1RoomAffordanceGraphSchema.parse(graph));
}

export function buildRoomAffordanceGraph(
  scene: P1SceneContractV02,
  options: AffordanceGraphOptions = {}
): P1RoomAffordanceGraph {
  return buildRoomAffordanceGraphFromSceneContract(scene, options);
}

export function buildAnchorPlanFromAffordanceGraph(
  graph: P1RoomAffordanceGraph,
  options: AnchorPlanOptions = {}
): P1AnchorPlan {
  const parsedGraph = P1RoomAffordanceGraphSchema.parse(graph);
  verifyGeometryHashMatch(parsedGraph.geometryHash, options.expectedGeometryHash, {
    artifactType: "AnchorPlan",
    sourceId: parsedGraph.affordanceGraphId
  });

  const anchors = parsedGraph.rooms.flatMap((room) =>
    room.candidateAnchors.map((anchor) => ({
      anchorId: anchor.anchorId,
      roomId: room.roomId,
      type: anchor.type,
      ...(anchor.targetId === undefined ? {} : { targetId: anchor.targetId }),
      position: clonePoint(anchor.position),
      blocksDoorOrWindow: false as const
    }))
  );
  const missingAnchorIssues = parsedGraph.rooms
    .filter((room) => !anchors.some((anchor) => anchor.roomId === room.roomId))
    .map((room) => downstreamIssue("ANCHOR_ROOM_UNCOVERED", room.roomId, "anchor_plan"));
  const plan = {
    anchorPlanId: options.anchorPlanId ?? `anchor-plan-${parsedGraph.affordanceGraphId}`,
    affordanceGraphId: parsedGraph.affordanceGraphId,
    sceneContractId: parsedGraph.sceneContractId,
    homeId: parsedGraph.homeId,
    canonicalRevisionId: parsedGraph.canonicalRevisionId,
    geometryHash: parsedGraph.geometryHash,
    source: "room_affordance_graph" as const,
    status: missingAnchorIssues.length === 0 ? "ready" as const : "failed" as const,
    issues: missingAnchorIssues,
    createdAt: options.createdAt ?? parsedGraph.createdAt,
    anchors
  };

  return deepFreeze(P1AnchorPlanSchema.parse(plan));
}

export function planAnchors(
  graph: P1RoomAffordanceGraph,
  sceneOrOptions: P1SceneContractV02 | AnchorPlanOptions = {},
  maybeOptions: AnchorPlanOptions = {}
): P1AnchorPlan {
  const scene = isSceneContract(sceneOrOptions) ? sceneOrOptions : undefined;
  const options = scene === undefined ? sceneOrOptions as AnchorPlanOptions : maybeOptions;
  if (scene !== undefined) {
    verifyGeometryHashMatch(graph.geometryHash, scene.geometryHash, {
      artifactType: "AnchorPlan",
      sourceId: graph.affordanceGraphId
    });
  }
  return buildAnchorPlanFromAffordanceGraph(graph, options);
}

export function buildFullSpaceCoverageFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: CoverageOptions = {}
): P1DownstreamBaselineBundle {
  const scene = verifySceneContractForDownstream(sceneContract, "P1DownstreamCoverageReport", options.expectedGeometryHash);
  const createdAt = options.createdAt ?? scene.createdAt;
  const whiteModel = buildWhiteModelFromSceneContract(scene, { expectedGeometryHash: scene.geometryHash, createdAt });
  const controlScene = buildControlSceneFromSceneContract(scene, { expectedGeometryHash: scene.geometryHash, createdAt });
  const cameraPlan = buildCameraPlanFromSceneContract(scene, { expectedGeometryHash: scene.geometryHash, createdAt });
  const affordanceGraph = buildRoomAffordanceGraphFromSceneContract(scene, { expectedGeometryHash: scene.geometryHash, createdAt });
  const anchorPlan = buildAnchorPlanFromAffordanceGraph(affordanceGraph, {
    expectedGeometryHash: scene.geometryHash,
    createdAt
  });

  const roomCoverage = scene.rooms.map((room) => {
    const hasWhiteModel = whiteModel.rooms.some((candidate) => candidate.roomId === room.roomId);
    const hasControlScene = controlScene.rooms.some((candidate) => candidate.roomId === room.roomId);
    const hasCameraPlan = cameraPlan.roomPlans.some((candidate) => candidate.roomId === room.roomId);
    const hasAffordanceGraph = affordanceGraph.rooms.some((candidate) => candidate.roomId === room.roomId);
    const hasAnchorPlan = anchorPlan.anchors.some((candidate) => candidate.roomId === room.roomId);
    const issues = [
      ...(hasWhiteModel ? [] : [downstreamIssue("WHITE_MODEL_ROOM_UNCOVERED", room.roomId, "white_model")]),
      ...(hasControlScene ? [] : [downstreamIssue("CONTROL_SCENE_ROOM_UNCOVERED", room.roomId, "control_scene")]),
      ...(hasCameraPlan ? [] : [downstreamIssue("CAMERA_ROOM_UNCOVERED", room.roomId, "camera_plan")]),
      ...(hasAffordanceGraph ? [] : [downstreamIssue("AFFORDANCE_ROOM_UNCOVERED", room.roomId, "affordance_graph")]),
      ...(hasAnchorPlan ? [] : [downstreamIssue("ANCHOR_ROOM_UNCOVERED", room.roomId, "anchor_plan")])
    ];
    return {
      roomId: room.roomId,
      roomType: room.roomType,
      hasWhiteModel,
      hasControlScene,
      hasCameraPlan,
      hasAffordanceGraph,
      hasAnchorPlan,
      status: issues.length === 0 ? "covered" as const : "failed" as const,
      issues
    };
  });
  const reportIssues = roomCoverage.flatMap((room) => room.issues);
  const coverageReport = deepFreeze(P1DownstreamCoverageReportSchema.parse({
    coverageReportId: options.coverageReportId ?? `coverage-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    source: "scene_contract_v0.2" as const,
    status: reportIssues.length === 0 ? "ready" as const : "failed" as const,
    issues: reportIssues,
    createdAt,
    roomCoverage
  }));

  return {
    whiteModel,
    controlScene,
    cameraPlan,
    affordanceGraph,
    anchorPlan,
    coverageReport
  };
}

export function verifyGeometryHashMatch(
  actualGeometryHash: GeometryHash,
  expectedGeometryHash: GeometryHash | undefined,
  context: { artifactType: string; sourceId: string }
): true {
  if (expectedGeometryHash !== undefined && expectedGeometryHash !== actualGeometryHash) {
    throw new P1GeometryHashMismatchError({
      artifactType: context.artifactType,
      sourceId: context.sourceId,
      expectedGeometryHash,
      actualGeometryHash
    });
  }
  return true;
}

function verifySceneContractForDownstream(
  sceneContract: P1SceneContractV02,
  artifactType: string,
  expectedGeometryHash: GeometryHash | undefined
): P1SceneContractV02 {
  const scene = P1SceneContractV02Schema.parse(sceneContract);
  if (scene.readonly !== true || scene.version !== "0.2") {
    throw new Error("SceneContract v0.2 must be readonly before downstream use.");
  }
  verifyGeometryHashMatch(scene.geometryHash, expectedGeometryHash, {
    artifactType,
    sourceId: scene.sceneContractId
  });
  return scene;
}

function toSceneOpening(opening: CanonicalFloorplanRevision["openings"][number]): P1SceneOpening {
  if (opening.type === "door") {
    return {
      openingId: opening.openingId,
      type: opening.type,
      wallId: opening.wallId,
      positionOnWall: opening.positionOnWall,
      widthMm: opening.widthMm,
      heightMm: opening.heightMm,
      swing: opening.swing
    };
  }

  return {
    openingId: opening.openingId,
    type: opening.type,
    wallId: opening.wallId,
    positionOnWall: opening.positionOnWall,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    ...(opening.sillHeightMm === undefined ? {} : { sillHeightMm: opening.sillHeightMm }),
    windowKind: opening.windowKind,
    ...(opening.windowKind === "bay" ? { projectionDepthMm: opening.projectionDepthMm } : {}),
    ...(opening.windowKind === "bay" ? { projectionSide: opening.projectionSide } : {})
  };
}

function toOpeningProxy(opening: P1SceneOpening) {
  return {
    openingId: opening.openingId,
    type: opening.type,
    wallId: opening.wallId,
    positionOnWall: opening.positionOnWall,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    ...(opening.swing === undefined ? {} : { swing: opening.swing }),
    ...(opening.windowKind === undefined ? {} : { windowKind: opening.windowKind }),
    ...(opening.projectionDepthMm === undefined ? {} : { projectionDepthMm: opening.projectionDepthMm }),
    ...(opening.projectionSide === undefined ? {} : { projectionSide: opening.projectionSide }),
    blocksWallTopology: false as const
  };
}

function isSceneContract(value: P1SceneContractV02 | AnchorPlanOptions): value is P1SceneContractV02 {
  return "sceneContractId" in value && "geometryHash" in value && "version" in value;
}

function polygonCenter(points: readonly Point2D[]): Point2D {
  const bbox = computeFloorplanBBox(points);
  return {
    x: bbox.minX + bbox.widthMm / 2,
    y: bbox.minY + bbox.heightMm / 2
  };
}

function polygonArea(points: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (a === undefined || b === undefined) {
      continue;
    }
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

function downstreamIssue(
  code: string,
  roomId: string,
  targetType: NonNullable<P1DownstreamIssue["targetType"]>
): P1DownstreamIssue {
  return {
    issueId: `issue-${code.toLowerCase()}-${roomId}`,
    severity: "error",
    code,
    message: "Geometry-dependent downstream coverage is incomplete.",
    roomId,
    targetType,
    targetId: roomId
  };
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
    const child = (value as Record<PropertyKey, unknown>)[key];
    deepFreeze(child);
  }

  return Object.freeze(value);
}
