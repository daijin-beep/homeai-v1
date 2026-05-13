import { describe, expect, it } from "vitest";
import {
  LayoutIntentEventSchema,
  type FurniturePlaceholder,
  type LayoutIntentArtifactDependency,
  type LayoutIntentOperation,
  type LayoutIntentRevision,
  type P1SceneContractV02
} from "@homeai/contracts";
import {
  applyLayoutIntentOperations,
  buildAnchorPlannerInputContract,
  buildLayoutIntentContract,
  compareLayoutIntentHash,
  computeLayoutIntentHash,
  confirmLayoutIntentRevision,
  createInMemoryP1Repositories,
  createInitialLayoutIntentFromSceneContract,
  emitLayoutIntentEvent,
  getLayoutIntentContract,
  getLayoutIntentRevision,
  getP1DebugPayload,
  invalidateForLayoutIntentChange,
  invalidateLayoutIntentIfGeometryChanged,
  patchLayoutIntentOperations,
  postLayoutIntentConfirm,
  postLayoutIntentSession,
  postLayoutIntentValidate,
  postP1ConfirmDraft,
  postP1Session,
  preserveGeometryArtifactsForLayoutOnlyChange,
  validateLayoutIntent
} from "@homeai/floorplan-parser";
import { buildRoomAffordanceGraphFromSceneContract, createSceneContractV02 } from "@homeai/scene";
import {
  bedroomUserBedPlaceholder,
  conflictDoorClearancePlaceholder,
  diningRoomTablePlaceholder,
  invalidMissingRoomPlaceholder,
  invalidOutsideRoomPlaceholder,
  layoutBedroomUserBed,
  layoutEmptyAutofillOn,
  layoutFixtureGeometryHash,
  livingRoomSofaPlaceholder
} from "../fixtures/p1/layout-intent.js";
import {
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";
import { apiContext } from "./p1-api-boundary.test.js";

describe("layoutIntentHash", () => {
  it("is deterministic and ignores placeholder order and timestamps", () => {
    const left = computeLayoutIntentHash({
      aiAutofillEnabled: true,
      placeholders: [livingRoomSofaPlaceholder, diningRoomTablePlaceholder]
    });
    const right = computeLayoutIntentHash({
      aiAutofillEnabled: true,
      placeholders: [
        { ...diningRoomTablePlaceholder, updatedAt: "2026-05-13T01:00:00.000Z" },
        { ...livingRoomSofaPlaceholder, updatedAt: "2026-05-13T01:00:00.000Z" }
      ]
    });

    expect(left).toBe(right);
  });

  it("changes for semantic layout changes but not geometryHash", () => {
    const base = computeLayoutIntentHash({ aiAutofillEnabled: true, placeholders: [livingRoomSofaPlaceholder] });
    const added = computeLayoutIntentHash({ aiAutofillEnabled: true, placeholders: [livingRoomSofaPlaceholder, diningRoomTablePlaceholder] });
    const moved = computeLayoutIntentHash({
      aiAutofillEnabled: true,
      placeholders: [{ ...livingRoomSofaPlaceholder, center: { x: livingRoomSofaPlaceholder.center.x + 100, y: livingRoomSofaPlaceholder.center.y } }]
    });
    const changedCategory = computeLayoutIntentHash({
      aiAutofillEnabled: true,
      placeholders: [{ ...livingRoomSofaPlaceholder, category: "coffee_table" }]
    });
    const toggled = computeLayoutIntentHash({ aiAutofillEnabled: false, placeholders: [livingRoomSofaPlaceholder] });

    expect(added).not.toBe(base);
    expect(moved).not.toBe(base);
    expect(changedCategory).not.toBe(base);
    expect(toggled).not.toBe(base);
    expect(layoutFixtureGeometryHash).toBe(layoutFixtureGeometryHash);
  });
});

describe("LayoutIntentRepository", () => {
  it("creates, fetches, activates, archives, and protects stored revisions", () => {
    const repositories = createInMemoryP1Repositories();
    const created = repositories.layoutIntents.createLayoutIntentRevision(layoutBedroomUserBed);
    const fetched = repositories.layoutIntents.getLayoutIntentRevision(created.layoutIntentRevisionId);
    const activeByHome = repositories.layoutIntents.getActiveLayoutIntentForHome(created.homeId);
    const activeByCanonical = repositories.layoutIntents.getActiveLayoutIntentForCanonicalRevision(created.canonicalRevisionId);

    expect(fetched?.layoutIntentHash).toBe(created.layoutIntentHash);
    expect(activeByHome?.layoutIntentRevisionId).toBe(created.layoutIntentRevisionId);
    expect(activeByCanonical?.layoutIntentRevisionId).toBe(created.layoutIntentRevisionId);
    expect(Object.isFrozen(fetched)).toBe(true);
    expect(() => {
      (fetched?.placeholders as unknown as unknown[]).push({});
    }).toThrow();

    repositories.layoutIntents.archiveLayoutIntentRevision(created.layoutIntentRevisionId, p1FixtureTimestamp);
    expect(repositories.layoutIntents.getActiveLayoutIntentForHome(created.homeId)).toBeUndefined();
  });
});

describe("Layout Intent operations, validation, and confirm", () => {
  it("applies layout operations without mutating canonical geometry or SceneContract", () => {
    const { scene, canonicalBefore, sceneBefore } = confirmedSceneFixture();
    let layoutIntent = createInitialLayoutIntentFromSceneContract(scene, {
      layoutIntentRevisionId: "layout-service-ops",
      createdAt: p1FixtureTimestamp
    });
    const beforeHash = layoutIntent.layoutIntentHash;

    layoutIntent = applyOps(layoutIntent, scene, [
      op("op-layout-add", "layout.placeholder.add", { placeholder: bedroomUserBedPlaceholder }),
      op("op-layout-move", "layout.placeholder.move", { center: { x: 1800, y: 1800 } }, bedroomUserBedPlaceholder.placeholderId),
      op("op-layout-rotate", "layout.placeholder.rotate", { rotationDeg: 90 }, bedroomUserBedPlaceholder.placeholderId),
      op("op-layout-category", "layout.placeholder.category.change", { category: "wardrobe" }, bedroomUserBedPlaceholder.placeholderId),
      op("op-layout-size", "layout.placeholder.displaySize.change", { width: 1200, depth: 600 }, bedroomUserBedPlaceholder.placeholderId),
      op("op-layout-autofill", "layout.aiAutofill.toggle", { aiAutofillEnabled: false })
    ]);

    expect(layoutIntent.layoutIntentHash).not.toBe(beforeHash);
    expect(layoutIntent.placeholders[0]).toMatchObject({
      category: "wardrobe",
      center: { x: 1800, y: 1800 },
      rotationDeg: 90,
      displaySizeMm: { width: 1200, depth: 600 }
    });
    expect(layoutIntent.aiAutofillEnabled).toBe(false);
    expect(canonicalBefore()).toBe(canonicalBefore());
    expect(JSON.stringify(scene)).toBe(sceneBefore);

    const deleted = applyOps(layoutIntent, scene, [
      op("op-layout-delete", "layout.placeholder.delete", {}, bedroomUserBedPlaceholder.placeholderId)
    ]);
    expect(deleted.placeholders).toHaveLength(0);
  });

  it("validates missing room, outside room, extreme size, door clearance, and neutral copy", () => {
    const { scene } = confirmedSceneFixture();
    const missing = validateLayoutIntent({ ...layoutBedroomUserBed, placeholders: [invalidMissingRoomPlaceholder] }, scene, {
      validatedAt: p1FixtureTimestamp
    });
    const outside = validateLayoutIntent({ ...layoutBedroomUserBed, placeholders: [invalidOutsideRoomPlaceholder] }, scene, {
      validatedAt: p1FixtureTimestamp
    });
    const extremePlaceholder: FurniturePlaceholder = {
      ...bedroomUserBedPlaceholder,
      placeholderId: "placeholder-extreme-size",
      displaySizeMm: { width: 9000, depth: 9000 }
    };
    const extreme = validateLayoutIntent({ ...layoutBedroomUserBed, placeholders: [extremePlaceholder] }, scene, {
      validatedAt: p1FixtureTimestamp
    });
    const clearance = validateLayoutIntent({ ...layoutBedroomUserBed, placeholders: [conflictDoorClearancePlaceholder] }, scene, {
      validatedAt: p1FixtureTimestamp,
      affordanceGraph: buildRoomAffordanceGraphFromSceneContract(scene)
    });
    const unsupported = validateLayoutIntent({
      ...layoutBedroomUserBed,
      placeholders: [{ ...bedroomUserBedPlaceholder, category: "unsupported" }]
    }, scene, { validatedAt: p1FixtureTimestamp });
    const allMessages = [
      ...missing.issues,
      ...outside.issues,
      ...extreme.issues,
      ...clearance.issues,
      ...unsupported.issues
    ].map((issue) => issue.message).join("\n");

    expect(missing.canConfirm).toBe(false);
    expect(outside.canConfirm).toBe(false);
    expect(extreme.canConfirm).toBe(false);
    expect(clearance.status).toBe("warning");
    expect(unsupported.canConfirm).toBe(false);
    expect(allMessages).not.toMatch(/load-bearing|construction risk|GB compliance|building code|PDF|DWG|DXF/i);
  });

  it("confirms valid layout intent into readonly contract and rejects invalid confirm", () => {
    const { scene } = confirmedSceneFixture();
    const valid = {
      ...layoutBedroomUserBed,
      homeId: scene.homeId,
      canonicalRevisionId: scene.canonicalRevisionId,
      sceneContractId: scene.sceneContractId,
      geometryHash: scene.geometryHash
    };
    const confirmed = confirmLayoutIntentRevision(valid, scene, {
      layoutIntentContractId: "layout-contract-valid",
      confirmedAt: p1FixtureTimestamp
    });
    const invalid = confirmLayoutIntentRevision({ ...valid, placeholders: [invalidMissingRoomPlaceholder] }, scene, {
      layoutIntentContractId: "layout-contract-invalid",
      confirmedAt: p1FixtureTimestamp
    });

    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.layoutIntentContract.readonly).toBe(true);
      expect(confirmed.layoutIntentContract.constraints.mayMutateGeometry).toBe(false);
    }
    expect(invalid.ok).toBe(false);
  });
});

