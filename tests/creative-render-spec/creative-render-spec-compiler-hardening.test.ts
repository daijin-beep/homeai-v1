import { describe, expect, it } from "vitest";
import type {
  CreativeRenderAssetRef,
  P1RoomCameraPlanBatch,
  P1RoomType,
  SchemeLiteContract
} from "@homeai/contracts";
import {
  ADS_FREEZE_REQUIRED_FORBIDDEN_CHANGES,
  CREATIVE_RENDER_REQUIRED_ASSET_KINDS,
  compileCreativeRenderSpecsForScheme,
  validateCreativeRenderSpecCoverage,
  validateCreativeRenderSpecForADS,
  type CreativeRenderSpecCompilerInput
} from "@homeai/creative-render-spec";
import { compileMockSchemeLite } from "@homeai/design-kernel";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";

describe("CreativeRenderSpec compiler hardening", () => {
  it("compiles ADS-consumable specs for every valid room and renderable camera", () => {
    const input = compilerFixtureInput({ addSecondCameraToFirstRoom: true });
    const output = compileCreativeRenderSpecsForScheme(input);
    const sceneRoomIds = input.sceneContract.rooms.map((room) => room.roomId).sort();
    const summaryRoomIds = output.summary.rooms.map((room) => room.roomId).sort();
    const renderableCameraCount = input.cameraPlan.roomPlans.reduce((count, plan) => count + plan.cameras.length, 0);

    expect(output.summary.status).toBe("pass");
    expect(output.specs).toHaveLength(renderableCameraCount);
    expect(summaryRoomIds).toEqual(sceneRoomIds);
    expect(new Set(summaryRoomIds).size).toBe(sceneRoomIds.length);
    expect(output.summary.rooms.every((room) => room.status === "covered")).toBe(true);
    expect(output.summary.emittedSpecCount).toBe(renderableCameraCount);
    expect(output.specs.every((spec) => validateCreativeRenderSpecForADS(spec, adsContext(input)).status !== "fail")).toBe(true);
    expect(Object.isFrozen(output)).toBe(true);
  });

  it("fails when only key rooms have specs and SceneContract rooms are missing", () => {
    const input = compilerFixtureInput();
    const keyOnlyScheme = {
      ...input.schemeLiteContract,
      rooms: input.schemeLiteContract.rooms.slice(0, 1)
    };
    const output = compileCreativeRenderSpecsForScheme({
      ...input,
      schemeLiteContract: keyOnlyScheme
    });

    expect(output.summary.status).toBe("fail");
    expect(output.summary.rooms).toHaveLength(input.sceneContract.rooms.length);
    expect(output.issues.some((issue) => issue.code === "SCHEME_ROOM_MISSING")).toBe(true);
    expect(output.summary.rooms.some((room) => room.status === "missing_scheme_room")).toBe(true);
  });

  it("reports a missing camera plan without generating a fake spec", () => {
    const input = compilerFixtureInput();
    const missingRoomId = input.sceneContract.rooms[0]?.roomId;
    if (missingRoomId === undefined) {
      throw new Error("Expected a scene room.");
    }
    const cameraPlan = {
      ...input.cameraPlan,
      roomPlans: input.cameraPlan.roomPlans.filter((plan) => plan.roomId !== missingRoomId)
    };
    const output = compileCreativeRenderSpecsForScheme({
      ...input,
      cameraPlan
    });

    expect(output.summary.status).toBe("fail");
    expect(output.issues.some((issue) => issue.code === "CAMERA_PLAN_MISSING" && issue.roomId === missingRoomId)).toBe(true);
    expect(output.specs.some((spec) => spec.roomId === missingRoomId)).toBe(false);
  });

  it("reports a missing control asset and blocks that camera spec", () => {
    const input = compilerFixtureInput();
    const targetRoomId = input.sceneContract.rooms[0]?.roomId;
    if (targetRoomId === undefined) {
      throw new Error("Expected a scene room.");
    }
    const output = compileCreativeRenderSpecsForScheme({
      ...input,
      controlSceneAssets: input.controlSceneAssets.filter((asset) =>
        !(asset.roomId === targetRoomId && asset.kind === "control_render")
      )
    });

    expect(output.summary.status).toBe("fail");
    expect(output.issues).toContainEqual(expect.objectContaining({
      severity: "blocking",
      code: "REQUIRED_INPUT_ASSET_MISSING",
      roomId: targetRoomId,
      assetKind: "control_render"
    }));
    expect(output.specs.some((spec) => spec.roomId === targetRoomId)).toBe(false);
  });

  it("fails closed on geometryHash mismatch and emits no valid specs", () => {
    const input = compilerFixtureInput();
    const mismatched = replaceSchemeGeometryHash(input.schemeLiteContract, `sha256:${"a".repeat(64)}`);
    const output = compileCreativeRenderSpecsForScheme({
      ...input,
      schemeLiteContract: mismatched
    });

    expect(output.summary.status).toBe("fail");
    expect(output.specs).toHaveLength(0);
    expect(output.issues.some((issue) => issue.code === "GEOMETRY_HASH_MISMATCH")).toBe(true);
    expect(output.summary.rooms.every((room) => room.status === "geometry_hash_mismatch")).toBe(true);
  });

  it("keeps cautious kitchen and bathroom rooms in coverage with room-level status", () => {
    const input = compilerFixtureInput();
    const kitchenInput = withFirstRoomType(input, "kitchen");
    const output = compileCreativeRenderSpecsForScheme(kitchenInput);
    const kitchenRoom = output.summary.rooms.find((room) => room.roomType === "kitchen");

    expect(output.summary.status).toBe("pass");
    expect(kitchenRoom?.status).toBe("cautious");
    expect(kitchenRoom?.emittedSpecCount).toBeGreaterThan(0);
  });

  it("retains non-renderable room status without silently dropping the room", () => {
    const input = withFirstRoomType(compilerFixtureInput(), "bathroom");
    const output = compileCreativeRenderSpecsForScheme({
      ...input,
      policy: {
        includeCautiousRooms: false,
        minSpecsPerValidRoom: 1
      }
    });
    const bathroomRoom = output.summary.rooms.find((room) => room.roomType === "bathroom");

    expect(output.summary.status).toBe("warning");
    expect(bathroomRoom?.status).toBe("non_renderable");
    expect(bathroomRoom?.emittedSpecCount).toBe(0);
    expect(output.summary.rooms).toHaveLength(input.sceneContract.rooms.length);
  });

  it("preserves geometryHash, required assets, hard constraints, and forbidden directives", () => {
    const input = compilerFixtureInput();
    const output = compileCreativeRenderSpecsForScheme(input);

    for (const spec of output.specs) {
      expect(spec.geometryHash).toBe(input.sceneContract.geometryHash);
      expect(spec.inputs.controlRender.uri).toBeTruthy();
      expect(spec.inputs.depthMap.uri).toBeTruthy();
      expect(spec.inputs.semanticMask.uri).toBeTruthy();
      expect(spec.inputs.lineMap.uri).toBeTruthy();
      expect(spec.inputs.lockedGeometryMask.uri).toBeTruthy();
      expect(spec.inputs.anchorLayoutMask.uri).toBeTruthy();
      expect(Object.values(spec.hardConstraints).every((value) => value === true)).toBe(true);
      expect(spec.promptDirectives.forbiddenChanges).toEqual(expect.arrayContaining([
        "no wall changes",
        "no door changes",
        "no window changes",
        "no room proportion changes",
        "no anchor zone movement",
        "no geometryHash changes",
        "no confirmed geometry changes"
      ]));
    }
    expect(ADS_FREEZE_REQUIRED_FORBIDDEN_CHANGES).toContain("no geometryHash changes");
    expect(ADS_FREEZE_REQUIRED_FORBIDDEN_CHANGES).toContain("no confirmed geometry changes");
  });

  it("does not mutate SceneContract, SchemeLiteContract, CameraPlan, or asset refs", () => {
    const input = compilerFixtureInput();
    const sceneSnapshot = JSON.stringify(input.sceneContract);
    const schemeSnapshot = JSON.stringify(input.schemeLiteContract);
    const cameraSnapshot = JSON.stringify(input.cameraPlan);
    const assetSnapshot = JSON.stringify(input.controlSceneAssets);

    compileCreativeRenderSpecsForScheme(input);

    expect(JSON.stringify(input.sceneContract)).toBe(sceneSnapshot);
    expect(JSON.stringify(input.schemeLiteContract)).toBe(schemeSnapshot);
    expect(JSON.stringify(input.cameraPlan)).toBe(cameraSnapshot);
    expect(JSON.stringify(input.controlSceneAssets)).toBe(assetSnapshot);
  });

  it("validates coverage without requiring the caller to consume specs", () => {
    const input = compilerFixtureInput();
    const result = validateCreativeRenderSpecCoverage(input);

    expect(result.summary.status).toBe("pass");
    expect(result.issues).toEqual([]);
    expect(result.trace.networkCalls).toBe(false);
  });
});

