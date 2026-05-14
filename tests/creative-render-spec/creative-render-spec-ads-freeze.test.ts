import { describe, expect, it } from "vitest";
import {
  ADS_FREEZE_REQUIRED_INPUT_FIELDS,
  assertCreativeRenderSpecForADS,
  compileCreativeRenderSpecBatch,
  createCreativeRenderSpecFixtureInput,
  validateCreativeRenderSpecForADS
} from "@homeai/creative-render-spec";

describe("CreativeRenderSpec ADS freeze validation", () => {
  it("accepts valid fixture specs with the current nested input asset refs", () => {
    const { spec, input } = fixtureSpec();
    const verification = validateCreativeRenderSpecForADS(spec, {
      homeId: input.scheme.homeId,
      floorplanRevisionId: input.scheme.floorplanRevisionId,
      sceneContractId: input.scheme.sceneContractId,
      geometryHash: input.scheme.geometryHash
    });

    expect(verification.status).not.toBe("fail");
    expect(assertCreativeRenderSpecForADS(spec).renderSpecId).toBe(spec.renderSpecId);
    expect(ADS_FREEZE_REQUIRED_INPUT_FIELDS).toContain("inputs.controlRender.uri");
    expect(JSON.stringify(spec)).not.toMatch(/controlRenderUrl|depthMapUrl|semanticMaskUrl|lineMapUrl|lockedGeometryMaskUrl|anchorLayoutMaskUrl/);
  });

  it("rejects missing geometryHash", () => {
    const { spec } = fixtureSpec();
    const invalid = cloneWithout(spec, "geometryHash");

    expect(validateCreativeRenderSpecForADS(invalid).status).toBe("fail");
    expect(() => assertCreativeRenderSpecForADS(invalid)).toThrow(/geometryHash/);
  });

  it("rejects missing renderSpecId, roomId, or cameraId", () => {
    const { spec } = fixtureSpec();

    expect(validateCreativeRenderSpecForADS(cloneWithout(spec, "renderSpecId")).status).toBe("fail");
    expect(validateCreativeRenderSpecForADS(cloneWithout(spec, "roomId")).status).toBe("fail");
    expect(validateCreativeRenderSpecForADS(cloneWithout(spec, "cameraId")).status).toBe("fail");
  });

  it("rejects a missing required input asset", () => {
    const { spec } = fixtureSpec();
    const invalid = {
      ...spec,
      inputs: cloneWithout(spec.inputs, "controlRender")
    };

    expect(validateCreativeRenderSpecForADS(invalid).status).toBe("fail");
  });

  it("rejects input asset roomId mismatches", () => {
    const { spec } = fixtureSpec();
    const invalid = {
      ...spec,
      inputs: {
        ...spec.inputs,
        controlRender: {
          ...spec.inputs.controlRender,
          roomId: "different-room"
        }
      }
    };

    expect(validateCreativeRenderSpecForADS(invalid).status).toBe("fail");
  });

  it("rejects input asset geometryHash mismatches", () => {
    const { spec } = fixtureSpec();
    const invalid = {
      ...spec,
      inputs: {
        ...spec.inputs,
        controlRender: {
          ...spec.inputs.controlRender,
          geometryHash: `sha256:${"f".repeat(64)}`
        }
      }
    };

    expect(validateCreativeRenderSpecForADS(invalid).status).toBe("fail");
  });

  it("rejects false hard constraints", () => {
    const { spec } = fixtureSpec();
    const invalid = {
      ...spec,
      hardConstraints: {
        ...spec.hardConstraints,
        preserveWalls: false
      }
    };

    expect(validateCreativeRenderSpecForADS(invalid).status).toBe("fail");
  });

  it("rejects missing required forbidden-change directives", () => {
    const { spec } = fixtureSpec();
    const invalid = {
      ...spec,
      promptDirectives: {
        ...spec.promptDirectives,
        forbiddenChanges: spec.promptDirectives.forbiddenChanges.filter((directive) => directive !== "no wall changes")
      }
    };

    const verification = validateCreativeRenderSpecForADS(invalid);

    expect(verification.status).toBe("fail");
    expect(verification.checks.some((check) => check.checkId.includes("no-wall-changes"))).toBe(true);
  });

  it("rejects context mismatches without requiring new top-level fields", () => {
    const { spec } = fixtureSpec();
    const verification = validateCreativeRenderSpecForADS(spec, {
      homeId: "different-home",
      floorplanRevisionId: spec.floorplanRevisionId,
      sceneContractId: spec.sceneContractId,
      geometryHash: spec.geometryHash
    });

    expect(verification.status).toBe("fail");
    expect(verification.checks.some((check) => check.checkId === "ads-freeze-context-home")).toBe(true);
  });

  it("keeps every fixture room/camera spec ADS-consumable", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const batch = compileCreativeRenderSpecBatch(input);

    expect(batch.specs).toHaveLength(input.cameraRefs.length);
    expect(batch.specs.every((spec) => validateCreativeRenderSpecForADS(spec).status !== "fail")).toBe(true);
  });
});

function fixtureSpec() {
  const input = createCreativeRenderSpecFixtureInput();
  const batch = compileCreativeRenderSpecBatch(input);
  const spec = batch.specs[0];
  if (spec === undefined) {
    throw new Error("Expected a fixture render spec.");
  }
  return { input, batch, spec };
}

function cloneWithout<T extends Record<string, unknown>, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const clone = structuredClone(value);
  delete clone[key];
  return clone;
}