describe("Layout Intent API boundary and events", () => {
  it("starts after P1 confirm, applies operations, validates, confirms, fetches contract, and updates debug", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    expect(() => postLayoutIntentSession(context, simpleRectangleHome.homeId)).toThrow();
    const p1Session = postP1Session(context, simpleRectangleHome.homeId);
    const p1Confirmed = postP1ConfirmDraft(context, p1Session.draftRevisionId);
    if (!p1Confirmed.ok) {
      throw new Error("Expected P1 confirm to succeed.");
    }

    const layoutSession = postLayoutIntentSession(context, simpleRectangleHome.homeId);
    const fetched = getLayoutIntentRevision(context, layoutSession.layoutIntentRevisionId);
    const patched = patchLayoutIntentOperations(context, layoutSession.layoutIntentRevisionId, {
      operations: [op("op-api-layout-add", "layout.placeholder.add", { placeholder: bedroomUserBedPlaceholder })]
    });
    const validation = postLayoutIntentValidate(context, layoutSession.layoutIntentRevisionId);
    const confirmed = postLayoutIntentConfirm(context, layoutSession.layoutIntentRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected layout confirm to succeed.");
    }
    const contract = getLayoutIntentContract(context, layoutSession.layoutIntentRevisionId);
    const debug = getP1DebugPayload(context, simpleRectangleHome.homeId);

    expect(fetched.layoutIntentRevisionId).toBe(layoutSession.layoutIntentRevisionId);
    expect(patched.layoutIntentHash).not.toBe(layoutSession.layoutIntentHash);
    expect(validation.canConfirm).toBe(true);
    expect(confirmed.geometryHash).toBe(p1Confirmed.geometryHash);
    expect(contract.layoutIntentContractId).toBe(confirmed.layoutIntentContractId);
    expect(Object.isFrozen(contract)).toBe(true);
    expect(debug.activeLayoutIntentRevisionId).toBe(layoutSession.layoutIntentRevisionId);
    expect(debug.activeLayoutIntentHash).toBe(confirmed.layoutIntentHash);
    expect(debug.layoutPlaceholderSummary?.count).toBe(1);
    expect(debug.aiAutofillEnabled).toBe(true);
    expect(debug.layoutEvents.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "layout_intent_session_started",
      "layout_placeholder_added",
      "layout_intent_validated",
      "layout_intent_confirmed"
    ]));
  });

  it("rejects invalid layout confirm through API", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const p1Session = postP1Session(context, simpleRectangleHome.homeId);
    const p1Confirmed = postP1ConfirmDraft(context, p1Session.draftRevisionId);
    if (!p1Confirmed.ok) {
      throw new Error("Expected P1 confirm to succeed.");
    }
    const layoutSession = postLayoutIntentSession(context, simpleRectangleHome.homeId);
    patchLayoutIntentOperations(context, layoutSession.layoutIntentRevisionId, {
      operations: [op("op-api-layout-invalid", "layout.placeholder.add", { placeholder: invalidMissingRoomPlaceholder })]
    });

    const confirmed = postLayoutIntentConfirm(context, layoutSession.layoutIntentRevisionId);

    expect(confirmed.ok).toBe(false);
    if (!confirmed.ok) {
      expect(confirmed.validation.canConfirm).toBe(false);
    }
  });

  it("validates layout event schema and emits traceable layout events", () => {
    const repositories = createInMemoryP1Repositories();
    const event = emitLayoutIntentEvent(repositories.layoutEvents, {
      eventId: "event-layout-add",
      eventType: "layout_placeholder_added",
      homeId: layoutBedroomUserBed.homeId,
      anonymousSessionId: "anonymous-layout",
      canonicalRevisionId: layoutBedroomUserBed.canonicalRevisionId,
      sceneContractId: layoutBedroomUserBed.sceneContractId,
      geometryHash: layoutBedroomUserBed.geometryHash,
      layoutIntentRevisionId: layoutBedroomUserBed.layoutIntentRevisionId,
      layoutIntentHash: layoutBedroomUserBed.layoutIntentHash,
      placeholderId: bedroomUserBedPlaceholder.placeholderId,
      timestamp: p1FixtureTimestamp
    });

    expect(event.source).toBe("layout_intent");
    expect(LayoutIntentEventSchema.safeParse({ ...event, anonymousSessionId: undefined }).success).toBe(false);
  });
});