function compilerFixtureInput(options: { addSecondCameraToFirstRoom?: boolean } = {}): CreativeRenderSpecCompilerInput {
  const bundle = createDesignKernelFixtureBundle({ withLayoutIntent: true });
  const schemeLiteContract = compileMockSchemeLite(bundle.input);
  const cameraPlan = options.addSecondCameraToFirstRoom
    ? addSecondCamera(bundle.cameraPlan)
    : bundle.cameraPlan;

  return {
    schemeLiteContract,
    sceneContract: bundle.sceneContract,
    cameraPlan,
    controlSceneAssets: assetRefsForCameraPlan(cameraPlan),
    policy: {
      includeCautiousRooms: true,
      minSpecsPerValidRoom: 1
    }
  };
}

function assetRefsForCameraPlan(cameraPlan: P1RoomCameraPlanBatch): CreativeRenderAssetRef[] {
  return cameraPlan.roomPlans.flatMap((plan) =>
    CREATIVE_RENDER_REQUIRED_ASSET_KINDS.map((kind) => ({
      assetId: `asset-${kind}-${plan.roomId}`,
      kind,
      roomId: plan.roomId,
      geometryHash: cameraPlan.geometryHash,
      uri: `fixture://batch13/${plan.roomId}/${kind}`
    }))
  );
}

