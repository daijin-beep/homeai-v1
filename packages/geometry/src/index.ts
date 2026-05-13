import { createHash } from "node:crypto";
import {
  CanonicalFloorplanRevisionSchema,
  FloorplanDraftRevisionSchema,
  type BalconyMeta,
  type CanonicalFloorplanRevision,
  type DraftDoorOpening,
  type DraftOpening,
  type DraftRoom,
  type DraftWallSegment,
  type DraftWindowOpening,
  type FloorplanDraftRevision,
  type FloorplanEditOperation,
  type Point2D
} from "@homeai/contracts";

export const DEFAULT_SNAP_TOLERANCE_MM = 100;
export const DEFAULT_TINY_FACE_AREA_MM2 = 500_000;
export const DEFAULT_IOU_THRESHOLD = 0.5;

const EPSILON = 1e-9;

export type WallSegmentInput = Pick<
  DraftWallSegment,
  "wallId" | "start" | "end" | "thicknessMm" | "kind"
> &
  Partial<Pick<DraftWallSegment, "source" | "curveApproximation">>;

export type FloorplanBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
};

export type ArcInput = {
  start: Point2D;
  control: Point2D;
  end: Point2D;
  maxChordErrorMm: number;
};

export type WallGraphNode = {
  id: string;
  point: Point2D;
};

export type WallGraphEdge = {
  id: string;
  wallId: string;
  from: string;
  to: string;
  start: Point2D;
  end: Point2D;
};

export type WallGraph = {
  nodes: WallGraphNode[];
  edges: WallGraphEdge[];
};

export type PolygonFace = {
  faceId: string;
  polygon: Point2D[];
  areaMm2: number;
};

export type BoundaryIssue = {
  issueId: string;
  severity: "info" | "warning" | "error" | "blocking";
  code: string;
  message: string;
  targetType: "draft" | "wall" | "opening" | "room" | "global_params";
  targetId?: string;
  blocksConfirmation: boolean;
};

export type RoomMatch = {
  faceId: string;
  roomId: string;
  iou: number;
};

export type CreateCanonicalFloorplanRevisionInput = {
  canonicalRevisionId: string;
  confirmedAt: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export function computeSegmentLength(segment: Pick<WallSegmentInput, "start" | "end">): number {
  return distance(segment.start, segment.end);
}

export function normalizeWallSegments<T extends WallSegmentInput>(segments: readonly T[]): T[] {
  return segments
    .map((segment) => {
      const shouldFlip = comparePoint(segment.start, segment.end) > 0;
      return {
        ...segment,
        start: shouldFlip ? clonePoint(segment.end) : clonePoint(segment.start),
        end: shouldFlip ? clonePoint(segment.start) : clonePoint(segment.end)
      };
    })
    .sort(compareWallSegments);
}

export function snapWallEndpoints<T extends WallSegmentInput>(
  segments: readonly T[],
  toleranceMm = DEFAULT_SNAP_TOLERANCE_MM
): T[] {
  const endpoints = segments.flatMap((segment, segmentIndex) => [
    { segmentIndex, key: "start" as const, point: segment.start },
    { segmentIndex, key: "end" as const, point: segment.end }
  ]);

  const sortedEndpoints = [...endpoints].sort((a, b) => comparePoint(a.point, b.point));
  const snapped = new Map<string, Point2D>();

  for (const endpoint of sortedEndpoints) {
    const existing = [...snapped.values()].find((point) => distance(point, endpoint.point) <= toleranceMm);
    const target = existing ?? clonePoint(endpoint.point);
    snapped.set(`${endpoint.segmentIndex}:${endpoint.key}`, target);
  }

  return segments.map((segment, index) => ({
    ...segment,
    start: clonePoint(snapped.get(`${index}:start`) ?? segment.start),
    end: clonePoint(snapped.get(`${index}:end`) ?? segment.end)
  }));
}

export function splitWallIntersections<T extends WallSegmentInput>(segments: readonly T[]): T[] {
  const splitParams = segments.map(() => new Set<number>([0, 1]));

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i];
      const b = segments[j];
      if (a === undefined || b === undefined) {
        continue;
      }

      const intersection = getSegmentIntersection(a.start, a.end, b.start, b.end);
      if (intersection === null) {
        continue;
      }

      if (intersection.tA > EPSILON && intersection.tA < 1 - EPSILON) {
        splitParams[i]?.add(roundForHash(intersection.tA));
      }
      if (intersection.tB > EPSILON && intersection.tB < 1 - EPSILON) {
        splitParams[j]?.add(roundForHash(intersection.tB));
      }
    }
  }

  const result: T[] = [];
  segments.forEach((segment, segmentIndex) => {
    const params = [...(splitParams[segmentIndex] ?? new Set<number>([0, 1]))].sort((a, b) => a - b);
    if (params.length <= 2) {
      result.push({ ...segment, start: clonePoint(segment.start), end: clonePoint(segment.end) });
      return;
    }

    for (let i = 0; i < params.length - 1; i += 1) {
      const startT = params[i];
      const endT = params[i + 1];
      if (startT === undefined || endT === undefined || Math.abs(endT - startT) <= EPSILON) {
        continue;
      }
      result.push({
        ...segment,
        wallId: `${segment.wallId}-split-${i + 1}`,
        start: interpolate(segment.start, segment.end, startT),
        end: interpolate(segment.start, segment.end, endT)
      });
    }
  });

  return result;
}

