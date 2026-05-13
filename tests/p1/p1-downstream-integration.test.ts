import { describe, expect, it } from "vitest";
import {
  P1AnchorPlanSchema,
  P1DownstreamCoverageReportSchema,
  P1RoomAffordanceGraphSchema,
  P1RoomCameraPlanBatchSchema,
  P1WhiteModelSchema,
  type GeometryHash,
  type P1SceneContractV02
} from "@homeai/contracts";
import { createCanonicalFloorplanRevision } from "@homeai/geometry";
import {
  P1GeometryHashMismatchError,
  buildAnchorPlanFromAffordanceGraph,
  buildCameraPlanFromSceneContract,
  buildFullSpaceCoverageFromSceneContract,
  buildRoomAffordanceGraphFromSceneContract,
  buildWhiteModelFromSceneContract,
  createSceneContractV02
} from "@homeai/scene";
import {
  getP1DebugPayload,
  postP1ConfirmDraft,
  postP1Session
} from "@homeai/floorplan-parser";
import {
  homeWithBayWindow,
  p1FixtureTimestamp,
  simpleRectangleHome,
  validP1DraftFixtures
} from "../fixtures/p1/index.js";
import { apiContext } from "./p1-api-boundary.test.js";

const mismatchedHash = `sha256:${"0".repeat(64)}` as GeometryHash;

