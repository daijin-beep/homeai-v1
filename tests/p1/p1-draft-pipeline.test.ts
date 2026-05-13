import { describe, expect, it } from "vitest";
import type { FloorplanDraftRevision, FloorplanEditOperation } from "@homeai/contracts";
import type { DraftOpening } from "@homeai/contracts";
import {
  applyFloorplanOperations,
  attachOpeningToWall,
  buildDraftValidationState,
  buildSceneContractFromCanonicalRevision,
  confirmFloorplanDraft,
  convertBayWindowToProjectionMetadata,
  createBalconyRoom,
  createDraftFromCanonicalRevision,
  createDraftFromParsedFloorplan,
  createP1PersistenceStore,
  createReentryDraftForHome,
  detectExteriorWallAttachment,
  enforceReadonlySceneContract,
  generateDefaultOpeningParams,
  getActiveSceneContractForHome,
  getDraftRevision,
  markDraftDirty,
  persistCanonicalRevision,
  persistSceneContract,
  replayOperationLog,
  restoreWallAfterBalconyDelete,
  runSpaceTruthGate,
  setBalconyEnclosureType,
  updateDoorSwing,
  updateWindowKind,
  validateBalconyAttachment,
  validateOpenings,
  verifyGeometryHashMatch
} from "@homeai/floorplan-parser";
import {
  homeWithBalcony,
  homeWithBayWindow,
  invalidDetachedBalcony,
  invalidOrphanOpening,
  invalidUnclosedRoom,
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";

describe("P1 draft revision store and operation log", () => {
  it("creates and retrieves a draft from AI parse output", () => {
    const store = createP1PersistenceStore();
    const draft = createDraftFromParsedFloorplan(simpleRectangleHome, {
      draftRevisionId: "draft-from-ai",
      createdAt: p1FixtureTimestamp
    }, store);

    expect(draft.source).toBe("ai_parse");
    expect(getDraftRevision("draft-from-ai", store)?.draftRevisionId).toBe("draft-from-ai");
  });

  it("applies operations in order and can replay them", () => {
    const operations: FloorplanEditOperation[] = [
      operation("op-1", "wall.moveEndpoint", "wall", "wall-simple-east", {
        endpoint: "end",
        point: { x: 5200, y: 4000 }
      }),
      operation("op-2", "floorHeight.change", "global_params", undefined, {
        floorHeightMm: 3000
      })
    ];

    const changed = applyFloorplanOperations(simpleRectangleHome, operations);
    const replayed = replayOperationLog(simpleRectangleHome, changed.operationLog);

    expect(changed.operationLog.map((item) => item.operationId)).toEqual([
      "operation-simple-valid",
      "op-1",
      "op-2"
    ]);
    expect(replayed.walls.find((wall) => wall.wallId === "wall-simple-east")?.end).toEqual({ x: 5200, y: 4000 });
    expect(replayed.globalParams.floorHeightMm).toBe(3000);
  });

  it("rejects invalid operation types", () => {
    expect(() =>
      applyFloorplanOperations(simpleRectangleHome, [
        {
          operationId: "bad-op",
          operationType: "llm.edit",
          targetType: "draft",
          actor: "user",
          createdAt: p1FixtureTimestamp
        } as unknown as FloorplanEditOperation
      ])
    ).toThrow();
  });

  it("creates re-entry draft from latest canonical revision instead of original parse", () => {
    const store = createP1PersistenceStore();
    const confirmed = confirmFloorplanDraft(simpleRectangleHome, {
      canonicalRevisionId: "canonical-reentry",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: true,
      store
    });
    expect(confirmed.ok).toBe(true);

    const reentry = createReentryDraftForHome("home-simple-rectangle", {
      draftRevisionId: "draft-reentry",
      createdAt: p1FixtureTimestamp
    }, store);
    const direct = createDraftFromCanonicalRevision(confirmed.ok ? confirmed.canonicalRevision : never(), {
      draftRevisionId: "draft-direct",
      createdAt: p1FixtureTimestamp
    });

    expect(reentry.source).toBe("reentry_edit");
    expect(reentry.baseCanonicalRevisionId).toBe("canonical-reentry");
    expect(reentry.walls).toEqual(direct.walls);
  });

  it("marks draft dirty by clearing validation", () => {
    const dirty = markDraftDirty(simpleRectangleHome, { updatedAt: "2026-05-13T00:01:00.000Z" });

    expect(dirty.validation).toBeUndefined();
    expect(dirty.updatedAt).toBe("2026-05-13T00:01:00.000Z");
  });
});

describe("P1 opening manager", () => {
  it("attaches a door to a wall and rejects an orphan door", () => {
    const door = {
      openingId: "door-new",
      type: "door" as const,
      wallId: "wall-simple-south",
      positionOnWall: 0.4,
      ...generateDefaultOpeningParams("door"),
      swing: "left_in" as const,
      source: "user_created" as const
    };

    expect(attachOpeningToWall(simpleRectangleHome, door)).toMatchObject({ wallId: "wall-simple-south" });
    expect(validateOpenings({ ...simpleRectangleHome, openings: [invalidOrphanOpening.openings[0]!] })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "OPENING_ORPHANED" })])
    );
  });

  it("generates deterministic standard and floor-to-ceiling window defaults", () => {
    expect(generateDefaultOpeningParams("window")).toMatchObject({
      widthMm: 1200,
      sillHeightMm: 900
    });
    expect(
      generateDefaultOpeningParams("window", { windowKind: "floor_to_ceiling", floorHeightMm: 3100 })
    ).toMatchObject({
      widthMm: 1200,
      heightMm: 3100,
      sillHeightMm: 0
    });
  });

  it("stores bay windows as projection metadata without changing walls", () => {
    const before = JSON.stringify(homeWithBayWindow.walls);
    const bay = convertBayWindowToProjectionMetadata({
      openingId: "bay-new",
      type: "window",
      windowKind: "bay",
      wallId: "wall-bay-north",
      positionOnWall: 0.5,
      widthMm: 1200,
      heightMm: 1300,
      sillHeightMm: 900,
      source: "user_created"
    });
    const attached = attachOpeningToWall(homeWithBayWindow, bay);

    expect(attached).toMatchObject({
      windowKind: "bay",
      projectionDepthMm: 500,
      projectionSide: "exterior"
    });
    expect(JSON.stringify(homeWithBayWindow.walls)).toBe(before);
  });

  it("updates door swing and window kind deterministically", () => {
    const doorChanged = updateDoorSwing(simpleRectangleHome, "door-simple-entry", "right_out");
    const windowChanged = updateWindowKind(homeWithBayWindow, "window-bay-1", "floor_to_ceiling");

    expect(doorChanged.openings[0]).toMatchObject({ swing: "right_out" });
    expect(windowChanged.openings[0]).toMatchObject({
      windowKind: "floor_to_ceiling",
      sillHeightMm: 0
    });
  });
});

