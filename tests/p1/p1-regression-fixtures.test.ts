import { describe, expect, it } from "vitest";
import { P1SceneContractV02Schema } from "@homeai/contracts";
import { createCanonicalFloorplanRevision } from "@homeai/geometry";
import {
  buildRoomAffordanceGraph,
  buildWhiteModelFromSceneContract,
  createRoomCameraPlans,
  createSceneContractV02,
  planAnchors
} from "@homeai/scene";
import {
  invalidP1DraftFixtures,
  p1FixtureTimestamp,
  validP1DraftFixtures
} from "../fixtures/p1/index.js";

describe("P01-P05 P1 regression fixtures", () => {
  it("P01 confirms valid draft fixtures and rejects invalid drafts", () => {
    for (const [fixtureName, draft] of Object.entries(validP1DraftFixtures)) {
      const canonical = createCanonicalFloorplanRevision(draft, {
        canonicalRevisionId: `canonical-${fixtureName}`,
        version: 1,
        confirmedAt: p1FixtureTimestamp
      });

      expect(canonical.confirmedByUser).toBe(true);
      expect(canonical.geometryHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(Object.isFrozen(canonical)).toBe(true);
    }

    for (const draft of Object.values(invalidP1DraftFixtures)) {
      expect(() =>
        createCanonicalFloorplanRevision(draft, {
          canonicalRevisionId: `canonical-${draft.homeId}`,
          version: 1,
          confirmedAt: p1FixtureTimestamp
        })
      ).toThrow();
    }
  });

  it("P02 creates readonly SceneContract v0.2 with geometryHash", () => {
    const canonical = canonicalFixture("simple_rectangle_home");
    const before = JSON.stringify(canonical);
    const scene = createSceneContractV02(canonical);

    expect(scene.version).toBe("0.2");
    expect(scene.readonly).toBe(true);
    expect(scene.canonicalRevisionId).toBe(canonical.canonicalRevisionId);
    expect(scene.geometryHash).toBe(canonical.geometryHash);
    expect(P1SceneContractV02Schema.safeParse({ ...scene, geometryHash: undefined }).success).toBe(false);
    expect(JSON.stringify(canonical)).toBe(before);
  });

  it("P03 white model accepts SceneContract fixture", () => {
    const scene = createSceneContractV02(canonicalFixture("home_with_bay_window"));
    const whiteModel = buildWhiteModelFromSceneContract(scene);

    expect(whiteModel.sceneContractId).toBe(scene.sceneContractId);
    expect(whiteModel.geometryHash).toBe(scene.geometryHash);
    expect(whiteModel.rooms.length).toBe(scene.rooms.length);
  });

  it("P04 camera planner creates a camera plan for every valid room", () => {
    const scene = createSceneContractV02(canonicalFixture("home_with_balcony"));
    const cameraBatch = createRoomCameraPlans(scene);

    expect(cameraBatch.geometryHash).toBe(scene.geometryHash);
    expect(cameraBatch.roomPlans).toHaveLength(scene.rooms.length);
    expect(cameraBatch.roomPlans.every((plan) => plan.cameras.length >= 1)).toBe(true);
  });

  it("P05 affordance graph and anchors accept baseline fixture without blocking openings", () => {
    const scene = createSceneContractV02(canonicalFixture("simple_rectangle_home"));
    const graph = buildRoomAffordanceGraph(scene);
    const anchorPlan = planAnchors(graph, scene);

    expect(graph.geometryHash).toBe(scene.geometryHash);
    expect(anchorPlan.geometryHash).toBe(scene.geometryHash);
    expect(anchorPlan.anchors.length).toBeGreaterThan(0);
    expect(anchorPlan.anchors.every((anchor) => anchor.blocksDoorOrWindow === false)).toBe(true);
  });

  it("keeps bay windows as opening metadata without mutating wall topology", () => {
    const draft = validP1DraftFixtures.home_with_bay_window;
    const canonical = canonicalFixture("home_with_bay_window");

    expect(canonical.walls).toHaveLength(draft.walls.length);
    expect(canonical.openings[0]).toMatchObject({
      type: "window",
      windowKind: "bay",
      projectionDepthMm: 600,
      projectionSide: "exterior"
    });
  });

  it("keeps balcony as independent room-like space", () => {
    const canonical = canonicalFixture("home_with_balcony");
    const balcony = canonical.rooms.find((room) => room.roomType === "balcony");

    expect(balcony).toBeDefined();
    expect(balcony).toMatchObject({
      roomType: "balcony",
      balconyMeta: {
        adjacentInteriorRoomIds: ["room-bal-living"],
        connectionWallIds: ["wall-bal-main-north"]
      }
    });
  });
});

function canonicalFixture(fixtureName: keyof typeof validP1DraftFixtures) {
  return createCanonicalFloorplanRevision(validP1DraftFixtures[fixtureName], {
    canonicalRevisionId: `canonical-${fixtureName}`,
    version: 1,
    confirmedAt: p1FixtureTimestamp
  });
}
