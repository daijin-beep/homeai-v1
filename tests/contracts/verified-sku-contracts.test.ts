import {
  describe,
  expect,
  it,
} from "vitest";
import {
  RawSkuFixtureSchema,
  VerifiedSkuAdmissionResultSchema,
  VerifiedSkuCatalogSchema,
  VerifiedSkuSchema,
} from "@homeai/contracts";
import {
  admitVerifiedSku,
  importVerifiedSkuCatalog,
  localRawSkuFixtures,
} from "@homeai/soft-decor-gps";

describe("Verified SKU contracts", () => {
  it("validates admitted local fixture SKUs", () => {
    const catalog =
      importVerifiedSkuCatalog(
        localRawSkuFixtures,
      );
    const firstSku =
      catalog.verifiedSkus[0];

    expect(
      VerifiedSkuCatalogSchema.safeParse(
        catalog,
      ).success,
    ).toBe(true);
    expect(firstSku).toBeDefined();
    expect(
      VerifiedSkuSchema.safeParse(
        firstSku,
      ).success,
    ).toBe(true);
    expect(
      firstSku?.imageUri.startsWith(
        "fixture://",
      ),
    ).toBe(true);
    expect(
      firstSku?.leadUri.startsWith(
        "fixture://",
      ),
    ).toBe(true);
  });

  it("rejects missing price, dimensions, and unavailable fixtures", () => {
    const catalog =
      importVerifiedSkuCatalog(
        localRawSkuFixtures,
      );

    expect(catalog.admittedCount).toBe(
      2,
    );
    expect(catalog.rejectedCount).toBe(
      3,
    );
    expect(
      catalog.results.some((result) =>
        result.issues.some(
          (issue) =>
            issue.code ===
            "missing_price",
        ),
      ),
    ).toBe(true);
    expect(
      catalog.results.some((result) =>
        result.issues.some(
          (issue) =>
            issue.code ===
            "missing_dimensions",
        ),
      ),
    ).toBe(true);
    expect(
      catalog.results.some((result) =>
        result.issues.some(
          (issue) =>
            issue.code ===
            "unavailable",
        ),
      ),
    ).toBe(true);
  });

  it("rejects non-fixture image and lead URIs", () => {
    const raw =
      RawSkuFixtureSchema.parse(
        localRawSkuFixtures[0],
      );
    const result = admitVerifiedSku({
      ...raw,
      imageUri:
        "asset://example-invalid/sofa.svg",
      leadUri:
        "lead://example-invalid/lead",
    });

    expect(result.status).toBe(
      "rejected",
    );
    expect(
      result.issues.map(
        (issue) => issue.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "missing_fixture_image",
        "missing_fixture_lead",
      ]),
    );
    expect(
      VerifiedSkuAdmissionResultSchema.safeParse(
        result,
      ).success,
    ).toBe(true);
  });
});