function addSecondCamera(cameraPlan: P1RoomCameraPlanBatch): P1RoomCameraPlanBatch {
  const clone = structuredClone(cameraPlan);
  const firstPlan = clone.roomPlans[0];
  const firstCamera = firstPlan?.cameras[0];
  if (firstPlan === undefined || firstCamera === undefined) {
    throw new Error("Expected at least one room camera.");
  }
  firstPlan.cameras.push({
    ...firstCamera,
    cameraId: `${firstCamera.cameraId}-detail`
  });
  return clone;
}

function replaceSchemeGeometryHash(scheme: SchemeLiteContract, geometryHash: string): SchemeLiteContract {
  return {
    ...scheme,
    geometryHash,
    roomRolePlan: {
      ...scheme.roomRolePlan,
      geometryHash
    },
    rooms: scheme.rooms.map((room) => ({
      ...room,
      geometryHash
    }))
  };
}

function withFirstRoomType(input: CreativeRenderSpecCompilerInput, roomType: P1RoomType): CreativeRenderSpecCompilerInput {
  const sceneContract = structuredClone(input.sceneContract);
  const schemeLiteContract = structuredClone(input.schemeLiteContract);
  const firstRoomId = sceneContract.rooms[0]?.roomId;
  if (firstRoomId === undefined) {
    throw new Error("Expected a scene room.");
  }
  sceneContract.rooms = sceneContract.rooms.map((room, index) =>
    index === 0 ? { ...room, roomType } : room
  );
  schemeLiteContract.rooms = schemeLiteContract.rooms.map((room) =>
    room.roomId === firstRoomId ? { ...room, roomType } : room
  );
  schemeLiteContract.roomRolePlan = {
    ...schemeLiteContract.roomRolePlan,
    rooms: schemeLiteContract.roomRolePlan.rooms.map((room) =>
      room.roomId === firstRoomId ? { ...room, roomType } : room
    )
  };

  return {
    ...input,
    sceneContract,
    schemeLiteContract
  };
}

function adsContext(input: CreativeRenderSpecCompilerInput) {
  return {
    homeId: input.sceneContract.homeId,
    floorplanRevisionId: input.sceneContract.canonicalRevisionId,
    sceneContractId: input.sceneContract.sceneContractId,
    geometryHash: input.sceneContract.geometryHash
  };
}
