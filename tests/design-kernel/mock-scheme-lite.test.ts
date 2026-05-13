import { describe, expect, it } from "vitest";
import {
  assertSchemeLiteFullSpaceCoverage,
  buildDesignKernelInputFromP1Artifacts,
  buildDesignKernelDebugPayload,
  compileMockSchemeLite,
  verifySchemeLiteContract
} from "@homeai/design-kernel";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";

describe("deterministic mock SchemeLite compiler", () => {
  it("produces deterministic immutable SchemeLite output", () => {
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const left = compileMockSchemeLite(input);
    const right = compileMockSchemeLite(input);

    expect(left).toEqual(right);
    expect(Object.isFrozen(left)).toBe(true);
    expect(() => {
      (left.rooms as unknown as unknown[]).push({});
    }).toThrow();
    expect(left.trace.networkCalls).toBe(false);
    expect(left.verification.status).toBe("pass");
  });

  it("covers every SceneContract room exactly once, including balcony rooms", () => {
    const { input, sceneContract } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const scheme = compileMockSchemeLite(input);
    const sceneRoomIds = sceneContract.rooms.map((room) => room.roomId).sort();
    const schemeRoomIds = scheme.rooms.map((room) => room.roomId).sort();
    const balcony = scheme.rooms.find((room) => room.roomType === "balcony");

    expect(schemeRoomIds).toEqual(sceneRoomIds);
    expect(new Set(schemeRoomIds).size).toBe(sceneRoomIds.length);
    expect(balcony).toBeDefined();
    expect(balcony?.role).toBe("balcony");
    expect(() => assertSchemeLiteFullSpaceCoverage(input, scheme)).not.toThrow();
  });

  it("preserves room types and separates layoutIntentHash from geometryHash", () => {
    const { input, sceneContract } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const scheme = compileMockSchemeLite(input);

    for (const sceneRoom of sceneContract.rooms) {
      const roomScheme = scheme.rooms.find((room) => room.roomId === sceneRoom.roomId);
      expect(roomScheme?.roomType).toBe(sceneRoom.roomType);
      expect(roomScheme?.geometryHash).toBe(sceneContract.geometryHash);
      expect(roomScheme?.layoutIntentHash).toBe(input.layoutIntentHash);
    }
    expect(scheme.geometryHash).toBe(sceneContract.geometryHash);
    expect(scheme.layoutIntentHash).toBe(input.layoutIntentHash);
    expect(scheme.layoutIntentHash).not.toBe(scheme.geometryHash);
  });

  it("references only existing anchors and layout placeholders without final coordinates", () => {
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const scheme = compileMockSchemeLite(input);
    const anchorIds = new Set(input.anchorPlans.flatMap((plan) => plan.anchors.map((anchor) => `${plan.anchorPlanId}:${anchor.anchorId}`)));
    const placeholderIds = new Set(input.layoutIntentContract?.placeholders.map((placeholder) => placeholder.placeholderId) ?? []);
    const serializedRooms = JSON.stringify(scheme.rooms);

    for (const room of scheme.rooms) {
      for (const ref of room.anchorRefs) {
        expect(anchorIds.has(`${ref.anchorPlanId}:${ref.anchorId}`)).toBe(true);
      }
      for (const ref of room.layoutIntentRefs) {
        expect(placeholderIds.has(ref.placeholderId)).toBe(true);
      }
    }
    expect(serializedRooms).not.toMatch(/"center"|"position"|"rotationDeg"|"displaySizeMm"|"x"|"y"/);
  });

  it("returns warning status for partial anchor coverage without dropping rooms", () => {
    const bundle = createDesignKernelFixtureBundle();
    const sparseAnchorPlan = {
      ...bundle.anchorPlan,
      anchors: []
    };
    const input = buildDesignKernelInputFromP1Artifacts({
      inputId: "input-sparse-anchor",
      homeId: bundle.sceneContract.homeId,
      floorplanRevisionId: bundle.sceneContract.canonicalRevisionId,
      sceneContractId: bundle.sceneContract.sceneContractId,
      geometryHash: bundle.sceneContract.geometryHash,
      sceneContract: bundle.sceneContract,
      roomAffordanceGraph: bundle.roomAffordanceGraph,
      anchorPlans: [sparseAnchorPlan],
      cameraPlan: bundle.cameraPlan,
      userBriefInput: bundle.userBriefInput,
      source: "fixture"
    });
    const scheme = compileMockSchemeLite(input);

    expect(scheme.rooms).toHaveLength(bundle.sceneContract.rooms.length);
    expect(scheme.verification.status).toBe("warning");
    expect(scheme.rooms.every((room) => room.status === "warning")).toBe(true);
  });

  it("detects coverage failures", () => {
    const { input } = createDesignKernelFixtureBundle();
    const scheme = compileMockSchemeLite(input);
    const incomplete = {
      ...scheme,
      rooms: scheme.rooms.slice(0, 1)
    };
    const verification = verifySchemeLiteContract(input, incomplete);

    expect(verification.status).toBe("fail");
    expect(() => assertSchemeLiteFullSpaceCoverage(input, incomplete)).toThrow();
  });

  it("builds debug payload with coverage counters", () => {
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const debug = buildDesignKernelDebugPayload(input);

    expect(debug.coverage.sceneRoomCount).toBe(input.sceneContract.rooms.length);
    expect(debug.coverage.roomSchemeCount).toBe(input.sceneContract.rooms.length);
    expect(debug.coverage.hasLayoutIntent).toBe(true);
    expect(debug.trace.networkCalls).toBe(false);
  });
});