export function deduplicateSegments<T extends WallSegmentInput>(segments: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const segment of normalizeWallSegments(segments)) {
    const key = segmentGeometryKey(segment);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(segment);
  }

  return result;
}

export function computeFloorplanBBox(input: readonly Point2D[] | readonly WallSegmentInput[]): FloorplanBBox {
  const points = input.flatMap((item) => {
    if ("start" in item && "end" in item) {
      return [item.start, item.end];
    }
    return [item];
  });

  if (points.length === 0) {
    throw new Error("Cannot compute floorplan bbox without points.");
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY
  };
}

export function convertArcToPolyline(input: ArcInput): Point2D[] {
  if (input.maxChordErrorMm <= 0) {
    throw new Error("maxChordErrorMm must be positive.");
  }

  const circle = circleFromThreePoints(input.start, input.control, input.end);
  if (circle === null) {
    throw new Error("Arc control points must not be collinear.");
  }

  const startAngle = Math.atan2(input.start.y - circle.center.y, input.start.x - circle.center.x);
  const controlAngle = Math.atan2(input.control.y - circle.center.y, input.control.x - circle.center.x);
  const endAngle = Math.atan2(input.end.y - circle.center.y, input.end.x - circle.center.x);
  const ccwSweep = normalizeAngle(endAngle - startAngle);
  const controlSweep = normalizeAngle(controlAngle - startAngle);
  const sweep = controlSweep <= ccwSweep ? ccwSweep : ccwSweep - Math.PI * 2;
  const absSweep = Math.abs(sweep);
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - input.maxChordErrorMm / circle.radius)));
  const stepCount = Math.max(2, Math.ceil(absSweep / maxStep));

  const points: Point2D[] = [];
  for (let i = 0; i <= stepCount; i += 1) {
    const angle = startAngle + (sweep * i) / stepCount;
    points.push({
      x: roundForHash(circle.center.x + Math.cos(angle) * circle.radius),
      y: roundForHash(circle.center.y + Math.sin(angle) * circle.radius)
    });
  }

  points[0] = clonePoint(input.start);
  points[points.length - 1] = clonePoint(input.end);
  return points;
}

export function convertPolylineToWallSegments(
  points: readonly Point2D[],
  options: {
    wallIdPrefix: string;
    thicknessMm: number;
    kind: DraftWallSegment["kind"];
    source: DraftWallSegment["source"];
  }
): DraftWallSegment[] {
  if (points.length < 2) {
    return [];
  }

  const segments: DraftWallSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (start === undefined || end === undefined || pointsEqual(start, end)) {
      continue;
    }
    segments.push({
      wallId: `${options.wallIdPrefix}-${i + 1}`,
      start: clonePoint(start),
      end: clonePoint(end),
      thicknessMm: options.thicknessMm,
      kind: options.kind,
      source: options.source
    });
  }
  return segments;
}

