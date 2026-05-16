import { describe, expect, it } from "vitest";
import {
  admitVerifiedSku,
  buildVerifiedSkuDebugFixture,
  importVerifiedSkuCatalog,
  localRawSkuFixtures,
} from "@homeai/soft-decor-gps";

describe("Verified SKU admission", () => {
  it("imports only admitted local fixture SKUs into the verified catalog", () => {
    const catalog = importVerifiedSkuCatalog(
      localRawSkuFixtures,
    );

    expect(catalog.source).toBe("local_fixture");
    expect(catalog.totalRawSkus).toBe(
      localRawSkuFixtures.length,
    );
    expect(
      catalog.verifiedSkus.map((sku) => sku.skuId),
    ).toEqual(["sku-local-rug-001", "sku-local-sofa-001"]);
    expect(
      catalog.verifiedSkus.every(
        (sku) =>
          sku.size.widthMm > 0 &&
          sku.size.depthMm > 0 &&
          sku.size.heightMm > 0,
      ),
    ).toBe(true);
  });

  it("fails closed for malformed raw fixtures", () => {
    const result = admitVerifiedSku({
      skuId: "sku-malformed",
      source: "remote",
    });

    expect(result.status).toBe("rejected");
    expect(
      result.issues.map((issue) => issue.code),
    ).toEqual(["invalid_payload"]);
  });

  it("builds a deterministic debug catalog", () => {
    const catalog = buildVerifiedSkuDebugFixture();

    expect(catalog.importedAt).toBe(
      "2026-05-16T00:00:00.000Z",
    );
    expect(catalog.admittedCount).toBe(2);
    expect(catalog.rejectedCount).toBe(3);
  });
});
