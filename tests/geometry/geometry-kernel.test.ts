import { describe, expect, it } from "vitest";
import {
  computeFloorplanBBox,
  computeSegmentLength,
  convertArcToPolyline,
  convertPolylineToWallSegments,
  createCanonicalFloorplanRevision,
  deduplicateSegments,
  normalizeWallSegments,
  snapWallEndpoints,
  sortGeometryForStableHash,
  splitWallIntersections
} from "@homeai/geometry";
import { simpleRectangleHome, p1FixtureTimestamp } from "../fixtures/p1/index.js";

describe("P1 geometry kernel", () => {
  it("snaps endpoints within default tolerance", () => {
    const snapped = snapWallEndpoints([
      segment("a", 0, 0, 1000, 0),
      segment("b", 1050, 0, 2000, 0)
    ]);

    expect(snapped[0]?.end).toEqual(snapped[1]?.start);
  });

  it("does not snap endpoints outside tolerance", () => {
    const snapped = snapWallEndpoints([
      segment("a", 0, 0, 1000, 0),
      segment("b", 1200, 0, 2000, 0)
    ]);

    expect(snapped[0]?.end).not.toEqual(snapped[1]?.start);
  });

  it("splits crossing wall intersections", () => {
    const split = splitWallIntersections([
      segment("horizontal", 0, 0, 1000, 0),
      segment("vertical", 500, -500, 500, 500)
    ]);

    expect(split).toHaveLength(4);
    expect(split.some((wall) => wall.start.x === 500 && wall.start.y === 0)).toBe(true);
    expect(split.some((wall) => wall.end.x === 500 && wall.end.y === 0)).toBe(true);
  });

  it("removes duplicate reversed segments", () => {
    const deduped = deduplicateSegments([
      segment("a", 0, 0, 1000, 0),
      segment("b", 1000, 0, 0, 0)
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("preserves non-axis-aligned wall geometry", () => {
    const diagonal = normalizeWallSegments([segment("diagonal", 0, 0, 300, 400)])[0];

    expect(diagonal?.start).toEqual({ x: 0, y: 0 });
    expect(diagonal?.end).toEqual({ x: 300, y: 400 });
    expect(computeSegmentLength(diagonal!)).toBe(500);
  });

  it("converts arc input into polyline segments before persistence", () => {
    const points = convertArcToPolyline({
      start: { x: 0, y: 0 },
      control: { x: 500, y: -500 },
      end: { x: 1000, y: 0 },
      maxChordErrorMm: 50
    });
    const walls = convertPolylineToWallSegments(points, {
      wallIdPrefix: "arc-wall",
      thicknessMm: 120,
      kind: "interior",
      source: "user_created"
    });

    expect(points.length).toBeGreaterThan(2);
    expect(walls).toHaveLength(points.length - 1);
    expect(walls.every((wall) => wall.curveApproximation === undefined)).toBe(true);
  });

  it("sorts geometry deterministically for stable hashes", () => {
    const canonicalA = createCanonicalFloorplanRevision(simpleRectangleHome, {
      canonicalRevisionId: "canonical-sort-a",
      version: 1,
      confirmedAt: p1FixtureTimestamp
    });
    const reversedDraft = {
      ...simpleRectangleHome,
      draftRevisionId: "draft-reversed-order",
      walls: [...simpleRectangleHome.walls].reverse(),
      rooms: [...simpleRectangleHome.rooms].reverse(),
      openings: [...simpleRectangleHome.openings].reverse()
    };
    const canonicalB = createCanonicalFloorplanRevision(reversedDraft, {
      canonicalRevisionId: "canonical-sort-b",
      version: 1,
      confirmedAt: p1FixtureTimestamp
    });

    expect(sortGeometryForStableHash(canonicalA)).toEqual(sortGeometryForStableHash(canonicalB));
    expect(canonicalA.geometryHash).toBe(canonicalB.geometryHash);
  });

  it("calculates stable floorplan bbox", () => {
    expect(computeFloorplanBBox(simpleRectangleHome.walls)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 5000,
      maxY: 4000,
      widthMm: 5000,
      heightMm: 4000
    });
  });
});

function segment(wallId: string, x1: number, y1: number, x2: number, y2: number) {
  return {
    wallId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thicknessMm: 120,
    kind: "interior" as const,
    source: "fixture" as const
  };
}
