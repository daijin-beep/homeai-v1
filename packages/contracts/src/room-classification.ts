import type { Point2D } from "./common.js";
import type { RoomType } from "./floorplan.js";

export const ROOM_CLASSIFICATION = {
  knownRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony",
    "corridor",
    "storage"
  ],
  mainRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom"
  ],
  renderableRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony",
    "corridor",
    "storage"
  ],
  softDecorTargetRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony"
  ],
  nonPrimarySoftDecorTypes: ["corridor", "storage"],
  userLabelRequiredTypes: ["unknown"]
} as const;

export const ROOM_AREA_THRESHOLDS: Record<RoomType, number> = {
  living: 4_000_000,
  dining: 3_000_000,
  living_dining: 5_000_000,
  bedroom: 4_000_000,
  master_bedroom: 6_000_000,
  children_room: 4_000_000,
  study: 3_000_000,
  kitchen: 2_000_000,
  bathroom: 1_500_000,
  entry: 800_000,
  balcony: 1_000_000,
  corridor: 600_000,
  storage: 500_000,
  unknown: 1_000_000
} as const;

export type RoomEligibilityInput = {
  type: RoomType;
  polygon: readonly Point2D[];
  areaMm2: number;
  userConfirmed: boolean;
};

export type RoomEligibility = {
  isSpatiallyValid: boolean;
  isRenderable: boolean;
  isSoftDecorTarget: boolean;
  isMainRoom: boolean;
  reason: string | null;
};

export function getRoomEligibility(room: RoomEligibilityInput): RoomEligibility {
  const spatialReason = getSpatialInvalidReason(room);
  const isSpatiallyValid = spatialReason === null;
  const needsUserLabel = room.type === "unknown" && !room.userConfirmed;
  const isRenderableType = includesRoomType(ROOM_CLASSIFICATION.renderableRoomTypes, room.type);
  const isRenderable = isSpatiallyValid && isRenderableType && !needsUserLabel;
  const isSoftDecorTarget =
    isSpatiallyValid &&
    includesRoomType(ROOM_CLASSIFICATION.softDecorTargetRoomTypes, room.type) &&
    !needsUserLabel;
  const isMainRoom =
    isSpatiallyValid && includesRoomType(ROOM_CLASSIFICATION.mainRoomTypes, room.type) && !needsUserLabel;

  let reason = spatialReason;
  if (reason === null && needsUserLabel) {
    reason = "unknown_room_type_requires_user_label";
  } else if (reason === null && !isRenderableType) {
    reason = "room_type_not_renderable";
  }

  return {
    isSpatiallyValid,
    isRenderable,
    isSoftDecorTarget,
    isMainRoom,
    reason
  };
}

function getSpatialInvalidReason(room: RoomEligibilityInput): string | null {
  if (!isClosedPolygon(room.polygon)) {
    return "room_polygon_not_closed";
  }

  if (hasSelfIntersection(room.polygon)) {
    return "room_polygon_self_intersects";
  }

  if (room.areaMm2 < ROOM_AREA_THRESHOLDS[room.type]) {
    return "room_area_below_minimum_threshold";
  }

  return null;
}

function includesRoomType(values: readonly string[], value: RoomType): boolean {
  return values.includes(value);
}

function isClosedPolygon(points: readonly Point2D[]): boolean {
  if (points.length < 4) {
    return false;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return false;
  }

  return pointsEqual(first, last);
}

function hasSelfIntersection(points: readonly Point2D[]): boolean {
  if (!isClosedPolygon(points)) {
    return false;
  }

  const segmentCount = points.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const a1 = points[i];
    const a2 = points[i + 1];
    if (a1 === undefined || a2 === undefined) {
      continue;
    }

    for (let j = i + 1; j < segmentCount; j += 1) {
      const b1 = points[j];
      const b2 = points[j + 1];
      if (b1 === undefined || b2 === undefined) {
        continue;
      }

      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === segmentCount - 1);
      if (adjacent) {
        continue;
      }

      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

function pointsEqual(a: Point2D, b: Point2D): boolean {
  return a.x === b.x && a.y === b.y;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  return (
    (o1 === 0 && onSegment(a, c, b)) ||
    (o2 === 0 && onSegment(a, d, b)) ||
    (o3 === 0 && onSegment(c, a, d)) ||
    (o4 === 0 && onSegment(c, b, d))
  );
}

function orientation(a: Point2D, b: Point2D, c: Point2D): -1 | 0 | 1 {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

function onSegment(a: Point2D, b: Point2D, c: Point2D): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}