export function sortGeometryForStableHash(revision: CanonicalFloorplanRevision): unknown {
  return {
    unit: revision.unit,
    walls: normalizeWallSegments(revision.walls).map((wall) => ({
      wallId: wall.wallId,
      start: stablePoint(wall.start),
      end: stablePoint(wall.end),
      thicknessMm: roundForHash(wall.thicknessMm),
      kind: wall.kind
    })),
    openings: [...revision.openings].sort(compareOpenings).map(stableOpening),
    rooms: [...revision.rooms].sort((a, b) => a.roomId.localeCompare(b.roomId)).map(stableRoom),
    globalParams: {
      unit: revision.globalParams.unit,
      scale: {
        source: revision.globalParams.scale.source,
        mmPerPixel: roundForHash(revision.globalParams.scale.mmPerPixel),
        confirmed: revision.globalParams.scale.confirmed
      },
      ...(revision.globalParams.floorHeightMm === undefined
        ? {}
        : { floorHeightMm: roundForHash(revision.globalParams.floorHeightMm) }),
      snapToleranceMm: roundForHash(revision.globalParams.snapToleranceMm),
      wallJoinToleranceMm: roundForHash(revision.globalParams.wallJoinToleranceMm),
      openingSnapToleranceMm: roundForHash(revision.globalParams.openingSnapToleranceMm)
    }
  };
}

export function computeGeometryHash(revision: CanonicalFloorplanRevision): string {
  const normalized = sortGeometryForStableHash(revision);
  const digest = createHash("sha256").update(stableStringify(normalized)).digest("hex");
  return `sha256:${digest}`;
}

export function createCanonicalFloorplanRevision(
  draftInput: FloorplanDraftRevision,
  options: CreateCanonicalFloorplanRevisionInput
): CanonicalFloorplanRevision {
  const draft = FloorplanDraftRevisionSchema.parse(draftInput);
  assertDraftCanConfirm(draft);

  const canonicalWithoutHash = {
    canonicalRevisionId: options.canonicalRevisionId,
    homeId: draft.homeId,
    draftRevisionId: draft.draftRevisionId,
    ...(draft.baseCanonicalRevisionId === undefined
      ? {}
      : { baseCanonicalRevisionId: draft.baseCanonicalRevisionId }),
    version: options.version,
    unit: "mm" as const,
    geometryHash: `sha256:${"0".repeat(64)}`,
    walls: draft.walls.map(stripWallDraftFields),
    openings: draft.openings.map(stripOpeningDraftFields),
    rooms: draft.rooms.map(stripRoomDraftFields),
    globalParams: {
      unit: draft.globalParams.unit,
      displayUnit: draft.globalParams.displayUnit,
      scale: {
        source: "user_confirmed" as const,
        mmPerPixel: draft.globalParams.scale.mmPerPixel,
        confirmed: true as const
      },
      ...(draft.globalParams.gridSizeMm === undefined ? {} : { gridSizeMm: draft.globalParams.gridSizeMm }),
      ...(draft.globalParams.floorHeightMm === undefined
        ? {}
        : { floorHeightMm: draft.globalParams.floorHeightMm }),
      snapToleranceMm: draft.globalParams.snapToleranceMm,
      wallJoinToleranceMm: draft.globalParams.wallJoinToleranceMm,
      openingSnapToleranceMm: draft.globalParams.openingSnapToleranceMm
    },
    validation: {
      status: "valid" as const,
      topologyValid: true as const,
      scaleValid: true as const,
      canConfirm: true as const,
      issues: draft.validation?.issues.filter((issue) => issue.blocksConfirmation === false) ?? [],
      validatedAt: draft.validation?.validatedAt ?? options.confirmedAt
    },
    confirmedByUser: true as const,
    confirmedAt: options.confirmedAt,
    createdAt: options.createdAt ?? options.confirmedAt,
    updatedAt: options.updatedAt ?? options.confirmedAt
  };

  const geometryHash = computeGeometryHash(CanonicalFloorplanRevisionSchema.parse(canonicalWithoutHash));
  const canonical = CanonicalFloorplanRevisionSchema.parse({
    ...canonicalWithoutHash,
    geometryHash
  });

  return deepFreeze(canonical);
}