describe("P1 balcony manager", () => {
  it("creates and validates an exterior-attached balcony", () => {
    const balcony = createBalconyRoom({
      roomId: "room-bal-new",
      polygon: [
        { x: 0, y: -1000 },
        { x: 2000, y: -1000 },
        { x: 2000, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: -1000 }
      ],
      adjacentInteriorRoomIds: ["room-bal-living"],
      connectionWallIds: ["wall-bal-main-north"],
      exteriorEdgeIds: ["wall-bal-ext-north"]
    });

    expect(balcony.roomType).toBe("balcony");
    expect(detectExteriorWallAttachment(homeWithBalcony, balcony)).toEqual(["wall-bal-main-north"]);
    expect(validateBalconyAttachment(homeWithBalcony, balcony)).toBeNull();
  });

  it("marks detached balcony invalid and toggles open/closed type", () => {
    expect(validateBalconyAttachment(invalidDetachedBalcony, invalidDetachedBalcony.rooms[1]!)).toMatchObject({
      code: "BALCONY_DETACHED"
    });

    const toggled = setBalconyEnclosureType(homeWithBalcony, "room-bal-balcony", "open");
    expect(toggled.rooms.find((room) => room.roomId === "room-bal-balcony")).toMatchObject({
      balconyMeta: { enclosureType: "open" }
    });
  });

  it("deleting a balcony preserves wall geometry and removes only the room", () => {
    const beforeWalls = JSON.stringify(homeWithBalcony.walls);
    const withoutBalcony = restoreWallAfterBalconyDelete(homeWithBalcony, "room-bal-balcony");

    expect(JSON.stringify(withoutBalcony.walls)).toBe(beforeWalls);
    expect(withoutBalcony.rooms.some((room) => room.roomType === "balcony")).toBe(false);
  });
});

