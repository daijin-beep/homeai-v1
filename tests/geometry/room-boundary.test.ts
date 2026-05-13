import { describe, expect, it } from "vitest";
import {
  buildWallGraph,
  detectUnclosedBoundaries,
  filterInvalidFaces,
  polygonizeClosedFaces,
  preserveRoomLabels,
  type PolygonFace
} from "@homeai/geometry";

describe("P1 room boundary engine", () => {
  it("polygonizes a rectangle room", () => {
    const faces = validFaces(rectangleWalls());

    expect(faces).toHaveLength(1);
    expect(faces[0]?.areaMm2).toBe(20_000_000);
  });

  it("polygonizes an L-shaped room", () => {
    const faces = validFaces([
      wall("l1", 0, 0, 6000, 0),
      wall("l2", 6000, 0, 6000, 2500),
      wall("l3", 6000, 2500, 3500, 2500),
      wall("l4", 3500, 2500, 3500, 5000),
      wall("l5", 3500, 5000, 0, 5000),
      wall("l6", 0, 5000, 0, 0)
    ]);

    expect(faces).toHaveLength(1);
    expect(faces[0]?.areaMm2).toBe(23_750_000);
  });

  it("reports missing walls as unclosed boundary issues", () => {
    const graph = buildWallGraph(rectangleWalls().slice(0, 3));
    const issues = detectUnclosedBoundaries(graph);

    expect(issues).toHaveLength(2);
    expect(issues.every((issue) => issue.blocksConfirmation)).toBe(true);
  });

  it("does not split a room for an interior partial wall", () => {
    const faces = validFaces([...rectangleWalls(), wall("partial", 2500, 0, 2500, 1200)]);

    expect(faces).toHaveLength(1);
    expect(faces[0]?.areaMm2).toBe(20_000_000);
  });

  it("preserves room labels by IoU", () => {
    const faces = validFaces(rectangleWalls());
    const rooms = preserveRoomLabels(faces, [
      {
        roomId: "room-existing-living",
        roomType: "living_room",
        polygon: [
          { x: 100, y: 100 },
          { x: 4900, y: 100 },
          { x: 4900, y: 3900 },
          { x: 100, y: 3900 },
          { x: 100, y: 100 }
        ],
        source: "fixture"
      }
    ]);

    expect(rooms[0]?.roomId).toBe("room-existing-living");
    expect(rooms[0]?.roomType).toBe("living_room");
    expect(rooms[0]?.source).toBe("boundary_recomputed");
  });

  it("filters self-intersecting polygon faces", () => {
    const bowtie: PolygonFace = {
      faceId: "bowtie",
      polygon: [
        { x: 0, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
        { x: 1000, y: 0 },
        { x: 0, y: 0 }
      ],
      areaMm2: 1_000_000
    };

    expect(filterInvalidFaces([bowtie], 1)).toEqual([]);
  });

  it("filters tiny polygon faces", () => {
    const tiny: PolygonFace = {
      faceId: "tiny",
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: 0 }
      ],
      areaMm2: 10_000
    };

    expect(filterInvalidFaces([tiny], 500_000)).toEqual([]);
  });
});

function validFaces(segments: ReturnType<typeof wall>[]) {
  return filterInvalidFaces(polygonizeClosedFaces(buildWallGraph(segments)), 1);
}

function rectangleWalls() {
  return [
    wall("north", 0, 0, 5000, 0),
    wall("east", 5000, 0, 5000, 4000),
    wall("south", 5000, 4000, 0, 4000),
    wall("west", 0, 4000, 0, 0)
  ];
}

function wall(wallId: string, x1: number, y1: number, x2: number, y2: number) {
  return {
    wallId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thicknessMm: 120,
    kind: "interior" as const,
    source: "fixture" as const
  };
}
