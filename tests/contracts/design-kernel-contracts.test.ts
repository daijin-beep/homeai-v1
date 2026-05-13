import { describe, expect, it } from "vitest";
import {
  DesignKernelInputSchema,
  RoomSchemeLiteSchema,
  SchemeLiteContractSchema,
  UserBriefInputSchema
} from "@homeai/contracts";
import { compileMockSchemeLite } from "@homeai/design-kernel";
import {
  createDesignKernelFixtureBundle,
  createSimpleDesignKernelFixtureBundle
} from "../fixtures/design-kernel.js";

describe("Design Kernel contracts", () => {
  it("validates user brief input and rejects invalid budget ranges", () => {
    const valid = {
      homeId: "home-brief",
      text: "Warm practical home.",
      language: "en-US",
      budgetBand: "standard",
      budgetMinCny: 10000,
      budgetMaxCny: 20000,
      source: "user_text"
    };

    expect(UserBriefInputSchema.safeParse(valid).success).toBe(true);
    expect(UserBriefInputSchema.safeParse({ ...valid, budgetMinCny: -1 }).success).toBe(false);
    expect(UserBriefInputSchema.safeParse({ ...valid, budgetMinCny: 30000, budgetMaxCny: 20000 }).success).toBe(false);
    expect(UserBriefInputSchema.safeParse({
      homeId: "home-brief",
      language: "unknown",
      budgetBand: "unknown",
      source: "default"
    }).success).toBe(true);
    expect(UserBriefInputSchema.safeParse({
      homeId: "home-brief",
      language: "unknown",
      budgetBand: "unknown",
      source: "user_text"
    }).success).toBe(false);
  });

  it("validates DesignKernelInput and rejects missing or mismatched trace fields", () => {
    const { input } = createSimpleDesignKernelFixtureBundle();
    const changedHash = `sha256:${"3".repeat(64)}`;

    expect(DesignKernelInputSchema.safeParse(input).success).toBe(true);
    expect(DesignKernelInputSchema.safeParse({ ...input, homeId: "home-mismatch" }).success).toBe(false);
    expect(DesignKernelInputSchema.safeParse({ ...input, floorplanRevisionId: "canonical-mismatch" }).success).toBe(false);
    expect(DesignKernelInputSchema.safeParse({ ...input, sceneContractId: "scene-mismatch" }).success).toBe(false);
    expect(DesignKernelInputSchema.safeParse({ ...input, geometryHash: changedHash }).success).toBe(false);
    expect(DesignKernelInputSchema.safeParse({ ...input, geometryHash: undefined }).success).toBe(false);
  });

  it("propagates layoutIntentHash only with a LayoutIntentContract", () => {
    const withoutLayout = createSimpleDesignKernelFixtureBundle().input;
    const withLayout = createDesignKernelFixtureBundle({ withLayoutIntent: true }).input;
    const hash = `sha256:${"4".repeat(64)}`;

    expect(withoutLayout.layoutIntentHash).toBeUndefined();
    expect(DesignKernelInputSchema.safeParse({ ...withoutLayout, layoutIntentHash: hash }).success).toBe(false);
    expect(withLayout.layoutIntentHash).toBe(withLayout.layoutIntentContract?.layoutIntentHash);
    expect(DesignKernelInputSchema.safeParse({ ...withLayout, layoutIntentHash: undefined }).success).toBe(false);
  });

  it("validates SchemeLiteContract and rejects final furniture coordinate fields", () => {
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const scheme = compileMockSchemeLite(input);
    const firstRoom = scheme.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected room scheme.");
    }

    expect(SchemeLiteContractSchema.safeParse(scheme).success).toBe(true);
    expect(RoomSchemeLiteSchema.safeParse({ ...firstRoom, center: { x: 1, y: 2 } }).success).toBe(false);
    expect(RoomSchemeLiteSchema.safeParse({ ...firstRoom, position: { x: 1, y: 2 } }).success).toBe(false);
    expect(RoomSchemeLiteSchema.safeParse({ ...firstRoom, displaySizeMm: { width: 1000, depth: 1000 } }).success).toBe(false);
  });
});