export function buildWallGraph(segments: readonly WallSegmentInput[]): WallGraph {
  const nodesByKey = new Map<string, WallGraphNode>();
  const edges: WallGraphEdge[] = [];

  const getNode = (point: Point2D): WallGraphNode => {
    const key = pointKey(point);
    const existing = nodesByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const node = { id: `node-${nodesByKey.size + 1}`, point: clonePoint(point) };
    nodesByKey.set(key, node);
    return node;
  };

  deduplicateSegments(splitWallIntersections(segments)).forEach((segment, index) => {
    const from = getNode(segment.start);
    const to = getNode(segment.end);
    if (from.id === to.id) {
      return;
    }
    edges.push({
      id: `edge-${index + 1}`,
      wallId: segment.wallId,
      from: from.id,
      to: to.id,
      start: clonePoint(from.point),
      end: clonePoint(to.point)
    });
  });

  return {
    nodes: [...nodesByKey.values()].sort((a, b) => comparePoint(a.point, b.point)),
    edges
  };
}

export function polygonizeClosedFaces(graph: WallGraph): PolygonFace[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const closedEdges = pruneDanglingEdges(graph.edges);
  const adjacency = new Map<string, string[]>();
  for (const edge of closedEdges) {
    pushAdjacency(adjacency, edge.from, edge.to);
    pushAdjacency(adjacency, edge.to, edge.from);
  }

  for (const [nodeId, neighbors] of adjacency.entries()) {
    const node = nodeById.get(nodeId);
    if (node === undefined) {
      continue;
    }
    neighbors.sort((a, b) => {
      const pointA = nodeById.get(a)?.point;
      const pointB = nodeById.get(b)?.point;
      if (pointA === undefined || pointB === undefined) {
        return 0;
      }
      return angle(node.point, pointA) - angle(node.point, pointB);
    });
  }

  const visited = new Set<string>();
  const faces: PolygonFace[] = [];

  for (const [from, neighbors] of adjacency.entries()) {
    for (const to of neighbors) {
      const startKey = directedKey(from, to);
      if (visited.has(startKey)) {
        continue;
      }

      const polygonNodeIds: string[] = [];
      let currentFrom = from;
      let currentTo = to;
      let guard = 0;

      while (guard < closedEdges.length * 4) {
        guard += 1;
        const currentKey = directedKey(currentFrom, currentTo);
        if (visited.has(currentKey)) {
          break;
        }
        visited.add(currentKey);
        polygonNodeIds.push(currentFrom);

        const nextNeighbors = adjacency.get(currentTo) ?? [];
        const incomingIndex = nextNeighbors.indexOf(currentFrom);
        if (incomingIndex < 0 || nextNeighbors.length === 0) {
          break;
        }
        const nextIndex = (incomingIndex - 1 + nextNeighbors.length) % nextNeighbors.length;
        const nextTo = nextNeighbors[nextIndex];
        if (nextTo === undefined) {
          break;
        }

        currentFrom = currentTo;
        currentTo = nextTo;

        if (currentFrom === from && currentTo === to) {
          const polygon = polygonNodeIds
            .map((nodeId) => nodeById.get(nodeId)?.point)
            .filter((point): point is Point2D => point !== undefined);
          if (polygon.length >= 3) {
            const closed = closePolygon(polygon);
            const area = polygonArea(closed);
            if (area > EPSILON) {
              faces.push({
                faceId: `face-${faces.length + 1}`,
                polygon: closed,
                areaMm2: area
              });
            }
          }
          break;
        }
      }
    }
  }

  return deduplicateFaces(faces);
}

export function filterInvalidFaces(
  faces: readonly PolygonFace[],
  minAreaMm2 = DEFAULT_TINY_FACE_AREA_MM2
): PolygonFace[] {
  return faces.filter((face) => face.areaMm2 >= minAreaMm2 && !hasSelfIntersection(face.polygon));
}

export function detectUnclosedBoundaries(graph: WallGraph): BoundaryIssue[] {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }

  return [...degree.entries()]
    .filter(([, value]) => value < 2)
    .map(([nodeId], index) => ({
      issueId: `unclosed-boundary-${index + 1}`,
      severity: "blocking" as const,
      code: "UNCLOSED_BOUNDARY",
      message: "Wall endpoint does not close into a valid boundary.",
      targetType: "wall" as const,
      targetId: nodeId,
      blocksConfirmation: true
    }));
}

