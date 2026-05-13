import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CanonicalFloorplanSchema,
  DesignBriefSchema,
  DraftFloorplanSchema,
  ERROR_DEFINITIONS,
  ErrorDefinitionSchema,
  FileAssetSchema,
  FloorplanDraftRevisionSchema,
  GeometryDependentArtifactSchema,
  LeadEventSchema,
  ParseJobSchema,
  CanonicalFloorplanRevisionSchema,
  ProductCandidateSchema,
  ProjectSchema,
  P1DraftRoomSchema,
  P1DraftWindowOpeningSchema,
  REQUIRED_ERROR_CODES,
  ROOM_CLASSIFICATION,
  ROOM_AREA_THRESHOLDS,
  RenderImageAssetSchema,
  RenderImageSpecSchema,
  RoomCameraPlanSchema,
  SceneContractSchema,
  SoftDecorGPSPlanSchema,
  SPACE_TRUTH_THRESHOLDS,
  getRoomEligibility
} from "@homeai/contracts";

const timestamp = "2026-05-04T00:00:00.000Z";
const fixtureRoot = join(process.cwd(), "tests", "fixtures", "floorplans");
const validFixtureNames = [
  "one-bedroom",
  "two-bedroom",
  "three-bedroom-balcony",
  "low-confidence-boundaries"
];

function readFixture(name: string, file: string): unknown {
  return JSON.parse(readFileSync(join(fixtureRoot, name, file), "utf8"));
}

const productCandidate = {
  id: "product-sofa-1",
  provider: "mock_sku",
  category: "sofa",
  title: "Mock Compact Sofa",
  imageUrl: "provider://mock-sku/images/product-sofa-1.svg",
  leadUrl: "provider://mock-affiliate/track-product-sofa-1",
  price: {
    amount: 1299,
    currency: "USD",
    budgetBand: "mid"
  },
  size: {
    widthMm: 1800,
    depthMm: 850,
    heightMm: 760
  },
  fit: {
    roomId: "room-one-living-dining",
    fitScore: 0.92,
    styleScore: 0.9,
    sizeScore: 0.94,
    budgetScore: 0.88,
    warnings: []
  }
};

const geometryHash = `sha256:${"a".repeat(64)}`;

const p1GlobalParams = {
  unit: "mm",
  displayUnit: "cm",
  scale: {
    source: "ai_parse",
    mmPerPixel: 20,
    confirmed: false
  },
  gridSizeMm: 100,
  snapToleranceMm: 50,
  wallJoinToleranceMm: 80,
  openingSnapToleranceMm: 60
};

const p1ValidationReady = {
  status: "valid",
  topologyValid: true,
  scaleValid: true,
  canConfirm: true,
  issues: [],
  validatedAt: timestamp
};

const p1WallSegment = {
  wallId: "p1-wall-north",
  start: { x: 0, y: 0 },
  end: { x: 5200, y: 0 },
  thicknessMm: 200,
  kind: "exterior",
  source: "ai_parse"
};

const p1BayWindow = {
  openingId: "p1-window-bay",
  type: "window",
  windowKind: "bay",
  wallId: "p1-wall-north",
  positionOnWall: 0.42,
  widthMm: 1800,
  heightMm: 1400,
  sillHeightMm: 450,
  projectionDepthMm: 600,
  projectionSide: "exterior",
  source: "ai_parse"
};

const p1LivingRoom = {
  roomId: "p1-room-living",
  roomType: "living_room",
  polygon: [
    { x: 0, y: 0 },
    { x: 5200, y: 0 },
    { x: 5200, y: 4200 },
    { x: 0, y: 4200 },
    { x: 0, y: 0 }
  ],
  labelPosition: { x: 2600, y: 2100 },
  source: "ai_parse"
};

const p1BalconyRoom = {
  roomId: "p1-room-balcony",
  roomType: "balcony",
  polygon: [
    { x: 0, y: -1500 },
    { x: 5200, y: -1500 },
    { x: 5200, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: -1500 }
  ],
  source: "ai_parse",
  balconyMeta: {
    enclosureType: "closed",
    isExteriorAttached: true,
    adjacentInteriorRoomIds: ["p1-room-living"],
    connectionWallIds: ["p1-wall-north"],
    exteriorEdgeIds: ["p1-balcony-edge-exterior"]
  }
};

