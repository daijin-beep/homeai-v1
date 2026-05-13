import type { DraftRoom, DraftWallSegment, FloorplanDraftRevision, Point2D } from "@homeai/contracts";

export type ViewTransform = {
  scale: number;
  panX: number;
  panY: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type FloorplanViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type FloorplanBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
};

export const DEFAULT_VIEW_TRANSFORM: ViewTransform = {
  scale: 1,
  panX: 0,
  panY: 0
};

export function worldMmToScreenPx(point: Point2D, transform: ViewTransform): ScreenPoint {
  return {
    x: point.x * transform.scale + transform.panX,
    y: point.y * transform.scale + transform.panY
  };
}

export function screenPxToWorldMm(point: ScreenPoint, transform: ViewTransform): Point2D {
  return {
    x: (point.x - transform.panX) / transform.scale,
    y: (point.y - transform.panY) / transform.scale
  };
}

export function applyZoom(transform: ViewTransform, zoomFactor: number): ViewTransform {
  return {
    ...transform,
    scale: clamp(transform.scale * zoomFactor, 0.25, 6)
  };
}

export function applyPan(transform: ViewTransform, delta: ScreenPoint): ViewTransform {
  return {
    ...transform,
    panX: transform.panX + delta.x,
    panY: transform.panY + delta.y
  };
}

export function computeFloorplanBBox(draft: Pick<FloorplanDraftRevision, "walls" | "rooms">): FloorplanBBox {
  const points = [
    ...draft.walls.flatMap((wall) => [wall.start, wall.end]),
    ...draft.rooms.flatMap((room) => room.polygon)
  ];
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1000,
      maxY: 1000,
      widthMm: 1000,
      heightMm: 1000
    };
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
    widthMm: Math.max(1, maxX - minX),
    heightMm: Math.max(1, maxY - minY)
  };
}

export function computeViewBoxFromFloorplanBBox(
  bbox: FloorplanBBox,
  transform: ViewTransform = DEFAULT_VIEW_TRANSFORM,
  paddingMm = 800
): FloorplanViewBox {
  const baseWidth = bbox.widthMm + paddingMm * 2;
  const baseHeight = bbox.heightMm + paddingMm * 2;
  const width = baseWidth / transform.scale;
  const height = baseHeight / transform.scale;
  return {
    minX: bbox.minX - paddingMm - transform.panX / transform.scale + (baseWidth - width) / 2,
    minY: bbox.minY - paddingMm - transform.panY / transform.scale + (baseHeight - height) / 2,
    width,
    height
  };
}

export function svgClientPointToWorldMm(
  clientPoint: ScreenPoint,
  svgRect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  viewBox: FloorplanViewBox
): Point2D {
  return {
    x: viewBox.minX + ((clientPoint.x - svgRect.left) / svgRect.width) * viewBox.width,
    y: viewBox.minY + ((clientPoint.y - svgRect.top) / svgRect.height) * viewBox.height
  };
}

export function formatMmAsCm(valueMm: number): string {
  return (valueMm / 10).toFixed(1).replace(/\.0$/, "");
}

export function parseCmToMm(valueCm: string): number {
  const normalized = Number(valueCm.trim().replace(",", "."));
  if (!Number.isFinite(normalized)) {
    throw new Error("Invalid centimeter value.");
  }
  return Math.round(normalized * 10);
}

export function computeSegmentLengthMm(wall: Pick<DraftWallSegment, "start" | "end">): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function resizeWallToLengthMm(wall: DraftWallSegment, lengthMm: number): DraftWallSegment {
  const currentLength = computeSegmentLengthMm(wall);
  if (currentLength <= 0 || lengthMm <= 0) {
    return wall;
  }
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  return {
    ...wall,
    end: {
      x: Math.round(wall.start.x + (dx / currentLength) * lengthMm),
      y: Math.round(wall.start.y + (dy / currentLength) * lengthMm)
    }
  };
}

export function constrainToOrthogonal(start: Point2D, point: Point2D): Point2D {
  const dx = Math.abs(point.x - start.x);
  const dy = Math.abs(point.y - start.y);
  return dx >= dy ? { x: point.x, y: start.y } : { x: start.x, y: point.y };
}

export function snapPoint(point: Point2D, gridSizeMm = 100): Point2D {
  return {
    x: Math.round(point.x / gridSizeMm) * gridSizeMm,
    y: Math.round(point.y / gridSizeMm) * gridSizeMm
  };
}

export function pointOnWallAt(wall: Pick<DraftWallSegment, "start" | "end">, positionOnWall: number): Point2D {
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * positionOnWall,
    y: wall.start.y + (wall.end.y - wall.start.y) * positionOnWall
  };
}

export function roomCentroid(room: DraftRoom): Point2D {
  const openPoints = room.polygon.slice(0, -1);
  if (openPoints.length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: openPoints.reduce((sum, point) => sum + point.x, 0) / openPoints.length,
    y: openPoints.reduce((sum, point) => sum + point.y, 0) / openPoints.length
  };
}

export function pointInPolygon(point: Point2D, polygon: readonly Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    if (current === undefined || previous === undefined) {
      continue;
    }
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