describe("P1 draft validation and confirmation", () => {
  it("valid draft passes and invalid draft cases fail with neutral issues", () => {
    expect(buildDraftValidationState(simpleRectangleHome, { validatedAt: p1FixtureTimestamp })).toMatchObject({
      status: "valid",
      canConfirm: true
    });

    expect(runSpaceTruthGate(invalidUnclosedRoom, { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "UNCLOSED_BOUNDARY" })])
    );
    expect(buildDraftValidationState(invalidOrphanOpening, { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "OPENING_ORPHANED" })])
    );
    expect(buildDraftValidationState(invalidDetachedBalcony, { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "BALCONY_DETACHED" })])
    );
  });

  it("enforces advanced bounds and unsupported room types", () => {
    expect(buildDraftValidationState(withWallThickness(40), { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "WALL_THICKNESS_OUT_OF_RANGE" })])
    );
    expect(buildDraftValidationState(withFloorHeight(1800), { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "FLOOR_HEIGHT_OUT_OF_RANGE" })])
    );
    expect(buildDraftValidationState(withDoorWidth(2500), { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DOOR_WIDTH_OUT_OF_RANGE" })])
    );
    expect(buildDraftValidationState(withBayProjectionMissing(), { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "BAY_WINDOW_PROJECTION_MISSING" })])
    );
    expect(buildDraftValidationState(withUnsupportedRoomType(), { validatedAt: p1FixtureTimestamp }).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ROOM_TYPE_UNSUPPORTED" })])
    );
  });

  it("confirms only valid user-confirmed drafts and creates immutable canonical revisions", () => {
    const result = confirmFloorplanDraft(simpleRectangleHome, {
      canonicalRevisionId: "canonical-confirmed",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: true
    });
    const invalidResult = confirmFloorplanDraft(invalidUnclosedRoom, {
      canonicalRevisionId: "canonical-invalid",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: true
    });
    const unconfirmed = confirmFloorplanDraft(simpleRectangleHome, {
      canonicalRevisionId: "canonical-unconfirmed",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.canonicalRevision)).toBe(true);
      expect(() => {
        (result.canonicalRevision as unknown as { unit: string }).unit = "cm";
      }).toThrow();
    }
    expect(invalidResult.ok).toBe(false);
    expect(unconfirmed.ok).toBe(false);
  });

  it("keeps geometryHash stable for same geometry and changes after wall edit", () => {
    const first = confirmOrThrow(simpleRectangleHome, "canonical-hash-a");
    const second = confirmOrThrow({
      ...simpleRectangleHome,
      draftRevisionId: "draft-hash-equivalent",
      updatedAt: "2026-05-13T01:00:00.000Z"
    }, "canonical-hash-b");
    const edited = confirmOrThrow(
      applyFloorplanOperations(simpleRectangleHome, [
        operation("op-hash-edit", "wall.thickness.change", "wall", "wall-simple-east", {
          thicknessMm: 260
        })
      ]),
      "canonical-hash-c"
    );

    expect(first.geometryHash).toBe(second.geometryHash);
    expect(first.geometryHash).not.toBe(edited.geometryHash);
  });

  it("blocks parsed drafts from downstream SceneContract creation", () => {
    expect(() =>
      buildSceneContractFromCanonicalRevision(simpleRectangleHome as unknown as Parameters<typeof buildSceneContractFromCanonicalRevision>[0])
    ).toThrow();
  });
});