describe("Layout Intent invalidation and AnchorPlanner adapter", () => {
  it("preserves geometry artifacts and invalidates only layout-dependent artifacts on layout changes", () => {
    const previous = layoutEmptyAutofillOn.layoutIntentHash;
    const next = layoutBedroomUserBed.layoutIntentHash;
    const dependencies: LayoutIntentArtifactDependency[] = [
      dependency("dep-anchor", "AnchorPlan", previous),
      dependency("dep-scheme", "SchemeLiteContract", previous),
      dependency("dep-render", "RenderJob", previous)
    ];
    const result = invalidateForLayoutIntentChange(dependencies, {
      previousLayoutIntentHash: previous,
      newLayoutIntentHash: next,
      invalidatedAt: p1FixtureTimestamp
    });

    expect(compareLayoutIntentHash(previous, next).changed).toBe(true);
    expect(result.summary.invalidatedDependencyIds).toEqual(["dep-anchor", "dep-render", "dep-scheme"]);
    expect(result.dependencies.every((item) => !item.active)).toBe(true);
    expect(result.summary.preservedGeometryArtifacts).toEqual(preserveGeometryArtifactsForLayoutOnlyChange());
  });

  it("preserves all for no-op layout hash and archives layout intent when geometry no longer matches", () => {
    const noOp = invalidateForLayoutIntentChange([dependency("dep-anchor-noop", "AnchorPlan", layoutBedroomUserBed.layoutIntentHash)], {
      previousLayoutIntentHash: layoutBedroomUserBed.layoutIntentHash,
      newLayoutIntentHash: layoutBedroomUserBed.layoutIntentHash,
      invalidatedAt: p1FixtureTimestamp
    });
    const { scene } = confirmedSceneFixture();
    const changedScene = {
      ...scene,
      geometryHash: `sha256:${"2".repeat(64)}`,
      rooms: scene.rooms.filter((room) => room.roomId !== bedroomUserBedPlaceholder.roomId)
    } as P1SceneContractV02;
    const archived = invalidateLayoutIntentIfGeometryChanged({
      ...layoutBedroomUserBed,
      homeId: scene.homeId,
      canonicalRevisionId: scene.canonicalRevisionId,
      sceneContractId: scene.sceneContractId,
      geometryHash: scene.geometryHash
    }, changedScene);

    expect(noOp.summary.invalidatedDependencyIds).toEqual([]);
    expect(noOp.dependencies[0]?.active).toBe(true);
    expect(archived.archivedLayoutIntentRevisionIds).toEqual([layoutBedroomUserBed.layoutIntentRevisionId]);
  });

  it("builds AnchorPlanner input with user placeholders and autofill rules", () => {
    const { scene } = confirmedSceneFixture();
    const layout = {
      ...layoutBedroomUserBed,
      homeId: scene.homeId,
      canonicalRevisionId: scene.canonicalRevisionId,
      sceneContractId: scene.sceneContractId,
      geometryHash: scene.geometryHash
    };
    const contract = buildLayoutIntentContract(layout, scene, {
      layoutIntentContractId: "layout-contract-adapter",
      createdAt: p1FixtureTimestamp
    });
    const graph = buildRoomAffordanceGraphFromSceneContract(scene);
    const enabled = buildAnchorPlannerInputContract(contract, [graph]);
    const disabled = buildAnchorPlannerInputContract({ ...contract, aiAutofillEnabled: false }, [graph]);

    expect(enabled.userPlaceholders).toHaveLength(layout.placeholders.length);
    expect(enabled.rules.mayAutofillMissingAnchors).toBe(true);
    expect(disabled.rules.mayAutofillMissingAnchors).toBe(false);
    expect(enabled.rules.mayMoveUserPlaceholders).toBe(false);
    expect(enabled.rules.mayMutateGeometry).toBe(false);
    expect(enabled.geometryHash).toBe(scene.geometryHash);
    expect(enabled.layoutIntentHash).toBe(layout.layoutIntentHash);
  });
});