export function matchRoomsByIoU(
  faces: readonly PolygonFace[],
  rooms: readonly DraftRoom[],
  threshold = DEFAULT_IOU_THRESHOLD
): RoomMatch[] {
  const matches: RoomMatch[] = [];
  for (const face of faces) {
    let best: RoomMatch | null = null;
    for (const room of rooms) {
      const iou = bboxIoU(face.polygon, room.polygon);
      if (iou >= threshold && (best === null || iou > best.iou)) {
        best = {
          faceId: face.faceId,
          roomId: room.roomId,
          iou
        };
      }
    }
    if (best !== null) {
      matches.push(best);
    }
  }
  return matches;
}

export function preserveRoomLabels(
  faces: readonly PolygonFace[],
  rooms: readonly DraftRoom[],
  threshold = DEFAULT_IOU_THRESHOLD
): DraftRoom[] {
  const matches = matchRoomsByIoU(faces, rooms, threshold);
  return faces.map((face, index) => {
    const match = matches.find((candidate) => candidate.faceId === face.faceId);
    const existing = match === undefined ? undefined : rooms.find((room) => room.roomId === match.roomId);
    if (existing !== undefined) {
      return {
        ...existing,
        polygon: face.polygon.map(clonePoint),
        source: "boundary_recomputed"
      };
    }

    return {
      roomId: `room-face-${index + 1}`,
      roomType: "living_room",
      polygon: face.polygon.map(clonePoint),
      source: "boundary_recomputed"
    };
  });
}

function assertDraftCanConfirm(draft: FloorplanDraftRevision): void {
  if (draft.unit !== "mm" || draft.globalParams.unit !== "mm") {
    throw new Error("P1 canonical revisions must persist geometry in mm.");
  }
  if (
    draft.validation === undefined ||
    !draft.validation.canConfirm ||
    !draft.validation.topologyValid ||
    !draft.validation.scaleValid
  ) {
    throw new Error("Draft validation state blocks confirmation.");
  }
  if (
    draft.globalParams.scale.source !== "user_confirmed" ||
    !draft.globalParams.scale.confirmed ||
    draft.globalParams.scale.mmPerPixel === undefined
  ) {
    throw new Error("User-confirmed scale is required before canonical revision creation.");
  }
  if (draft.validation.issues.some((issue) => issue.blocksConfirmation)) {
    throw new Error("Blocking draft validation issues must be resolved before confirmation.");
  }
  if (detectOrphanOpenings(draft).length > 0) {
    throw new Error("Openings must be attached to existing walls.");
  }
  for (const room of draft.rooms) {
    if (room.roomType === "balcony") {
      const meta = room.balconyMeta;
      const connected = meta.connectionWallIds.some((wallId) =>
        draft.walls.some((wall) => wall.wallId === wallId)
      );
      const adjacent = meta.adjacentInteriorRoomIds.some((roomId) =>
        draft.rooms.some((candidate) => candidate.roomId === roomId && candidate.roomType !== "balcony")
      );
      if (!connected || !adjacent) {
        throw new Error("Balcony metadata must connect to existing walls and adjacent interior rooms.");
      }
    }
  }
}

function detectOrphanOpenings(draft: FloorplanDraftRevision): DraftOpening[] {
  const wallIds = new Set(draft.walls.map((wall) => wall.wallId));
  return draft.openings.filter((opening) => !wallIds.has(opening.wallId));
}

function stripWallDraftFields(wall: DraftWallSegment): Omit<DraftWallSegment, "source" | "curveApproximation"> {
  return {
    wallId: wall.wallId,
    start: clonePoint(wall.start),
    end: clonePoint(wall.end),
    thicknessMm: wall.thicknessMm,
    kind: wall.kind
  };
}

