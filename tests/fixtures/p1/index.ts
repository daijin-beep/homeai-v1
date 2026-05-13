import type { FloorplanDraftRevision } from "@homeai/contracts";

export const p1FixtureTimestamp = "2026-05-13T00:00:00.000Z";

const globalParams = {
  unit: "mm" as const,
  displayUnit: "cm" as const,
  scale: {
    source: "user_confirmed" as const,
    mmPerPixel: 20,
    confirmed: true
  },
  gridSizeMm: 100,
  snapToleranceMm: 100,
  wallJoinToleranceMm: 100,
  openingSnapToleranceMm: 80
};

const validValidation = {
  status: "valid" as const,
  topologyValid: true,
  scaleValid: true,
  canConfirm: true,
  issues: [],
  validatedAt: p1FixtureTimestamp
};

const invalidValidation = (code: string, message: string) => ({
  status: "invalid" as const,
  topologyValid: false,
  scaleValid: true,
  canConfirm: false,
  issues: [
    {
      issueId: `issue-${code.toLowerCase()}`,
      severity: "blocking" as const,
      code,
      message,
      targetType: "draft" as const,
      blocksConfirmation: true
    }
  ],
  validatedAt: p1FixtureTimestamp
});

function operation(operationId: string) {
  return {
    operationId,
    operationType: "validate_draft" as const,
    targetType: "draft" as const,
    actor: "system" as const,
    createdAt: p1FixtureTimestamp
  };
}

export const simpleRectangleHome: FloorplanDraftRevision = {
  draftRevisionId: "draft-simple-rectangle-home",
  homeId: "home-simple-rectangle",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-simple-north", 0, 0, 5000, 0, "exterior"),
    wall("wall-simple-east", 5000, 0, 5000, 4000, "exterior"),
    wall("wall-simple-south", 5000, 4000, 0, 4000, "exterior"),
    wall("wall-simple-west", 0, 4000, 0, 0, "exterior")
  ],
  openings: [door("door-simple-entry", "wall-simple-south", 0.5)],
  rooms: [
    {
      roomId: "room-simple-living",
      roomType: "living_room",
      polygon: rect(0, 0, 5000, 4000),
      labelPosition: { x: 2500, y: 2000 },
      source: "fixture"
    }
  ],
  globalParams,
  operationLog: [operation("operation-simple-valid")],
  validation: validValidation,
  createdAt: p1FixtureTimestamp,
  updatedAt: p1FixtureTimestamp
};

export const lShapedHome: FloorplanDraftRevision = {
  draftRevisionId: "draft-l-shaped-home",
  homeId: "home-l-shaped",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-l-1", 0, 0, 6000, 0, "exterior"),
    wall("wall-l-2", 6000, 0, 6000, 2500, "exterior"),
    wall("wall-l-3", 6000, 2500, 3500, 2500, "exterior"),
    wall("wall-l-4", 3500, 2500, 3500, 5000, "exterior"),
    wall("wall-l-5", 3500, 5000, 0, 5000, "exterior"),
    wall("wall-l-6", 0, 5000, 0, 0, "exterior")
  ],
  openings: [],
  rooms: [
    {
      roomId: "room-l-living",
      roomType: "living_room",
      polygon: [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 2500 },
        { x: 3500, y: 2500 },
        { x: 3500, y: 5000 },
        { x: 0, y: 5000 },
        { x: 0, y: 0 }
      ],
      labelPosition: { x: 2400, y: 2300 },
      source: "fixture"
    }
  ],
  globalParams,
  operationLog: [operation("operation-l-valid")],
  validation: validValidation,
  createdAt: p1FixtureTimestamp,
  updatedAt: p1FixtureTimestamp
};

export const homeWithBalcony: FloorplanDraftRevision = {
  draftRevisionId: "draft-home-with-balcony",
  homeId: "home-with-balcony",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-bal-main-north", 0, 0, 5200, 0, "exterior"),
    wall("wall-bal-main-east", 5200, 0, 5200, 4000, "exterior"),
    wall("wall-bal-main-south", 5200, 4000, 0, 4000, "exterior"),
    wall("wall-bal-main-west", 0, 4000, 0, 0, "exterior"),
    wall("wall-bal-ext-north", 0, -1400, 5200, -1400, "exterior"),
    wall("wall-bal-ext-west", 0, 0, 0, -1400, "exterior"),
    wall("wall-bal-ext-east", 5200, -1400, 5200, 0, "exterior")
  ],
  openings: [windowOpening("window-balcony-connection", "wall-bal-main-north", 0.5)],
  rooms: [
    {
      roomId: "room-bal-living",
      roomType: "living_room",
      polygon: rect(0, 0, 5200, 4000),
      labelPosition: { x: 2600, y: 2000 },
      source: "fixture"
    },
    {
      roomId: "room-bal-balcony",
      roomType: "balcony",
      polygon: rect(0, -1400, 5200, 0),
      source: "fixture",
      balconyMeta: {
        enclosureType: "closed",
        isExteriorAttached: true,
        adjacentInteriorRoomIds: ["room-bal-living"],
        connectionWallIds: ["wall-bal-main-north"],
        exteriorEdgeIds: ["wall-bal-ext-north", "wall-bal-ext-west", "wall-bal-ext-east"]
      }
    }
  ],
  globalParams,
  operationLog: [operation("operation-bal-valid")],
  validation: validValidation,
  createdAt: p1FixtureTimestamp,
  updatedAt: p1FixtureTimestamp
};

