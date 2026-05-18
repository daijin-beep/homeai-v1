import { describe, expect, it } from "vitest";
import {
  CreativeRenderSpecBatchSchema,
  CreativeRenderSpecCompilerOutputSchema,
  CreativeRenderSpecDispatchPayloadSchema,
  CreativeRenderSpecRoomCoverageSummarySchema,
  CreativeRenderSpecSchema
} from "@homeai/contracts";
import {
  buildCreativeRenderSpecAdsDispatchPayload,
  compileCreativeRenderSpecBatch,
  compileCreativeRenderSpecsForScheme,
  createCreativeRenderSpecFixtureInput
} from "@homeai/creative-render-spec";
import { compileMockSchemeLite } from "@homeai/design-kernel";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";

describe("CreativeRenderSpec contracts", () => {
  it("validates a CreativeRenderSpec and batch", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const batch = compileCreativeRenderSpecBatch(input);
    const firstSpec = batch.specs[0];

    expect(firstSpec).toBeDefined();
    expect(CreativeRenderSpecSchema.safeParse(firstSpec).success).toBe(true);
    expect(CreativeRenderSpecBatchSchema.safeParse(batch).success).toBe(true);
    expect(batch.geometryHash).toBe(input.scheme.geometryHash);
  });

  it("rejects invalid geometryHash and missing required asset refs", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const batch = compileCreativeRenderSpecBatch(input);
    const firstSpec = requireFirstSpec(batch);

    expect(CreativeRenderSpecSchema.safeParse({
      ...firstSpec,
      geometryHash: "not-a-hash"
    }).success).toBe(false);

    expect(CreativeRenderSpecSchema.safeParse({
      ...firstSpec,
      inputs: {
        ...firstSpec.inputs,
        depthMap: undefined
      }
    }).success).toBe(false);
  });

  it("requires hard constraints to be true", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const firstSpec = requireFirstSpec(compileCreativeRenderSpecBatch(input));

    expect(CreativeRenderSpecSchema.safeParse({
      ...firstSpec,
      hardConstraints: {
        ...firstSpec.hardConstraints,
        preserveWalls: false
      }
    }).success).toBe(false);
  });

  it("rejects mismatched batch trace and layoutIntentHash drift", () => {
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: true });
    const batch = compileCreativeRenderSpecBatch(input);

    expect(CreativeRenderSpecBatchSchema.safeParse({
      ...batch,
      geometryHash: `sha256:${"a".repeat(64)}`
    }).success).toBe(false);
    expect(CreativeRenderSpecBatchSchema.safeParse({
      ...batch,
      layoutIntentHash: `sha256:${"b".repeat(64)}`
    }).success).toBe(false);
  });

  it("allows absent layoutIntentHash when upstream is absent", () => {
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: false });
    const batch = compileCreativeRenderSpecBatch(input);

    expect(batch.layoutIntentHash).toBeUndefined();
    expect(batch.specs.every((spec) => spec.layoutIntentHash === undefined)).toBe(true);
    expect(CreativeRenderSpecBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("validates compiler coverage output and ADS dispatch payload", () => {
    const input = compilerFixtureInput();
    const output = compileCreativeRenderSpecsForScheme(input);
    const dispatch = buildCreativeRenderSpecAdsDispatchPayload(input);

    expect(CreativeRenderSpecCompilerOutputSchema.safeParse(output).success).toBe(true);
    expect(CreativeRenderSpecDispatchPayloadSchema.safeParse(dispatch).success).toBe(true);
    expect(dispatch.specs).toHaveLength(output.summary.emittedSpecCount);
    expect(dispatch.rooms.every((room) => room.status === "ready")).toBe(true);
  });

  it("rejects inconsistent compiler room coverage counts", () => {
    const input = compilerFixtureInput();
    const output = compileCreativeRenderSpecsForScheme(input);
    const firstRoom = requireFirstCoverageRoom(output.summary.rooms);

    expect(CreativeRenderSpecRoomCoverageSummarySchema.safeParse({
      ...firstRoom,
      emittedSpecCount: firstRoom.emittedSpecCount + 1
    }).success).toBe(false);

    expect(CreativeRenderSpecCompilerOutputSchema.safeParse({
      ...output,
      summary: {
        ...output.summary,
        emittedSpecCount: output.summary.emittedSpecCount + 1
      }
    }).success).toBe(false);
  });
});

function requireFirstSpec(batch: ReturnType<typeof compileCreativeRenderSpecBatch>) {
  const firstSpec = batch.specs[0];
  if (firstSpec === undefined) {
    throw new Error("Expected at least one render spec.");
  }
  return firstSpec;
}

function requireFirstCoverageRoom<T>(rooms: T[]): T {
  const firstRoom = rooms[0];
  if (firstRoom === undefined) {
    throw new Error("Expected at least one coverage room.");
  }
  return firstRoom;
}

function compilerFixtureInput() {
  const bundle = createDesignKernelFixtureBundle({ withLayoutIntent: true });
  const schemeLiteContract = compileMockSchemeLite(bundle.input);
  const assetKinds = [
    "control_render",
    "depth_map",
    "semantic_mask",
    "line_map",
    "locked_geometry_mask",
    "anchor_layout_mask"
  ] as const;

  return {
    schemeLiteContract,
    sceneContract: bundle.sceneContract,
    cameraPlan: bundle.cameraPlan,
    controlSceneAssets: bundle.cameraPlan.roomPlans.flatMap((plan) =>
      assetKinds.map((kind) => ({
        assetId: `asset-${kind}-${plan.roomId}`,
        kind,
        roomId: plan.roomId,
        geometryHash: bundle.cameraPlan.geometryHash,
        uri: `fixture://batch16/${plan.roomId}/${kind}`
      }))
    ),
    policy: {
      includeCautiousRooms: true,
      minSpecsPerValidRoom: 1
    }
  };
}