function stripOpeningDraftFields(opening: DraftOpening):
  | Omit<DraftDoorOpening, "source">
  | Omit<DraftWindowOpening, "source"> {
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
    windowKind: opening.windowKind,
    wallId: opening.wallId,
    positionOnWall: opening.positionOnWall,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    ...(opening.sillHeightMm === undefined ? {} : { sillHeightMm: opening.sillHeightMm }),
    ...(opening.windowKind === "bay" ? { projectionDepthMm: opening.projectionDepthMm } : {}),
    ...(opening.windowKind === "bay" ? { projectionSide: opening.projectionSide } : {})
  };
}

function stripRoomDraftFields(room: DraftRoom): Omit<DraftRoom, "source"> {
  return {
    roomId: room.roomId,
    roomType: room.roomType,
    polygon: room.polygon.map(clonePoint),
    ...(room.labelPosition === undefined ? {} : { labelPosition: clonePoint(room.labelPosition) }),
    ...(room.roomType === "balcony" ? { balconyMeta: cloneBalconyMeta(room.balconyMeta) } : {})
  };
}

function stableOpening(opening: CanonicalFloorplanRevision["openings"][number]): unknown {
  return {
    openingId: opening.openingId,
    type: opening.type,
    wallId: opening.wallId,
    positionOnWall: roundForHash(opening.positionOnWall),
    widthMm: roundForHash(opening.widthMm),
    heightMm: roundForHash(opening.heightMm),
    ...("swing" in opening ? { swing: opening.swing } : {}),
    ...("windowKind" in opening ? { windowKind: opening.windowKind } : {}),
    ...("sillHeightMm" in opening && opening.sillHeightMm !== undefined
      ? { sillHeightMm: roundForHash(opening.sillHeightMm) }
      : {}),
    ...("projectionDepthMm" in opening && opening.projectionDepthMm !== undefined
      ? { projectionDepthMm: roundForHash(opening.projectionDepthMm) }
      : {}),
    ...("projectionSide" in opening && opening.projectionSide !== undefined
      ? { projectionSide: opening.projectionSide }
      : {})
  };
}

function stableRoom(room: CanonicalFloorplanRevision["rooms"][number]): unknown {
  return {
    roomId: room.roomId,
    roomType: room.roomType,
    polygon: room.polygon.map(stablePoint),
    ...(room.labelPosition === undefined ? {} : { labelPosition: stablePoint(room.labelPosition) }),
    ...(room.roomType === "balcony"
      ? {
          balconyMeta: {
            enclosureType: room.balconyMeta.enclosureType,
            isExteriorAttached: room.balconyMeta.isExteriorAttached,
            adjacentInteriorRoomIds: [...room.balconyMeta.adjacentInteriorRoomIds].sort(),
            connectionWallIds: [...room.balconyMeta.connectionWallIds].sort(),
            exteriorEdgeIds: [...room.balconyMeta.exteriorEdgeIds].sort()
          }
        }
      : {})
  };
}

function compareOpenings(
  a: CanonicalFloorplanRevision["openings"][number],
  b: CanonicalFloorplanRevision["openings"][number]
): number {
  return a.openingId.localeCompare(b.openingId);
}

function compareWallSegments<T extends WallSegmentInput>(a: T, b: T): number {
  return (
    comparePoint(a.start, b.start) ||
    comparePoint(a.end, b.end) ||
    a.wallId.localeCompare(b.wallId)
  );
}

function comparePoint(a: Point2D, b: Point2D): number {
  return a.x - b.x || a.y - b.y;
}

function stablePoint(point: Point2D): Point2D {
  return {
    x: roundForHash(point.x),
    y: roundForHash(point.y)
  };
}

function clonePoint(point: Point2D): Point2D {
  return { x: point.x, y: point.y };
}

function cloneBalconyMeta(meta: BalconyMeta): BalconyMeta {
  return {
    enclosureType: meta.enclosureType,
    isExteriorAttached: true,
    adjacentInteriorRoomIds: [...meta.adjacentInteriorRoomIds],
    connectionWallIds: [...meta.connectionWallIds],
    exteriorEdgeIds: [...meta.exteriorEdgeIds]
  };
}

function pointsEqual(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function interpolate(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: roundForHash(a.x + (b.x - a.x) * t),
    y: roundForHash(a.y + (b.y - a.y) * t)
  };
}

function roundForHash(value: number): number {
  return Number(value.toFixed(6));
}

