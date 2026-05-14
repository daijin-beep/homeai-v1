import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CreativeRenderSpecConsumerSchema,
  listCreativeRenderSpecFixtures,
  loadCreativeRenderSpecFixture,
  validateCreativeRenderSpecForADS,
  type AdsRenderInputValidationResult
} from "@homeai/ads-render";

const repoRoot = process.cwd();
const validatorSource = join(
  repoRoot,
  "packages",
  "ads-render",
  "src",
  "validation",
  "validate-creative-render-spec-for-ads.ts"
);
const consumerSchemaSource = join(
  repoRoot,
  "packages",
  "ads-render",
  "src",
  "contracts",
  "creative-render-spec-consumer.ts"
);

describe("VAL-ADS-01 CreativeRenderSpec consumer validator", () => {
  it("ships all seven fixture variants", () => {
    const fixtures = listCreativeRenderSpecFixtures();
    expect(fixtures.sort()).toEqual(
      [
        "valid",
        "missing-geometry-hash",
        "missing-control-assets",
        "invalid-hard-constraints",
        "geometry-mutation-attempt",
        "missing-style",
        "missing-budget"
      ].sort()
    );
  });

  it("accepts the valid fixture and emits a deterministic immutableInputHash", () => {
    const fixture = loadCreativeRenderSpecFixture("valid");
    const first = validateCreativeRenderSpecForADS(fixture);
    const second = validateCreativeRenderSpecForADS(fixture);

    expectPass(first);
    expectPass(second);
    if (first.status === "pass" && second.status === "pass") {
      expect(first.immutableInputHash).toEqual(second.immutableInputHash);
      expect(first.immutableInputHash).toMatch(/^[0-9a-f]{64}$/);
      expect(CreativeRenderSpecConsumerSchema.safeParse(first.spec).success).toBe(true);
    }
  });

  it("rejects fixture missing geometryHash", () => {
    const fixture = loadCreativeRenderSpecFixture("missing-geometry-hash");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "geometryHash")).toBe(true);
    }
  });

  it("rejects fixture missing any of the six control assets", () => {
    const fixture = loadCreativeRenderSpecFixture("missing-control-assets");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path.startsWith("inputs."))).toBe(true);
    }
  });

  it("rejects fixture with preserveWalls=false (invalid hard constraints)", () => {
    const fixture = loadCreativeRenderSpecFixture("invalid-hard-constraints");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path.startsWith("hardConstraints."))).toBe(true);
    }
  });

  it("rejects fixture attempting to smuggle canonical geometry fields (strict)", () => {
    const fixture = loadCreativeRenderSpecFixture("geometry-mutation-attempt");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(
        result.issues.some(
          (issue) => issue.code === "unrecognized_keys" || issue.path === "walls" || issue.path === "doors"
        )
      ).toBe(true);
    }
  });

  it("does not mutate the input object during validation", () => {
    const fixture = loadCreativeRenderSpecFixture("valid");
    const before = JSON.parse(JSON.stringify(fixture));
    validateCreativeRenderSpecForADS(fixture);
    expect(fixture).toEqual(before);
  });

  it("survives validation against a deep-frozen input", () => {
    const fixture = loadCreativeRenderSpecFixture("valid");
    const frozen = deepFreeze(JSON.parse(JSON.stringify(fixture)));
    const result = validateCreativeRenderSpecForADS(frozen);
    expectPass(result);
  });

  it("rejects fixture missing style (required by lite schema)", () => {
    const fixture = loadCreativeRenderSpecFixture("missing-style");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "style")).toBe(true);
    }
  });

  it("rejects fixture missing budget (required by lite schema)", () => {
    const fixture = loadCreativeRenderSpecFixture("missing-budget");
    const result = validateCreativeRenderSpecForADS(fixture);

    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "budget")).toBe(true);
    }
  });

  it("rejects style payload whose styleId is empty", () => {
    const fixture = loadCreativeRenderSpecFixture("valid") as Record<string, unknown>;
    const malformed = { ...fixture, style: { styleId: "" } };
    const result = validateCreativeRenderSpecForADS(malformed);
    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "style.styleId")).toBe(true);
    }
  });

  it("rejects budget payload whose band is outside the four allowed values", () => {
    const fixture = loadCreativeRenderSpecFixture("valid") as Record<string, unknown>;
    const malformed = { ...fixture, budget: { band: "lavish", totalCents: 1 } };
    const result = validateCreativeRenderSpecForADS(malformed);
    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "budget.band")).toBe(true);
    }
  });

  it("rejects budget totalCents that is negative", () => {
    const fixture = loadCreativeRenderSpecFixture("valid") as Record<string, unknown>;
    const malformed = { ...fixture, budget: { band: "mid", totalCents: -1 } };
    const result = validateCreativeRenderSpecForADS(malformed);
    expectFail(result);
    if (result.status === "fail") {
      expect(result.issues.some((issue) => issue.path === "budget.totalCents")).toBe(true);
    }
  });

  it("rejects raw objects that smuggle the SceneContract id under canonicalRevisionId field", () => {
    const fixture = loadCreativeRenderSpecFixture("valid") as Record<string, unknown>;
    // Inject empty canonicalRevisionId to prove the validator rejects empty IDs.
    const malformed = { ...fixture, canonicalRevisionId: "" };
    const result = validateCreativeRenderSpecForADS(malformed);
    expectFail(result);
  });

  it("validator and schema source files do not import Track A write paths", () => {
    for (const file of [validatorSource, consumerSchemaSource]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/@homeai\/floorplan-parser/);
      expect(text).not.toMatch(/@homeai\/geometry/);
      expect(text).not.toMatch(/@homeai\/scene/);
      expect(text).not.toMatch(/createCanonicalFloorplanRevision/);
      expect(text).not.toMatch(/buildSceneContract/);
      expect(text).not.toMatch(/createInMemoryP1Repositories/);
      expect(text).not.toMatch(/RenderImageSpec/);
    }
  });
});

function expectPass(result: AdsRenderInputValidationResult): void {
  if (result.status !== "pass") {
    throw new Error(`expected pass, got fail: ${JSON.stringify(result.issues, null, 2)}`);
  }
}

function expectFail(result: AdsRenderInputValidationResult): void {
  if (result.status !== "fail") {
    throw new Error("expected fail, got pass");
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.values(obj as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}