export const homeWithBayWindow: FloorplanDraftRevision = {
  draftRevisionId: "draft-home-with-bay-window",
  homeId: "home-with-bay-window",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-bay-north", 0, 0, 5400, 0, "exterior"),
    wall("wall-bay-east", 5400, 0, 5400, 3800, "exterior"),
    wall("wall-bay-south", 5400, 3800, 0, 3800, "exterior"),
    wall("wall-bay-west", 0, 3800, 0, 0, "exterior")
  ],
  openings: [
    {
      openingId: "window-bay-1",
      type: "window",
      windowKind: "bay",
      wallId: "wall-bay-north",
      positionOnWall: 0.45,
      widthMm: 1800,
      heightMm: 1400,
      sillHeightMm: 450,
      projectionDepthMm: 600,
      projectionSide: "exterior",
      source: "fixture"
    }
  ],
  rooms: [
    {
      roomId: "room-bay-living",
      roomType: "living_room",
      polygon: rect(0, 0, 5400, 3800),
      labelPosition: { x: 2700, y: 1900 },
      source: "fixture"
    }
  ],
  globalParams,
  operationLog: [operation("operation-bay-valid")],
  validation: validValidation,
  createdAt: p1FixtureTimestamp,
  updatedAt: p1FixtureTimestamp
};

export const nonAxisAlignedWallHome: FloorplanDraftRevision = {
  draftRevisionId: "draft-non-axis-aligned-wall-home",
  homeId: "home-non-axis-aligned",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-diag-1", 0, 0, 4500, 0, "exterior"),
    wall("wall-diag-2", 4500, 0, 5200, 3200, "exterior"),
    wall("wall-diag-3", 5200, 3200, 0, 3200, "exterior"),
    wall("wall-diag-4", 0, 3200, 0, 0, "exterior")
  ],
  openings: [],
  rooms: [
    {
      roomId: "room-diag-living",
      roomType: "living_room",
      polygon: [
        { x: 0, y: 0 },
        { x: 4500, y: 0 },
        { x: 5200, y: 3200 },
        { x: 0, y: 3200 },
        { x: 0, y: 0 }
      ],
      labelPosition: { x: 2500, y: 1600 },
      source: "fixture"
    }
  ],
  globalParams,
  operationLog: [operation("operation-diag-valid")],
  validation: validValidation,
  createdAt: p1FixtureTimestamp,
  updatedAt: p1FixtureTimestamp
};

export const invalidUnclosedRoom: FloorplanDraftRevision = {
  ...simpleRectangleHome,
  draftRevisionId: "draft-invalid-unclosed-room",
  homeId: "home-invalid-unclosed",
  walls: simpleRectangleHome.walls.slice(0, 3),
  operationLog: [operation("operation-invalid-unclosed")],
  validation: invalidValidation("UNCLOSED_BOUNDARY", "Room boundary is missing a closing wall.")
};

export const invalidOrphanOpening: FloorplanDraftRevision = {
  ...simpleRectangleHome,
  draftRevisionId: "draft-invalid-orphan-opening",
  homeId: "home-invalid-orphan-opening",
  openings: [door("door-orphan", "wall-does-not-exist", 0.5)],
  operationLog: [operation("operation-invalid-orphan")],
  validation: validValidation
};

export const invalidDetachedBalcony: FloorplanDraftRevision = {
  ...homeWithBalcony,
  draftRevisionId: "draft-invalid-detached-balcony",
  homeId: "home-invalid-detached-balcony",
  rooms: homeWithBalcony.rooms.map((room) =>
    room.roomType === "balcony"
      ? {
          ...room,
          balconyMeta: {
            ...room.balconyMeta,
            adjacentInteriorRoomIds: ["room-missing"],
            connectionWallIds: ["wall-missing"]
          }
        }
      : room
  ),
  operationLog: [operation("operation-invalid-detached-balcony")],
  validation: validValidation
};

export const validP1DraftFixtures = {
  simple_rectangle_home: simpleRectangleHome,
  l_shaped_home: lShapedHome,
  home_with_balcony: homeWithBalcony,
  home_with_bay_window: homeWithBayWindow,
  non_axis_aligned_wall_home: nonAxisAlignedWallHome
} as const;

export const invalidP1DraftFixtures = {
  invalid_unclosed_room: invalidUnclosedRoom,
  invalid_orphan_opening: invalidOrphanOpening,
  invalid_detached_balcony: invalidDetachedBalcony
} as const;

function wall(
  wallId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  kind: "interior" | "exterior" | "unknown"
) {
  return {
    wallId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thicknessMm: kind === "interior" ? 120 : 200,
    kind,
    source: "fixture" as const
  };
}

function door(openingId: string, wallId: string, positionOnWall: number) {
  return {
    openingId,
    type: "door" as const,
    wallId,
    positionOnWall,
    widthMm: 900,
    heightMm: 2100,
    swing: "left_in" as const,
    source: "fixture" as const
  };
}

function windowOpening(openingId: string, wallId: string, positionOnWall: number) {
  return {
    openingId,
    type: "window" as const,
    windowKind: "standard" as const,
    wallId,
    positionOnWall,
    widthMm: 1800,
    heightMm: 1300,
    sillHeightMm: 900,
    source: "fixture" as const
  };
}

function rect(minX: number, minY: number, maxX: number, maxY: number) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY }
  ];
}
