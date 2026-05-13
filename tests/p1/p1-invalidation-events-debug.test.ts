import { describe, expect, it } from "vitest";
import { P1EventSchema } from "@homeai/contracts";
import {
  buildSceneContractFromCanonicalRevision,
  compareGeometryHash,
  confirmFloorplanDraft,
  createInMemoryP1Repositories,
  emitP1Event,
  eventTypeForOperation,
  getP1DebugPayload,
  invalidateArtifactsForNewRevision,
  patchP1DraftOperations,
  postP1ConfirmDraft,
  postP1RecomputeBoundaries,
  postP1Session,
  postP1ValidateDraft,
  preserveNonGeometryPreferences,
  returnInvalidationSummary
} from "@homeai/floorplan-parser";
import {
  homeWithBalcony,
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";
import { apiContext, op } from "./p1-api-boundary.test.js";

describe("P1 invalidation skeleton", () => {
  it("unchanged hash preserves artifacts and changed hash invalidates geometry-dependent records", () => {
    const repositories = createInMemoryP1Repositories();
    const first = confirmOrThrow(simpleRectangleHome, "canonical-invalid-first");
    const same = confirmOrThrow({
      ...simpleRectangleHome,
      draftRevisionId: "draft-invalid-same"
    }, "canonical-invalid-same");
    const changed = confirmOrThrow({
      ...simpleRectangleHome,
      walls: [{ ...simpleRectangleHome.walls[0]!, thicknessMm: 260 }, ...simpleRectangleHome.walls.slice(1)]
    }, "canonical-invalid-changed");
    repositories.sceneContracts.createSceneContract(buildSceneContractFromCanonicalRevision(first, {
      sceneContractId: "scene-invalid-first",
      createdAt: p1FixtureTimestamp
    }));
    repositories.geometryDependencies.createDependencyRecord({
      dependencyId: "dep-scene-first",
      artifactId: "scene-invalid-first",
      artifactType: "SceneContract",
      homeId: first.homeId,
      canonicalRevisionId: first.canonicalRevisionId,
      geometryHash: first.geometryHash,
      status: "active",
      active: true,
      createdAt: p1FixtureTimestamp
    });
    repositories.geometryDependencies.createDependencyRecord({
      dependencyId: "dep-camera-first",
      artifactId: "camera-first",
      artifactType: "CameraPlan",
      homeId: first.homeId,
      canonicalRevisionId: first.canonicalRevisionId,
      geometryHash: first.geometryHash,
      status: "active",
      active: true,
      createdAt: p1FixtureTimestamp
    });

    const unchanged = invalidateArtifactsForNewRevision(repositories, {
      previousCanonicalRevision: first,
      newCanonicalRevision: same,
      invalidatedAt: p1FixtureTimestamp
    });
    const invalidated = invalidateArtifactsForNewRevision(repositories, {
      previousCanonicalRevision: first,
      newCanonicalRevision: changed,
      invalidatedAt: p1FixtureTimestamp
    });

    expect(compareGeometryHash(first.geometryHash, same.geometryHash).changed).toBe(false);
    expect(unchanged.invalidatedDependencyIds).toEqual([]);
    expect(invalidated.changed).toBe(true);
    expect(invalidated.invalidatedDependencyIds).toEqual(["dep-camera-first", "dep-scene-first"]);
    expect(repositories.geometryDependencies.listByCanonicalRevisionId(first.canonicalRevisionId).every((record) => !record.active)).toBe(true);
    expect(repositories.sceneContracts.getActiveSceneContractForHome(first.homeId)).toBeUndefined();
    expect(preserveNonGeometryPreferences()).toMatchObject({
      eventAuditLog: true,
      paymentRecords: true,
      previousPaidDeliverableAccess: true
    });
  });

  it("returns explicit preservation state for no previous hash", () => {
    const summary = returnInvalidationSummary({
      comparison: compareGeometryHash(undefined, confirmOrThrow(simpleRectangleHome, "canonical-summary").geometryHash),
      invalidatedDependencyIds: []
    });

    expect(summary.changed).toBe(false);
    expect(summary.preserved.paymentRecords).toBe(true);
  });
});

describe("P1 event tracking skeleton", () => {
  it("validates anonymous events and rejects events without user or anonymous session", () => {
    expect(P1EventSchema.safeParse({
      eventId: "event-anonymous",
      eventType: "p1_entered",
      homeId: "home-event",
      anonymousSessionId: "anonymous-event",
      draftRevisionId: "draft-event",
      timestamp: p1FixtureTimestamp,
      source: "p1_editor"
    }).success).toBe(true);

    expect(P1EventSchema.safeParse({
      eventId: "event-invalid",
      eventType: "p1_entered",
      homeId: "home-event",
      draftRevisionId: "draft-event",
      timestamp: p1FixtureTimestamp,
      source: "p1_editor"
    }).success).toBe(false);
  });

  it("maps operations to events and confirm includes geometryHash", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const session = postP1Session(context, simpleRectangleHome.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [op("op-event-door", "door.direction.change", "opening", "door-simple-entry", { swing: "right_out" })]
    });
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected confirm to succeed.");
    }

    const events = context.repositories.events.listEventsByDraftRevision(session.draftRevisionId);
    expect(eventTypeForOperation("door.direction.change")).toBe("p1_door_direction_changed");
    expect(eventTypeForOperation("advanced.settings.toggle")).toBe("p1_advanced_settings_toggled");
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "p1_door_direction_changed", operationType: "door.direction.change" }),
      expect.objectContaining({ eventType: "p1_floorplan_confirmed", geometryHash: confirmed.geometryHash })
    ]));
  });

  it("emits re-entry event with previous and new hash", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const firstSession = postP1Session(context, simpleRectangleHome.homeId);
    const confirmed = postP1ConfirmDraft(context, firstSession.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected confirm to succeed.");
    }
    postP1Session(context, simpleRectangleHome.homeId);

    expect(context.repositories.events.listEventsByHome(simpleRectangleHome.homeId)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "p1_reentered_from_downstream",
        previousGeometryHash: confirmed.geometryHash,
        newGeometryHash: confirmed.geometryHash
      })
    ]));
  });

  it("rejects invalid event emission through repository schema validation", () => {
    const repositories = createInMemoryP1Repositories();
    expect(() =>
      emitP1Event(repositories.events, {
        eventId: "event-invalid-emit",
        eventType: "p1_entered",
        homeId: "home-event",
        draftRevisionId: "draft-event",
        timestamp: p1FixtureTimestamp
      })
    ).toThrow();
  });
});

