import { describe, expect, it } from "vitest";
import {
  CreativeRenderSpecBatchSchema,
  CreativeRenderSpecSchema
} from "@homeai/contracts";
import {
  compileCreativeRenderSpecBatch,
  createCreativeRenderSpecFixtureInput
} from "@homeai/creative-render-spec";

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
});

function requireFirstSpec(batch: ReturnType<typeof compileCreativeRenderSpecBatch>) {
  const firstSpec = batch.specs[0];
  if (firstSpec === undefined) {
    throw new Error("Expected at least one render spec.");
  }
  return firstSpec;
}