function confirmedSceneFixture() {
  const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
  const p1Session = postP1Session(context, simpleRectangleHome.homeId);
  const p1Confirmed = postP1ConfirmDraft(context, p1Session.draftRevisionId);
  if (!p1Confirmed.ok) {
    throw new Error("Expected P1 confirm to succeed.");
  }
  const canonical = context.repositories.canonical.getCanonicalRevision(p1Confirmed.canonicalRevisionId);
  if (canonical === undefined) {
    throw new Error("Expected canonical revision.");
  }
  const scene = createSceneContractV02(canonical, {
    sceneContractId: p1Confirmed.sceneContractId,
    createdAt: p1FixtureTimestamp
  });
  const canonicalSnapshot = JSON.stringify(canonical);
  return {
    canonical,
    scene,
    canonicalBefore: () => canonicalSnapshot,
    sceneBefore: JSON.stringify(scene)
  };
}

function applyOps(
  layoutIntent: LayoutIntentRevision,
  scene: P1SceneContractV02,
  operations: LayoutIntentOperation[]
): LayoutIntentRevision {
  return applyLayoutIntentOperations(layoutIntent, operations, {
    sceneContract: scene,
    updatedAt: operations[operations.length - 1]?.createdAt ?? p1FixtureTimestamp
  });
}

function op(
  operationId: string,
  operationType: LayoutIntentOperation["operationType"],
  payload: Record<string, unknown>,
  placeholderId?: string
): LayoutIntentOperation {
  return {
    operationId,
    operationType,
    ...(placeholderId === undefined ? {} : { placeholderId }),
    actor: "user",
    payload,
    createdAt: p1FixtureTimestamp
  };
}

function dependency(
  dependencyId: string,
  artifactType: LayoutIntentArtifactDependency["artifactType"],
  layoutIntentHash: string
): LayoutIntentArtifactDependency {
  return {
    dependencyId,
    artifactId: `artifact-${dependencyId}`,
    artifactType,
    homeId: layoutBedroomUserBed.homeId,
    canonicalRevisionId: layoutBedroomUserBed.canonicalRevisionId,
    sceneContractId: layoutBedroomUserBed.sceneContractId,
    geometryHash: layoutBedroomUserBed.geometryHash,
    layoutIntentRevisionId: layoutBedroomUserBed.layoutIntentRevisionId,
    layoutIntentHash,
    status: "active",
    active: true,
    createdAt: p1FixtureTimestamp
  };
}