describe("P1 downstream integration hardening", () => {
  it("builds traceable downstream baseline artifacts for every valid room", () => {
    for (const [fixtureName, draft] of Object.entries(validP1DraftFixtures)) {
      const canonical = createCanonicalFloorplanRevision(draft, {
        canonicalRevisionId: `canonical-downstream-${fixtureName}`,
        version: 1,
        confirmedAt: p1FixtureTimestamp
      });
      const scene = createSceneContractV02(canonical, {
        sceneContractId: `scene-downstream-${fixtureName}`,
        createdAt: p1FixtureTimestamp
      });
      const bundle = buildFullSpaceCoverageFromSceneContract(scene, {
        expectedGeometryHash: canonical.geometryHash,
        createdAt: p1FixtureTimestamp
      });

      expect(bundle.coverageReport.status).toBe("ready");
      expect(bundle.coverageReport.roomCoverage).toHaveLength(scene.rooms.length);
      expect(bundle.coverageReport.roomCoverage.every((room) => room.status === "covered")).toBe(true);
      for (const artifact of [
        bundle.whiteModel,
        bundle.controlScene,
        bundle.cameraPlan,
        bundle.affordanceGraph,
        bundle.anchorPlan,
        bundle.coverageReport
      ]) {
        expect(artifact.homeId).toBe(scene.homeId);
        expect(artifact.canonicalRevisionId).toBe(scene.canonicalRevisionId);
        expect(artifact.sceneContractId).toBe(scene.sceneContractId);
        expect(artifact.geometryHash).toBe(scene.geometryHash);
        expect(artifact.status).toBe("ready");
        expect(artifact.issues).toEqual([]);
        expect(artifact.createdAt).toBe(p1FixtureTimestamp);
      }
    }
  });

  it("fails closed with a structured error when geometryHash does not match", () => {
    const scene = sceneFixture("hash-mismatch");
    const graph = buildRoomAffordanceGraphFromSceneContract(scene);

    for (const build of [
      () => buildWhiteModelFromSceneContract(scene, { expectedGeometryHash: mismatchedHash }),
      () => buildCameraPlanFromSceneContract(scene, { expectedGeometryHash: mismatchedHash }),
      () => buildRoomAffordanceGraphFromSceneContract(scene, { expectedGeometryHash: mismatchedHash }),
      () => buildAnchorPlanFromAffordanceGraph(graph, { expectedGeometryHash: mismatchedHash }),
      () => buildFullSpaceCoverageFromSceneContract(scene, { expectedGeometryHash: mismatchedHash })
    ]) {
      let error: unknown;
      try {
        build();
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(P1GeometryHashMismatchError);
      expect((error as P1GeometryHashMismatchError).toJSON()).toMatchObject({
        code: "GEOMETRY_HASH_MISMATCH",
        expectedGeometryHash: mismatchedHash,
        actualGeometryHash: scene.geometryHash
      });
    }
  });

  it("does not mutate canonical revisions or readonly SceneContract while building downstream artifacts", () => {
    const canonical = createCanonicalFloorplanRevision(simpleRectangleHome, {
      canonicalRevisionId: "canonical-downstream-immutability",
      version: 1,
      confirmedAt: p1FixtureTimestamp
    });
    const canonicalBefore = JSON.stringify(canonical);
    const scene = createSceneContractV02(canonical, {
      sceneContractId: "scene-downstream-immutability",
      createdAt: p1FixtureTimestamp
    });
    const sceneBefore = JSON.stringify(scene);
    const bundle = buildFullSpaceCoverageFromSceneContract(scene);

    expect(JSON.stringify(canonical)).toBe(canonicalBefore);
    expect(JSON.stringify(scene)).toBe(sceneBefore);
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(bundle.whiteModel)).toBe(true);
    expect(() => {
      (scene.rooms as unknown as unknown[]).push({});
    }).toThrow();
  });

  it("keeps bay window projection as opening metadata without changing wall topology", () => {
    const canonical = createCanonicalFloorplanRevision(homeWithBayWindow, {
      canonicalRevisionId: "canonical-downstream-bay-window",
      version: 1,
      confirmedAt: p1FixtureTimestamp
    });
    const scene = createSceneContractV02(canonical, {
      sceneContractId: "scene-downstream-bay-window",
      createdAt: p1FixtureTimestamp
    });
    const wallsBefore = JSON.stringify(scene.walls);
    const whiteModel = buildWhiteModelFromSceneContract(scene);
    const bayProxy = whiteModel.openingProxies.find((opening) => opening.openingId === "window-bay-1");

    expect(JSON.stringify(scene.walls)).toBe(wallsBefore);
    expect(whiteModel.walls).toHaveLength(scene.walls.length);
    expect(bayProxy).toMatchObject({
      type: "window",
      windowKind: "bay",
      projectionDepthMm: 600,
      projectionSide: "exterior",
      blocksWallTopology: false
    });
  });

  it("rejects missing trace fields in downstream artifact contracts", () => {
    const scene = sceneFixture("contract-trace");
    const whiteModel = buildWhiteModelFromSceneContract(scene);
    const cameraPlan = buildCameraPlanFromSceneContract(scene);
    const graph = buildRoomAffordanceGraphFromSceneContract(scene);
    const anchorPlan = buildAnchorPlanFromAffordanceGraph(graph);
    const coverage = buildFullSpaceCoverageFromSceneContract(scene).coverageReport;

    expect(P1WhiteModelSchema.safeParse({ ...whiteModel, geometryHash: undefined }).success).toBe(false);
    expect(P1RoomCameraPlanBatchSchema.safeParse({ ...cameraPlan, sceneContractId: undefined }).success).toBe(false);
    expect(P1RoomAffordanceGraphSchema.safeParse({ ...graph, canonicalRevisionId: undefined }).success).toBe(false);
    expect(P1AnchorPlanSchema.safeParse({ ...anchorPlan, source: "scene_contract_v0.2" }).success).toBe(false);
    expect(P1DownstreamCoverageReportSchema.safeParse({ ...coverage, status: "active" }).success).toBe(false);
  });

  it("rejects attempts to use a draft as a downstream SceneContract", () => {
    expect(() =>
      buildWhiteModelFromSceneContract(simpleRectangleHome as unknown as P1SceneContractV02)
    ).toThrow();
  });

  it("adds downstream baseline summaries to the P1 debug payload", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const session = postP1Session(context, simpleRectangleHome.homeId);
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected P1 confirm to succeed.");
    }

    const debug = getP1DebugPayload(context, simpleRectangleHome.homeId);

    expect(debug.downstreamBaselineSummary?.whiteModel.geometryHash).toBe(confirmed.geometryHash);
    expect(debug.downstreamBaselineSummary?.controlScene.geometryHash).toBe(confirmed.geometryHash);
    expect(debug.downstreamBaselineSummary?.cameraPlan.roomPlanCount).toBe(debug.sceneContract?.rooms.length);
    expect(debug.downstreamBaselineSummary?.roomAffordanceGraph.roomCount).toBe(debug.sceneContract?.rooms.length);
    expect(debug.downstreamBaselineSummary?.anchorPlan.anchorCount).toBeGreaterThan(0);
    expect(debug.downstreamBaselineSummary?.coverageReport.status).toBe("ready");
  });
});

function sceneFixture(seed: string) {
  const canonical = createCanonicalFloorplanRevision(simpleRectangleHome, {
    canonicalRevisionId: `canonical-downstream-${seed}`,
    version: 1,
    confirmedAt: p1FixtureTimestamp
  });
  return createSceneContractV02(canonical, {
    sceneContractId: `scene-downstream-${seed}`,
    createdAt: p1FixtureTimestamp
  });
}