const p1DraftRevision = {
  draftRevisionId: "p1-draft-1",
  homeId: "home-1",
  sourceAssetId: "asset-floorplan-1",
  source: "ai_parse",
  unit: "mm",
  walls: [p1WallSegment],
  openings: [p1BayWindow],
  rooms: [p1LivingRoom, p1BalconyRoom],
  globalParams: p1GlobalParams,
  operationLog: [
    {
      operationId: "operation-1",
      operationType: "validate_draft",
      targetType: "draft",
      actor: "system",
      createdAt: timestamp
    }
  ],
  validation: {
    status: "warning",
    topologyValid: true,
    scaleValid: false,
    canConfirm: false,
    issues: [
      {
        issueId: "issue-scale-unconfirmed",
        severity: "warning",
        code: "SCALE_UNCONFIRMED",
        message: "Scale still needs user confirmation.",
        targetType: "global_params",
        blocksConfirmation: true
      }
    ],
    validatedAt: timestamp
  },
  createdAt: timestamp,
  updatedAt: timestamp
};

describe("core entity schemas", () => {
  it("Project schema validates valid payload", () => {
    expect(
      ProjectSchema.safeParse({
        id: "project-1",
        ownerId: "owner-1",
        name: "Fixture Home",
        status: "created",
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("FileAsset schema validates valid payload", () => {
    expect(
      FileAssetSchema.safeParse({
        id: "asset-1",
        projectId: "project-1",
        kind: "floorplan_image",
        mimeType: "image/png",
        storageUrl: "file://fixtures/floorplan.png",
        sizeBytes: 4096,
        checksum: "sha256-mock",
        createdAt: timestamp
      }).success
    ).toBe(true);
  });

  it("ParseJob schema validates valid payload", () => {
    expect(
      ParseJobSchema.safeParse({
        id: "parse-1",
        projectId: "project-1",
        fileAssetId: "asset-1",
        provider: "mock_floorplan",
        status: "queued",
        progress: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("SceneContract schema validates valid payload", () => {
    expect(
      SceneContractSchema.safeParse({
        id: "scene-1",
        projectId: "project-1",
        floorplanId: "canonical-one-bedroom",
        version: 1,
        coordinateSystem: {
          origin: "floorplan_top_left",
          xAxis: "right",
          yAxis: "down",
          zAxis: "up"
        },
        unit: "mm",
        rooms: [
          {
            id: "scene-room-1",
            canonicalRoomId: "room-one-living-dining",
            type: "living_dining",
            label: "Living Dining",
            polygon: [
              { x: 0, y: 0 },
              { x: 5200, y: 0 },
              { x: 5200, y: 4200 },
              { x: 0, y: 4200 },
              { x: 0, y: 0 }
            ],
            floorElevationMm: 0,
            ceilingHeightMm: 2800
          }
        ],
        walls: [
          {
            id: "scene-wall-1",
            canonicalWallId: "wall-one-outer-north",
            start: { x: 0, y: 0 },
            end: { x: 5200, y: 0 },
            thicknessMm: 200,
            heightMm: 2800
          }
        ],
        openings: [
          {
            id: "scene-opening-1",
            canonicalOpeningId: "opening-one-window-living",
            type: "window",
            wallId: "scene-wall-1",
            start: { x: 1400, y: 0 },
            end: { x: 3200, y: 0 },
            widthMm: 1800,
            heightMm: 1300
          }
        ],
        constraints: {
          immutableGeometry: true,
          noNewWindows: true,
          noNewDoorsWithoutUserApproval: true,
          noWallDeletionWithoutUserApproval: true,
          renderingCannotMutateGeometry: true
        },
        validation: {
          status: "valid",
          spaceTruthScore: 0.88,
          warnings: [],
          errors: []
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("RoomCameraPlan schema validates valid payload", () => {
    expect(
      RoomCameraPlanSchema.safeParse({
        id: "camera-plan-1",
        projectId: "project-1",
        sceneContractId: "scene-1",
        roomId: "room-one-living-dining",
        version: 1,
        minImageCount: 2,
        cameras: [
          {
            id: "camera-1",
            roomId: "room-one-living-dining",
            viewType: "overview",
            position: { x: 2600, y: 2100, z: 1600 },
            target: { x: 2600, y: 2100, z: 1200 },
            fovDegrees: 65,
            lensMm: 24,
            valid: true,
            validationWarnings: []
          }
        ],
        validation: {
          status: "valid",
          errors: [],
          warnings: []
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("DesignBrief schema validates valid payload", () => {
    expect(
      DesignBriefSchema.safeParse({
        id: "brief-1",
        projectId: "project-1",
        source: "user_text",
        styleProfile: {
          id: "style-1",
          projectId: "project-1",
          version: 1,
          name: "Warm Minimal",
          styleKeywords: ["warm", "minimal"],
          colorPreferences: ["oak", "white"],
          avoidItems: ["glossy black"],
          budgetBand: "mid",
          createdAt: timestamp,
          updatedAt: timestamp
        },
        functionalPreferences: ["kid friendly", "easy cleaning"],
        clarificationNeeded: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });
});

describe("P1 floorplan adjustment contracts", () => {
  it("FloorplanDraftRevision schema validates mm segment-based draft state", () => {
    const parsed = FloorplanDraftRevisionSchema.parse(p1DraftRevision);

    expect(parsed.unit).toBe("mm");
    expect(parsed.globalParams.displayUnit).toBe("cm");
    expect(parsed.openings[0]?.type).toBe("window");
    expect(parsed.rooms.some((room) => room.roomType === "balcony")).toBe(true);
  });

  it("P1 draft schemas reject non-mm truth and persisted canvas coordinates", () => {
    expect(
      FloorplanDraftRevisionSchema.safeParse({
        ...p1DraftRevision,
        unit: "cm"
      }).success
    ).toBe(false);

    expect(
      FloorplanDraftRevisionSchema.safeParse({
        ...p1DraftRevision,
        walls: [
          {
            ...p1WallSegment,
            start: { x: 0, y: 0, canvasX: 10 }
          }
        ]
      }).success
    ).toBe(false);
  });

  it("bay windows require projection metadata without changing wall shape", () => {
    expect(P1DraftWindowOpeningSchema.safeParse(p1BayWindow).success).toBe(true);

    expect(
      P1DraftWindowOpeningSchema.safeParse({
        ...p1BayWindow,
        projectionDepthMm: undefined
      }).success
    ).toBe(false);

    expect(
      FloorplanDraftRevisionSchema.parse(p1DraftRevision).walls[0]
    ).toMatchObject({
      wallId: "p1-wall-north",
      start: { x: 0, y: 0 },
      end: { x: 5200, y: 0 }
    });
  });

  it("balcony rooms require balcony metadata and non-balcony rooms cannot carry it", () => {
    expect(P1DraftRoomSchema.safeParse(p1BalconyRoom).success).toBe(true);

    expect(
      P1DraftRoomSchema.safeParse({
        ...p1BalconyRoom,
        balconyMeta: undefined
      }).success
    ).toBe(false);

    expect(
      P1DraftRoomSchema.safeParse({
        ...p1LivingRoom,
        balconyMeta: p1BalconyRoom.balconyMeta
      }).success
    ).toBe(false);
  });

  it("CanonicalFloorplanRevision requires confirmation, confirmed scale, and geometryHash", () => {
    const canonicalRevision = {
      canonicalRevisionId: "canonical-revision-1",
      homeId: "home-1",
      draftRevisionId: "p1-draft-1",
      version: 1,
      unit: "mm",
      geometryHash,
      walls: [
        {
          wallId: "p1-wall-north",
          start: { x: 0, y: 0 },
          end: { x: 5200, y: 0 },
          thicknessMm: 200,
          kind: "exterior"
        }
      ],
      openings: [
        {
          openingId: "p1-window-bay",
          type: "window",
          windowKind: "bay",
          wallId: "p1-wall-north",
          positionOnWall: 0.42,
          widthMm: 1800,
          heightMm: 1400,
          sillHeightMm: 450,
          projectionDepthMm: 600,
          projectionSide: "exterior"
        }
      ],
      rooms: [
        {
          roomId: "p1-room-living",
          roomType: "living_room",
          polygon: p1LivingRoom.polygon,
          labelPosition: p1LivingRoom.labelPosition
        },
        {
          roomId: "p1-room-balcony",
          roomType: "balcony",
          polygon: p1BalconyRoom.polygon,
          balconyMeta: p1BalconyRoom.balconyMeta
        }
      ],
      globalParams: {
        ...p1GlobalParams,
        scale: {
          source: "user_confirmed",
          mmPerPixel: 20,
          confirmed: true
        }
      },
      validation: p1ValidationReady,
      confirmedByUser: true,
      confirmedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    expect(CanonicalFloorplanRevisionSchema.safeParse(canonicalRevision).success).toBe(true);

    expect(
      CanonicalFloorplanRevisionSchema.safeParse({
        ...canonicalRevision,
        confirmedByUser: false
      }).success
    ).toBe(false);

    expect(
      CanonicalFloorplanRevisionSchema.safeParse({
        ...canonicalRevision,
        geometryHash: "not-a-hash"
      }).success
    ).toBe(false);

    expect(
      CanonicalFloorplanRevisionSchema.safeParse({
        ...canonicalRevision,
        walls: [
          {
            ...canonicalRevision.walls[0],
            curveApproximation: {
              uiKind: "arc",
              originalControlPoints: [
                { x: 0, y: 0 },
                { x: 2600, y: -500 },
                { x: 5200, y: 0 }
              ],
              maxChordErrorMm: 10
            }
          }
        ]
      }).success
    ).toBe(false);
  });

  it("GeometryDependentArtifact requires canonical revision and geometry hash traceability", () => {
    const artifact = {
      artifactId: "artifact-scene-1",
      artifactType: "scene_contract",
      homeId: "home-1",
      canonicalRevisionId: "canonical-revision-1",
      sceneContractId: "scene-1",
      geometryHash,
      upstreamArtifactIds: ["canonical-revision-1"],
      createdAt: timestamp
    };

    expect(GeometryDependentArtifactSchema.safeParse(artifact).success).toBe(true);

    expect(
      GeometryDependentArtifactSchema.safeParse({
        ...artifact,
        geometryHash: undefined
      }).success
    ).toBe(false);

    expect(
      GeometryDependentArtifactSchema.safeParse({
        ...artifact,
        sceneContractId: undefined
      }).success
    ).toBe(false);
  });
});

describe("render, soft decor, and lead schemas", () => {
  it("RenderImageSpec schema validates valid payload", () => {
    expect(
      RenderImageSpecSchema.safeParse({
        id: "render-spec-1",
        projectId: "project-1",
        schemeId: "scheme-1",
        sceneContractId: "scene-1",
        roomId: "room-one-living-dining",
        cameraId: "camera-1",
        styleProfileId: "style-1",
        viewType: "overview",
        constraints: {
          preserveWalls: true,
          preserveWindows: true,
          preserveDoors: true,
          noNewOpenings: true,
          noRoomShapeChange: true,
          noFunctionChange: true
        },
        designIntent: "Create deterministic placeholder render.",
        output: {
          widthPx: 1280,
          heightPx: 960,
          mimeType: "image/svg+xml"
        },
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("RenderImageAsset schema validates traceability fields", () => {
    const parsed = RenderImageAssetSchema.parse({
      id: "render-asset-1",
      projectId: "project-1",
      schemeId: "scheme-1",
      roomId: "room-one-living-dining",
      cameraId: "camera-1",
      sceneContractId: "scene-1",
      renderSpecId: "render-spec-1",
      renderBatchId: "render-batch-1",
      asset: {
        fileAssetId: "asset-render-1",
        storageUrl: "file://renders/render-asset-1.svg",
        mimeType: "image/svg+xml",
        widthPx: 1280,
        heightPx: 960,
        checksum: "sha256-render"
      },
      generation: {
        provider: "mock_render",
        status: "succeeded",
        promptHash: "hash-render-spec-1"
      },
      verification: {
        spaceConsistencyStatus: "verified",
        styleConsistencyStatus: "warning",
        overallStatus: "warning",
        warnings: ["style pending manual check"],
        rejectionReasons: []
      },
      createdAt: timestamp
    });

    expect(parsed.projectId).toBe("project-1");
    expect(parsed.schemeId).toBe("scheme-1");
    expect(parsed.roomId).toBe("room-one-living-dining");
    expect(parsed.cameraId).toBe("camera-1");
    expect(parsed.sceneContractId).toBe("scene-1");
    expect(parsed.renderSpecId).toBe("render-spec-1");
    expect(parsed.renderBatchId).toBe("render-batch-1");
  });

  it("SoftDecorGPSPlan schema validates valid payload", () => {
    expect(
      SoftDecorGPSPlanSchema.safeParse({
        id: "gps-plan-1",
        projectId: "project-1",
        schemeId: "scheme-1",
        sceneContractId: "scene-1",
        styleProfileId: "style-1",
        status: "ready",
        rooms: [
          {
            roomId: "room-one-living-dining",
            roomType: "living_dining",
            recommendations: [
              {
                id: "rec-1",
                roomId: "room-one-living-dining",
                category: "sofa",
                placementAnchor: {
                  type: "wall",
                  targetId: "wall-one-outer-north",
                  description: "Place sofa along the primary living wall."
                },
                sizeConstraint: {
                  widthMm: 2200,
                  depthMm: 950,
                  heightMm: 900
                },
                styleConstraints: ["warm", "minimal"],
                budgetBand: "mid",
                primaryCandidate: productCandidate,
                alternatives: []
              }
            ],
            warnings: []
          }
        ],
        createdAt: timestamp,
        updatedAt: timestamp
      }).success
    ).toBe(true);
  });

  it("ProductCandidate schema validates valid payload", () => {
    expect(ProductCandidateSchema.safeParse(productCandidate).success).toBe(true);
  });

  it("LeadEvent schema validates allowed event types", () => {
    expect(
      LeadEventSchema.safeParse({
        id: "lead-1",
        projectId: "project-1",
        eventType: "product_click",
        source: "room_soft_decor_guide",
        roomId: "room-one-living-dining",
        recommendationId: "rec-1",
        productId: "product-sofa-1",
        metadata: {
          provider: "mock_sku"
        },
        createdAt: timestamp
      }).success
    ).toBe(true);
  });

  it("LeadEvent rejects invalid event types", () => {
    expect(
      LeadEventSchema.safeParse({
        id: "lead-2",
        projectId: "project-1",
        eventType: "invalid_event_type",
        source: "test",
        createdAt: timestamp
      }).success
    ).toBe(false);
  });

  it("LeadEvent rejects unnecessary PII metadata", () => {
    expect(
      LeadEventSchema.safeParse({
        id: "lead-3",
        projectId: "project-1",
        eventType: "contact_request",
        source: "test",
        metadata: {
          email: "person@example.com"
        },
        createdAt: timestamp
      }).success
    ).toBe(false);
  });
});

describe("room classification and space truth constants", () => {
  it("ROOM_CLASSIFICATION exports required groups", () => {
    expect(ROOM_CLASSIFICATION.knownRoomTypes).toEqual(expect.arrayContaining(["living", "storage"]));
    expect(ROOM_CLASSIFICATION.mainRoomTypes).toEqual(expect.arrayContaining(["living", "kitchen"]));
    expect(ROOM_CLASSIFICATION.renderableRoomTypes).toEqual(expect.arrayContaining(["corridor", "storage"]));
    expect(ROOM_CLASSIFICATION.softDecorTargetRoomTypes).toEqual(expect.arrayContaining(["living", "balcony"]));
    expect(ROOM_CLASSIFICATION.nonPrimarySoftDecorTypes).toEqual(["corridor", "storage"]);
    expect(ROOM_CLASSIFICATION.userLabelRequiredTypes).toEqual(["unknown"]);
  });

  it("getRoomEligibility rejects unknown room type unless userConfirmed", () => {
    const eligibility = getRoomEligibility({
      type: "unknown",
      polygon: [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 2000 },
        { x: 0, y: 2000 },
        { x: 0, y: 0 }
      ],
      areaMm2: 4000000,
      userConfirmed: false
    });

    expect(eligibility.isRenderable).toBe(false);
    expect(eligibility.reason).toBe("unknown_room_type_requires_user_label");
  });

  it("getRoomEligibility rejects room below minimum area", () => {
    const eligibility = getRoomEligibility({
      type: "living",
      polygon: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
        { x: 0, y: 0 }
      ],
      areaMm2: ROOM_AREA_THRESHOLDS.living - 1,
      userConfirmed: true
    });

    expect(eligibility.isSpatiallyValid).toBe(false);
    expect(eligibility.reason).toBe("room_area_below_minimum_threshold");
  });

  it("getRoomEligibility marks corridor as renderable but not primary soft decor target", () => {
    const eligibility = getRoomEligibility({
      type: "corridor",
      polygon: [
        { x: 0, y: 0 },
        { x: 1200, y: 0 },
        { x: 1200, y: 1200 },
        { x: 0, y: 1200 },
        { x: 0, y: 0 }
      ],
      areaMm2: 1440000,
      userConfirmed: true
    });

    expect(eligibility.isRenderable).toBe(true);
    expect(eligibility.isSoftDecorTarget).toBe(false);
    expect(eligibility.isMainRoom).toBe(false);
  });

  it("SPACE_TRUTH_THRESHOLDS exports minScoreForScene = 0.8", () => {
    expect(SPACE_TRUTH_THRESHOLDS.minScoreForScene).toBe(0.8);
  });
});

describe("error registry", () => {
  it("Error code registry includes all required codes", () => {
    for (const definition of ERROR_DEFINITIONS) {
      expect(ErrorDefinitionSchema.safeParse(definition).success).toBe(true);
    }

    const registeredCodes = new Set(ERROR_DEFINITIONS.map((definition) => definition.code));
    for (const code of REQUIRED_ERROR_CODES) {
      expect(registeredCodes.has(code)).toBe(true);
    }
  });
});

describe("floorplan fixtures", () => {
  it("DraftFloorplan schema validates valid fixtures", () => {
    for (const fixtureName of validFixtureNames) {
      expect(DraftFloorplanSchema.safeParse(readFixture(fixtureName, "draft-floorplan.json")).success).toBe(
        true
      );
    }
  });

  it("CanonicalFloorplan schema validates valid fixtures", () => {
    for (const fixtureName of validFixtureNames) {
      expect(
        CanonicalFloorplanSchema.safeParse(readFixture(fixtureName, "canonical-floorplan.json")).success
      ).toBe(true);
    }
  });

  it("CanonicalFloorplan rejects scale.source != user_confirmed", () => {
    const fixture = readFixture("one-bedroom", "canonical-floorplan.json");
    const invalidFixture = {
      ...(fixture as Record<string, unknown>),
      scale: {
        source: "provider_estimated",
        mmPerPixel: 20,
        confidence: 0.9
      }
    };

    expect(CanonicalFloorplanSchema.safeParse(invalidFixture).success).toBe(false);
  });

  it("Valid floorplan fixtures pass validation", () => {
    for (const fixtureName of validFixtureNames) {
      DraftFloorplanSchema.parse(readFixture(fixtureName, "draft-floorplan.json"));
      CanonicalFloorplanSchema.parse(readFixture(fixtureName, "canonical-floorplan.json"));
    }
  });

  it("Malformed provider output fixture fails validation", () => {
    const rawProviderOutput = readFixture("malformed-provider-output", "raw-provider-output.json");
    expect(DraftFloorplanSchema.safeParse(rawProviderOutput).success).toBe(false);
  });
});