function segmentGeometryKey(segment: WallSegmentInput): string {
  const normalized = normalizeWallSegments([segment])[0];
  if (normalized === undefined) {
    return "";
  }
  return `${pointKey(normalized.start)}:${pointKey(normalized.end)}:${roundForHash(normalized.thicknessMm)}:${normalized.kind}`;
}

function pointKey(point: Point2D): string {
  return `${roundForHash(point.x)},${roundForHash(point.y)}`;
}

function directedKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function getSegmentIntersection(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D
): { point: Point2D; tA: number; tB: number } | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = cross(r, s);
  if (Math.abs(denominator) <= EPSILON) {
    return null;
  }

  const cMinusA = { x: c.x - a.x, y: c.y - a.y };
  const t = cross(cMinusA, s) / denominator;
  const u = cross(cMinusA, r) / denominator;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) {
    return null;
  }

  return {
    point: interpolate(a, b, t),
    tA: t,
    tB: u
  };
}

function cross(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

function circleFromThreePoints(
  a: Point2D,
  b: Point2D,
  c: Point2D
): { center: Point2D; radius: number } | null {
  const determinant =
    2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(determinant) <= EPSILON) {
    return null;
  }

  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;
  const center = {
    x: (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / determinant,
    y: (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / determinant
  };

  return {
    center,
    radius: distance(center, a)
  };
}

function normalizeAngle(value: number): number {
  const twoPi = Math.PI * 2;
  return ((value % twoPi) + twoPi) % twoPi;
}

function angle(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function pushAdjacency(adjacency: Map<string, string[]>, from: string, to: string): void {
  const neighbors = adjacency.get(from) ?? [];
  if (!neighbors.includes(to)) {
    neighbors.push(to);
  }
  adjacency.set(from, neighbors);
}

function pruneDanglingEdges(edges: readonly WallGraphEdge[]): WallGraphEdge[] {
  let active = [...edges];
  let changed = true;

  while (changed) {
    changed = false;
    const degree = new Map<string, number>();
    for (const edge of active) {
      degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
      degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    }

    const next = active.filter((edge) => (degree.get(edge.from) ?? 0) >= 2 && (degree.get(edge.to) ?? 0) >= 2);
    if (next.length !== active.length) {
      changed = true;
      active = next;
    }
  }

  return active;
}

function closePolygon(points: readonly Point2D[]): Point2D[] {
  const closed = points.map(clonePoint);
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first !== undefined && last !== undefined && !pointsEqual(first, last)) {
    closed.push(clonePoint(first));
  }
  return closed;
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
  return sum / 2;
}

function hasSelfIntersection(points: readonly Point2D[]): boolean {
  const closed = closePolygon(points);
  for (let i = 0; i < closed.length - 1; i += 1) {
    const a1 = closed[i];
    const a2 = closed[i + 1];
    if (a1 === undefined || a2 === undefined) {
      continue;
    }
    for (let j = i + 1; j < closed.length - 1; j += 1) {
      const b1 = closed[j];
      const b2 = closed[j + 1];
      if (b1 === undefined || b2 === undefined) {
        continue;
      }
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === closed.length - 2);
      if (adjacent) {
        continue;
      }
      if (getSegmentIntersection(a1, a2, b1, b2) !== null) {
        return true;
      }
    }
  }
  return false;
}

function deduplicateFaces(faces: readonly PolygonFace[]): PolygonFace[] {
  const seen = new Set<string>();
  const result: PolygonFace[] = [];
  for (const face of faces) {
    const key = [...face.polygon.map(pointKey)].sort().join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(face);
  }
  return result;
}

function bboxIoU(a: readonly Point2D[], b: readonly Point2D[]): number {
  const bboxA = computeFloorplanBBox(a);
  const bboxB = computeFloorplanBBox(b);
  const intersectionWidth = Math.max(0, Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX));
  const intersectionHeight = Math.max(0, Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY));
  const intersectionArea = intersectionWidth * intersectionHeight;
  const areaA = bboxA.widthMm * bboxA.heightMm;
  const areaB = bboxB.widthMm * bboxB.heightMm;
  const unionArea = areaA + areaB - intersectionArea;
  return unionArea <= 0 ? 0 : intersectionArea / unionArea;
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}
