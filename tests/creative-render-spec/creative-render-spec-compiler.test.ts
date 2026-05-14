import { describe, expect, it } from "vitest";
import {
  assertCreativeRenderSpecFullRoomCoverage,
  buildCreativeRenderSpecDebugPayload,
  buildCreativeRenderSpecInputFromSchemeLite,
  compileCreativeRenderSpecBatch,
  createCreativeRenderSpecFixtureInput,
  verifyCreativeRenderSpecBatch
} from "@homeai/creative-render-spec";

describe("CreativeRenderSpec compiler", () => {
  it("builds one or more immutable specs per SchemeLite room including balcony", () => {
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: true });
    const snapshot = JSON.stringify(input.scheme);
    const batch = compileCreativeRenderSpecBatch(input);

    expect(batch.specs.length).toBeGreaterThanOrEqual(input.scheme.rooms.length);
    expect(batch.specs.some((spec) => spec.roomType === "balcony")).toBe(true);
    expect(batch.geometryHash).toBe(input.scheme.geometryHash);
    expect(batch.layoutIntentHash).toBe(input.scheme.layoutIntentHash);
    expect(Object.isFrozen(batch)).toBe(true);
    expect(() => {
      (batch.specs as unknown as unknown[]).push({});
    }).toThrow();
    expect(JSON.stringify(input.scheme)).toBe(snapshot);
  });

  it("omits layoutIntentHash when upstream is absent", () => {
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: false });
    const batch = compileCreativeRenderSpecBatch(input);

    expect(batch.layoutIntentHash).toBeUndefined();
    expect(batch.specs.every((spec) => spec.layoutIntentHash === undefined)).toBe(true);
  });

  it("is deterministic for repeated input", () => {
    const input = createCreativeRenderSpecFixtureInput();

    expect(JSON.stringify(compileCreativeRenderSpecBatch(input))).toBe(JSON.stringify(compileCreativeRenderSpecBatch(input)));
  });

  it("rejects camera room mismatches and asset trace mismatches", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const firstCamera = input.cameraRefs[0];
    const firstAsset = input.controlAssets[0];
    if (firstCamera === undefined || firstAsset === undefined) {
      throw new Error("Expected fixture camera and asset refs.");
    }

    expect(() => buildCreativeRenderSpecInputFromSchemeLite(input.scheme, {
      cameraRefs: [{ ...firstCamera, roomId: "missing-room" }],
      controlAssets: input.controlAssets
    })).toThrow();
    expect(() => buildCreativeRenderSpecInputFromSchemeLite(input.scheme, {
      cameraRefs: input.cameraRefs,
      controlAssets: [{ ...firstAsset, geometryHash: `sha256:${"c".repeat(64)}` }, ...input.controlAssets.slice(1)]
    })).toThrow();
    expect(() => buildCreativeRenderSpecInputFromSchemeLite(input.scheme, {
      cameraRefs: input.cameraRefs,
      controlAssets: [{ ...firstAsset, roomId: "missing-room" }, ...input.controlAssets.slice(1)]
    })).toThrow();
  });

  it("fails closed on missing room coverage", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const batch = compileCreativeRenderSpecBatch(input);
    const missingCoverage = {
      ...batch,
      specs: batch.specs.slice(1)
    };

    expect(verifyCreativeRenderSpecBatch(missingCoverage, input).status).toBe("fail");
    expect(() => assertCreativeRenderSpecFullRoomCoverage(missingCoverage, input)).toThrow();
  });

  it("copies anchors and layout refs without final furniture coordinates or unsupported claims", () => {
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: true });
    const batch = compileCreativeRenderSpecBatch(input);
    const livingSpec = batch.specs.find((spec) => spec.roomId === "room-living");
    const serialized = JSON.stringify(batch);

    expect(livingSpec?.anchorRefs).toContain("anchor-living");
    expect(livingSpec?.layoutIntentRefs).toContain("placeholder-living-sofa");
    expect(serialized).not.toMatch(/finalFurnitureCoordinates|xMm|yMm|productUrl|checkout|payment|SKU/i);
  });

  it("builds debug payload with verification and room coverage", () => {
    const input = createCreativeRenderSpecFixtureInput();
    const debug = buildCreativeRenderSpecDebugPayload({ input });

    expect(debug.coverage.schemeRoomCount).toBe(input.scheme.rooms.length);
    expect(debug.coverage.roomsWithSpecs).toBe(input.scheme.rooms.length);
    expect(debug.batch.specs).toHaveLength(input.scheme.rooms.length);
    expect(debug.renderSpecVerification.status).not.toBe("fail");
  });
});