describe("P1 SceneContract v0.2 integration", () => {
  it("creates and persists readonly SceneContract from canonical revision", () => {
    const store = createP1PersistenceStore();
    const canonical = confirmOrThrow(homeWithBalcony, "canonical-scene");
    persistCanonicalRevision(canonical, store);
    const scene = buildSceneContractFromCanonicalRevision(canonical, {
      sceneContractId: "scene-home-balcony",
      createdAt: p1FixtureTimestamp
    });
    const persisted = persistSceneContract(scene, store);

    expect(verifyGeometryHashMatch(canonical, scene)).toBe(true);
    expect(persisted.readonly).toBe(true);
    expect(getActiveSceneContractForHome(canonical.homeId, store)?.sceneContractId).toBe("scene-home-balcony");
    expect(enforceReadonlySceneContract(scene)).toBe(scene);
  });

  it("rejects mutable downstream SceneContract and preserves bay/balcony semantics", () => {
    const bayCanonical = confirmOrThrow(homeWithBayWindow, "canonical-scene-bay");
    const balconyCanonical = confirmOrThrow(homeWithBalcony, "canonical-scene-balcony");
    const bayScene = buildSceneContractFromCanonicalRevision(bayCanonical);
    const balconyScene = buildSceneContractFromCanonicalRevision(balconyCanonical);

    expect(() => enforceReadonlySceneContract({ ...bayScene, readonly: false })).toThrow();
    expect(bayScene.walls).toHaveLength(bayCanonical.walls.length);
    expect(bayScene.openings[0]).toMatchObject({
      windowKind: "bay",
      projectionDepthMm: 600,
      projectionSide: "exterior"
    });
    expect(balconyScene.rooms.some((room) => room.roomType === "balcony")).toBe(true);
  });
});

function operation(
  operationId: string,
  operationType: FloorplanEditOperation["operationType"],
  targetType: FloorplanEditOperation["targetType"],
  targetId?: string,
  payload?: Record<string, unknown>
): FloorplanEditOperation {
  return {
    operationId,
    operationType,
    targetType,
    ...(targetId === undefined ? {} : { targetId }),
    actor: "user",
    ...(payload === undefined ? {} : { payload }),
    createdAt: p1FixtureTimestamp
  };
}

function confirmOrThrow(draft: FloorplanDraftRevision, canonicalRevisionId: string) {
  const result = confirmFloorplanDraft(draft, {
    canonicalRevisionId,
    version: 1,
    confirmedAt: p1FixtureTimestamp,
    userConfirmed: true
  });
  if (!result.ok) {
    throw new Error("Expected draft to confirm.");
  }
  return result.canonicalRevision;
}

function withWallThickness(thicknessMm: number): FloorplanDraftRevision {
  return {
    ...simpleRectangleHome,
    walls: [{ ...simpleRectangleHome.walls[0]!, thicknessMm }, ...simpleRectangleHome.walls.slice(1)]
  };
}

function withFloorHeight(floorHeightMm: number): FloorplanDraftRevision {
  return {
    ...simpleRectangleHome,
    globalParams: {
      ...simpleRectangleHome.globalParams,
      floorHeightMm
    }
  };
}

function withDoorWidth(widthMm: number): FloorplanDraftRevision {
  return {
    ...simpleRectangleHome,
    openings: simpleRectangleHome.openings.map((opening) =>
      opening.type === "door" ? { ...opening, widthMm } : opening
    )
  };
}

function withBayProjectionMissing(): FloorplanDraftRevision {
  const opening = homeWithBayWindow.openings[0]!;
  return {
    ...homeWithBayWindow,
    openings: [
      {
        openingId: opening.openingId,
        type: "window",
        windowKind: "bay",
        wallId: opening.wallId,
        positionOnWall: opening.positionOnWall,
        widthMm: opening.widthMm,
        heightMm: opening.heightMm,
        sillHeightMm: "sillHeightMm" in opening ? opening.sillHeightMm : undefined,
        projectionSide: "exterior",
        source: opening.source
      } as unknown as DraftOpening
    ]
  };
}

function withUnsupportedRoomType(): FloorplanDraftRevision {
  return {
    ...simpleRectangleHome,
    rooms: [
      {
        ...simpleRectangleHome.rooms[0]!,
        roomType: "garage"
      } as unknown as FloorplanDraftRevision["rooms"][number]
    ]
  };
}

function never(): never {
  throw new Error("Expected success result.");
}
