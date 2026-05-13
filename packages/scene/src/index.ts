import {
  P1AnchorPlanSchema,
  P1RoomAffordanceGraphSchema,
  P1RoomCameraPlanBatchSchema,
  P1SceneContractV02Schema,
  P1WhiteModelSchema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type P1AnchorPlan,
  type P1RoomAffordanceGraph,
  type P1RoomCameraPlanBatch,
  type P1SceneContractV02,
  type P1SceneOpening,
  type P1WhiteModel,
  type Point2D
} from "@homeai/contracts";
import { computeFloorplanBBox } from "@homeai/geometry";

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
  scene: P1SceneContractV02,
  options: { whiteModelId?: string; ceilingHeightMm?: number; wallHeightMm?: number } = {}
): P1WhiteModel {
  const model = {
    whiteModelId: options.whiteModelId ?? `white-model-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
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
    }))
  };

  return P1WhiteModelSchema.parse(model);
}

export function createRoomCameraPlans(
  scene: P1SceneContractV02,
  options: { cameraPlanBatchId?: string } = {}
): P1RoomCameraPlanBatch {
  const batch = {
    cameraPlanBatchId: options.cameraPlanBatchId ?? `camera-batch-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    unit: "mm" as const,
    roomPlans: scene.rooms.map((room) => {
      const center = polygonCenter(room.polygon);
      return {
        roomId: room.roomId,
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

  return P1RoomCameraPlanBatchSchema.parse(batch);
}

export function buildRoomAffordanceGraph(
  scene: P1SceneContractV02,
  options: { affordanceGraphId?: string } = {}
): P1RoomAffordanceGraph {
  const graph = {
    affordanceGraphId: options.affordanceGraphId ?? `affordance-${scene.sceneContractId}`,
    sceneContractId: scene.sceneContractId,
    homeId: scene.homeId,
    canonicalRevisionId: scene.canonicalRevisionId,
    geometryHash: scene.geometryHash,
    rooms: scene.rooms.map((room) => ({
      roomId: room.roomId,
      roomType: room.roomType,
      usableAreaMm2: polygonArea(room.polygon),
      blockedOpeningIds: scene.openings
        .filter((opening) => scene.walls.some((wall) => wall.wallId === opening.wallId))
        .map((opening) => opening.openingId)
        .sort(),
      candidateAnchorIds: [`anchor-${room.roomId}-center`]
    }))
  };

  return P1RoomAffordanceGraphSchema.parse(graph);
}

export function planAnchors(
  graph: P1RoomAffordanceGraph,
  scene: P1SceneContractV02,
  options: { anchorPlanId?: string } = {}
): P1AnchorPlan {
  const plan = {
    anchorPlanId: options.anchorPlanId ?? `anchor-plan-${graph.affordanceGraphId}`,
    affordanceGraphId: graph.affordanceGraphId,
    sceneContractId: graph.sceneContractId,
    homeId: graph.homeId,
    canonicalRevisionId: graph.canonicalRevisionId,
    geometryHash: graph.geometryHash,
    anchors: graph.rooms.map((room) => {
      const sceneRoom = scene.rooms.find((candidate) => candidate.roomId === room.roomId);
      const position = sceneRoom === undefined ? { x: 0, y: 0 } : polygonCenter(sceneRoom.polygon);
      return {
        anchorId: `anchor-${room.roomId}-center`,
        roomId: room.roomId,
        type: "room_center" as const,
        position,
        blocksDoorOrWindow: false as const
      };
    })
  };

  return P1AnchorPlanSchema.parse(plan);
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
