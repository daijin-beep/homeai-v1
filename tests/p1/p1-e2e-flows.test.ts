import { describe, expect, it } from "vitest";
import type { DraftRoom, DraftWindowOpening } from "@homeai/contracts";
import {
  getP1DebugPayload,
  getP1SceneContract,
  patchP1DraftOperations,
  postP1ConfirmDraft,
  postP1Session
} from "@homeai/floorplan-parser";
import {
  homeWithBalcony,
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";
import { apiContext, op } from "./p1-api-boundary.test.js";

describe("P1 end-to-end correction flows", () => {
  it("Scenario 1: normal user correction confirms canonical revision and SceneContract", () => {
    const source = {
      ...simpleRectangleHome,
      draftRevisionId: "draft-e2e-normal",
      homeId: "home-e2e-normal",
      walls: [
        ...simpleRectangleHome.walls,
        {
          wallId: "wall-e2e-interior",
          start: { x: 1000, y: 1000 },
          end: { x: 1800, y: 1000 },
          thicknessMm: 120,
          kind: "interior" as const,
          source: "fixture" as const
        }
      ]
    };
    const context = apiContext({ [source.homeId]: source });
    const session = postP1Session(context, source.homeId);

    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("e2e-normal-wall", "wall.resize", "wall", "wall-e2e-interior", {
          start: { x: 1000, y: 1000 },
          end: { x: 2300, y: 1300 }
        }),
        op("e2e-normal-delete-door", "door.delete", "opening", "door-simple-entry"),
        op("e2e-normal-add-door", "door.add", "opening", undefined, {
          opening: {
            openingId: "door-e2e-entry",
            type: "door",
            wallId: "wall-simple-south",
            positionOnWall: 0.45,
            widthMm: 900,
            heightMm: 2100,
            swing: "left_in",
            source: "user_created"
          }
        }),
        op("e2e-normal-add-window", "window.add", "opening", undefined, {
          opening: {
            openingId: "window-e2e-standard",
            type: "window",
            windowKind: "standard",
            wallId: "wall-simple-north",
            positionOnWall: 0.4,
            widthMm: 1200,
            heightMm: 1300,
            sillHeightMm: 900,
            source: "user_created"
          }
        }),
        op("e2e-normal-room", "room.type.change", "room", "room-simple-living", {
          roomType: "study"
        })
      ]
    });

    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error("Expected confirm.");
    }
    expect(confirmed.canonicalRevisionId).toBeTruthy();
    expect(confirmed.geometryHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(getP1SceneContract(context, confirmed.sceneContractId).readonly).toBe(true);
  });

  it("Scenario 2: balcony correction confirms balcony as independent room-like space", () => {
    const source = {
      ...simpleRectangleHome,
      homeId: "home-e2e-balcony",
      draftRevisionId: "draft-e2e-balcony"
    };
    const context = apiContext({ [source.homeId]: source });
    const session = postP1Session(context, source.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("e2e-balcony-add", "balcony.add", "room", undefined, {
          room: balconyRoom()
        }),
        op("e2e-balcony-toggle", "balcony.type.change", "room", "room-e2e-balcony", {
          enclosureType: "open"
        })
      ]
    });

    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error("Expected confirm.");
    }
    const scene = getP1SceneContract(context, confirmed.sceneContractId);
    expect(scene.rooms).toEqual(expect.arrayContaining([
      expect.objectContaining({ roomId: "room-e2e-balcony", roomType: "balcony" })
    ]));
  });

  it("Scenario 3: bay window correction preserves wall topology and stores projection metadata", () => {
    const source = {
      ...homeWithBalcony,
      homeId: "home-e2e-bay",
      draftRevisionId: "draft-e2e-bay"
    };
    const beforeWalls = JSON.stringify(source.walls);
    const context = apiContext({ [source.homeId]: source });
    const session = postP1Session(context, source.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("e2e-bay-window", "window.type.change", "opening", "window-balcony-connection", {
          windowKind: "bay"
        })
      ]
    });

    const draft = context.repositories.drafts.getDraftById(session.draftRevisionId);
    expect(JSON.stringify(draft?.walls)).toBe(beforeWalls);
    const bay = draft?.openings.find((opening): opening is DraftWindowOpening => opening.openingId === "window-balcony-connection" && opening.type === "window");
    expect(bay).toMatchObject({ windowKind: "bay", projectionDepthMm: 500, projectionSide: "exterior" });
  });

  it("Scenario 4: advanced correction persists values and segment-only free geometry", () => {
    const source = {
      ...simpleRectangleHome,
      homeId: "home-e2e-advanced",
      draftRevisionId: "draft-e2e-advanced"
    };
    const context = apiContext({ [source.homeId]: source });
    const session = postP1Session(context, source.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("e2e-wall-thick", "wall.thickness.change", "wall", "wall-simple-east", { thicknessMm: 240 }),
        op("e2e-free-wall-1", "freeWall.draw", "wall", undefined, {
          wallId: "wall-e2e-free-1",
          start: { x: 700, y: 700 },
          end: { x: 1500, y: 1100 },
          thicknessMm: 120,
          kind: "interior"
        }),
        op("e2e-arc-1", "freeWall.draw", "wall", undefined, {
          wallId: "wall-e2e-arc-1",
          start: { x: 1800, y: 700 },
          end: { x: 2300, y: 500 },
          thicknessMm: 120,
          kind: "interior",
          uiKind: "arc_like"
        }),
        op("e2e-floor-height", "floorHeight.change", "global_params", undefined, { floorHeightMm: 3100 }),
        op("e2e-door-dim", "door.dimension.change", "opening", "door-simple-entry", { widthMm: 950, heightMm: 2200 })
      ]
    });

    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) {
      throw new Error("Expected confirm.");
    }
    const draft = context.repositories.drafts.getDraftById(session.draftRevisionId);
    expect(draft?.globalParams.floorHeightMm).toBe(3100);
    expect(JSON.stringify(draft?.walls)).not.toContain("Bezier");
    expect(JSON.stringify(draft?.walls)).not.toContain("NURBS");
    expect(JSON.stringify(draft?.walls)).not.toContain("trueCurve");
  });

  it("Scenario 5: invalid draft cannot confirm or create SceneContract", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const session = postP1Session(context, simpleRectangleHome.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [op("e2e-invalid-delete", "wall.delete", "wall", "wall-simple-west")]
    });

    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    expect(confirmed.ok).toBe(false);
    expect(context.repositories.sceneContracts.getActiveSceneContractForHome(simpleRectangleHome.homeId)).toBeUndefined();
  });

  it("Scenario 6 and 7: re-entry no-op preserves artifacts while geometry change invalidates dependencies", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const initialSession = postP1Session(context, simpleRectangleHome.homeId);
    const first = postP1ConfirmDraft(context, initialSession.draftRevisionId);
    if (!first.ok) {
      throw new Error("Expected first confirm.");
    }
    context.repositories.geometryDependencies.createDependencyRecord({
      dependencyId: "dep-e2e-camera",
      artifactId: "camera-e2e",
      artifactType: "CameraPlan",
      homeId: simpleRectangleHome.homeId,
      canonicalRevisionId: first.canonicalRevisionId,
      geometryHash: first.geometryHash,
      status: "active",
      active: true,
      createdAt: p1FixtureTimestamp
    });

    const noOpSession = postP1Session(context, simpleRectangleHome.homeId);
    const noOp = postP1ConfirmDraft(context, noOpSession.draftRevisionId);
    expect(noOp.ok).toBe(true);
    if (!noOp.ok) {
      throw new Error("Expected no-op confirm.");
    }
    expect(noOp.geometryHash).toBe(first.geometryHash);
    expect(noOp.invalidationSummary.changed).toBe(false);
    expect(noOp.invalidationSummary.preserved.paymentRecords).toBe(true);

    const changedSession = postP1Session(context, simpleRectangleHome.homeId);
    patchP1DraftOperations(context, changedSession.draftRevisionId, {
      operations: [op("e2e-reentry-change", "wall.thickness.change", "wall", "wall-simple-east", { thicknessMm: 280 })]
    });
    const changed = postP1ConfirmDraft(context, changedSession.draftRevisionId);
    expect(changed.ok).toBe(true);
    if (!changed.ok) {
      throw new Error("Expected changed confirm.");
    }
    expect(changed.geometryHash).not.toBe(noOp.geometryHash);
    expect(changed.invalidationSummary.changed).toBe(true);
    expect(changed.invalidationSummary.preserved.eventAuditLog).toBe(true);
  });

  it("debug payload includes draft, validation, events, canonical, SceneContract summary, and invalidation summary", () => {
    const context = apiContext({ [homeWithBalcony.homeId]: homeWithBalcony });
    const session = postP1Session(context, homeWithBalcony.homeId);
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected confirm.");
    }
    const changedSession = postP1Session(context, homeWithBalcony.homeId);
    patchP1DraftOperations(context, changedSession.draftRevisionId, {
      operations: [op("e2e-debug-change", "wall.thickness.change", "wall", "wall-bal-main-east", { thicknessMm: 260 })]
    });
    postP1ConfirmDraft(context, changedSession.draftRevisionId);

    const debug = getP1DebugPayload(context, homeWithBalcony.homeId);
    expect(debug.currentDraft).toBeDefined();
    expect(debug.validation).toBeDefined();
    expect(debug.events.length).toBeGreaterThan(0);
    expect(debug.canonicalRevision).toBeDefined();
    expect(debug.sceneContractId).toBeDefined();
    expect(debug.sceneContractSummary).toMatchObject({ readonly: true, version: "0.2" });
    expect(debug.invalidationSummary).toBeDefined();
  });
});

function balconyRoom(): DraftRoom {
  return {
    roomId: "room-e2e-balcony",
    roomType: "balcony",
    polygon: [
      { x: 0, y: -1200 },
      { x: 5000, y: -1200 },
      { x: 5000, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -1200 }
    ],
    source: "user_labeled",
    balconyMeta: {
      enclosureType: "closed",
      isExteriorAttached: true,
      adjacentInteriorRoomIds: ["room-simple-living"],
      connectionWallIds: ["wall-simple-north"],
      exteriorEdgeIds: ["wall-simple-north"]
    }
  };
}