describe("P1 debug payload", () => {
  it("covers fixture load, operations, boundary recompute, validation, confirm, and debug output", () => {
    const context = apiContext({ [homeWithBalcony.homeId]: homeWithBalcony });
    const session = postP1Session(context, homeWithBalcony.homeId);
    patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("op-debug-wall", "wall.thickness.change", "wall", "wall-bal-main-east", { thicknessMm: 240 }),
        op("op-debug-door", "door.add", "opening", undefined, {
          opening: {
            openingId: "door-debug-balcony",
            type: "door",
            wallId: "wall-bal-main-south",
            positionOnWall: 0.3,
            widthMm: 800,
            heightMm: 2000,
            swing: "left_in",
            source: "user_created"
          }
        }),
        op("op-debug-window", "window.type.change", "opening", "window-balcony-connection", {
          windowKind: "floor_to_ceiling"
        }),
        op("op-debug-balcony", "balcony.type.change", "room", "room-bal-balcony", {
          enclosureType: "open"
        })
      ]
    });
    postP1RecomputeBoundaries(context, session.draftRevisionId);
    postP1ValidateDraft(context, session.draftRevisionId);
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected debug fixture confirm to succeed.");
    }
    const debug = getP1DebugPayload(context, homeWithBalcony.homeId);

    expect(debug.currentDraft?.draftRevisionId).toBe(session.draftRevisionId);
    expect(debug.operationLog.map((operation) => operation.operationId)).toEqual(expect.arrayContaining([
      "op-debug-wall",
      "op-debug-door",
      "op-debug-window",
      "op-debug-balcony"
    ]));
    expect(debug.normalizedWallSegments.length).toBeGreaterThan(0);
    expect(debug.roomBoundaryOutput.faces.length).toBeGreaterThan(0);
    expect(debug.validation?.canConfirm).toBe(true);
    expect(debug.geometryHash).toBe(confirmed.geometryHash);
    expect(debug.sceneContract?.readonly).toBe(true);
    expect(debug.downstreamDependencies.length).toBeGreaterThan(0);
    expect(debug.events.length).toBeGreaterThan(0);
  });
});

function confirmOrThrow(draft: typeof simpleRectangleHome, canonicalRevisionId: string) {
  const result = confirmFloorplanDraft(draft, {
    canonicalRevisionId,
    version: 1,
    confirmedAt: p1FixtureTimestamp,
    userConfirmed: true
  });
  if (!result.ok) {
    throw new Error("Expected confirm to succeed.");
  }
  return result.canonicalRevision;
}
