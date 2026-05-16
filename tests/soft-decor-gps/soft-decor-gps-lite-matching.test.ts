import { describe, expect, it } from "vitest";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import {
  buildSoftDecorGpsLitePlan,
  importVerifiedSkuCatalog,
  localRawSkuFixtures
} from "@homeai/soft-decor-gps";

describe("Soft Decor GPS Lite matching", () => {
  it("matches only admitted verified SKUs", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const catalog = importVerifiedSkuCatalog(localRawSkuFixtures);
    const admittedSkuIds = new Set(catalog.verifiedSkus.map((sku) => sku.skuId));
    const plan = buildSoftDecorGpsLitePlan({ scheme, catalog });
    const matchedSkuIds = plan.rooms.flatMap((room) => room.matches.map((match) => match.skuId));

    expect(matchedSkuIds.length).toBeGreaterThan(0);
    expect(matchedSkuIds.every((skuId) => admittedSkuIds.has(skuId))).toBe(true);
    expect(matchedSkuIds).not.toContain("sku-local-desk-missing-depth");
    expect(matchedSkuIds).not.toContain("sku-local-chair-unavailable");
  });

  it("keeps confirmed geometry as trace-only data", () => {
    const scheme = createSchemePageFixtureContract();
    const snapshot = JSON.stringify(scheme);
    const plan = buildSoftDecorGpsLitePlan({ scheme });

    expect(plan.geometryHash).toBe(scheme.geometryHash);
    expect(JSON.stringify(plan)).not.toMatch(/xMm|yMm|wallMutation|roomPolygon|confirmedGeometryMutable/i);
    expect(JSON.stringify(scheme)).toBe(snapshot);
  });

  it("warns for rooms without admitted fixture matches", () => {
    const scheme = createSchemePageFixtureContract();
    const plan = buildSoftDecorGpsLitePlan({ scheme });
    const study = plan.rooms.find((room) => room.roomId === "room-study");

    expect(study?.matches).toHaveLength(0);
    expect(study?.warnings.join(" ")).toMatch(/No admitted local fixture SKU/i);
  });
});
