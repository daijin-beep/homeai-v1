import {
  RawSkuFixtureSchema,
  VerifiedSkuAdmissionResultSchema,
  VerifiedSkuCatalogSchema,
  type RawSkuFixture,
  type SkuAdmissionIssue,
  type VerifiedSku,
  type VerifiedSkuAdmissionResult,
  type VerifiedSkuCatalog,
} from "@homeai/contracts";

export const verifiedSkuFixtureTimestamp =
  "2026-05-16T00:00:00.000Z";

export const localRawSkuFixtures = [
  {
    skuId: "sku-local-sofa-001",
    source: "local_fixture",
    category: "sofa",
    title: "Local Compact Sofa",
    imageUri: "fixture://sku-images/sofa-001.svg",
    leadUri: "fixture://sku-leads/sofa-001",
    price: {
      amount: 3299,
      currency: "CNY",
      budgetBand: "mid",
    },
    size: {
      widthMm: 1880,
      depthMm: 860,
      heightMm: 780,
    },
    styleTags: ["warm", "minimal", "fabric"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp,
  },
  {
    skuId: "sku-local-rug-001",
    source: "local_fixture",
    category: "rug",
    title: "Local Wool Blend Rug",
    imageUri: "fixture://sku-images/rug-001.svg",
    leadUri: "fixture://sku-leads/rug-001",
    price: {
      amount: 899,
      currency: "CNY",
      budgetBand: "low",
    },
    size: {
      widthMm: 2000,
      depthMm: 1400,
      heightMm: 12,
    },
    styleTags: ["warm", "soft", "neutral"],
    budgetBand: "low",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp,
  },
  {
    skuId: "sku-local-lamp-missing-price",
    source: "local_fixture",
    category: "lamp",
    title: "Lamp Missing Price",
    imageUri: "fixture://sku-images/lamp-missing-price.svg",
    leadUri: "fixture://sku-leads/lamp-missing-price",
    size: {
      widthMm: 320,
      depthMm: 320,
      heightMm: 1480,
    },
    styleTags: ["warm"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp,
  },
  {
    skuId: "sku-local-desk-missing-depth",
    source: "local_fixture",
    category: "desk",
    title: "Desk Missing Depth",
    imageUri: "fixture://sku-images/desk-missing-depth.svg",
    leadUri: "fixture://sku-leads/desk-missing-depth",
    price: {
      amount: 1299,
      currency: "CNY",
      budgetBand: "mid",
    },
    size: {
      widthMm: 1200,
      heightMm: 740,
    },
    styleTags: ["oak", "study"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp,
  },
  {
    skuId: "sku-local-chair-unavailable",
    source: "local_fixture",
    category: "chair",
    title: "Unavailable Chair",
    imageUri: "fixture://sku-images/chair-unavailable.svg",
    leadUri: "fixture://sku-leads/chair-unavailable",
    price: {
      amount: 499,
      currency: "CNY",
      budgetBand: "low",
    },
    size: {
      widthMm: 460,
      depthMm: 520,
      heightMm: 820,
    },
    styleTags: ["study"],
    budgetBand: "low",
    availability: "unavailable",
    createdAt: verifiedSkuFixtureTimestamp,
  },
] as const;

export function admitVerifiedSku(
  rawSku: unknown,
  options: { checkedAt?: string } = {},
): VerifiedSkuAdmissionResult {
  const checkedAt =
    options.checkedAt ?? verifiedSkuFixtureTimestamp;
  const parsed = RawSkuFixtureSchema.safeParse(
    clone(rawSku),
  );
  if (!parsed.success) {
    return rejectSku(rawSkuIdOf(rawSku), checkedAt, [
      issue(
        rawSkuIdOf(rawSku),
        "invalid_payload",
        "Raw SKU fixture does not match the import schema.",
      ),
    ]);
  }

  const raw = parsed.data;
  const issues = admissionIssues(raw);
  if (issues.length > 0) {
    return rejectSku(raw.skuId, checkedAt, issues);
  }

  const sku: VerifiedSku = {
    skuId: raw.skuId,
    source: "local_fixture",
    category: raw.category,
    title: raw.title,
    imageUri: raw.imageUri!,
    leadUri: raw.leadUri!,
    price: raw.price!,
    size: {
      widthMm: raw.size!.widthMm!,
      depthMm: raw.size!.depthMm!,
      heightMm: raw.size!.heightMm!,
    },
    styleTags: uniqueSorted(raw.styleTags),
    budgetBand: raw.budgetBand,
    availability: "available",
    admittedAt: checkedAt,
  };

  return deepFreeze(
    VerifiedSkuAdmissionResultSchema.parse({
      rawSkuId: raw.skuId,
      status: "admitted",
      sku,
      issues: [],
      checkedAt,
    }),
  );
}

export function importVerifiedSkuCatalog(
  rawSkus: readonly unknown[] = localRawSkuFixtures,
  options: { importedAt?: string } = {},
): VerifiedSkuCatalog {
  const importedAt =
    options.importedAt ?? verifiedSkuFixtureTimestamp;
  const results = rawSkus.map((rawSku) =>
    admitVerifiedSku(rawSku, { checkedAt: importedAt }),
  );
  const verifiedSkus = results
    .filter(
      (
        result,
      ): result is VerifiedSkuAdmissionResult & {
        sku: VerifiedSku;
      } => result.status === "admitted",
    )
    .map((result) => result.sku)
    .sort((left, right) =>
      left.skuId.localeCompare(right.skuId),
    );

  return deepFreeze(
    VerifiedSkuCatalogSchema.parse({
      source: "local_fixture",
      importedAt,
      totalRawSkus: rawSkus.length,
      admittedCount: verifiedSkus.length,
      rejectedCount: results.filter(
        (result) => result.status === "rejected",
      ).length,
      results,
      verifiedSkus,
    }),
  );
}

export function buildVerifiedSkuDebugFixture(): VerifiedSkuCatalog {
  return importVerifiedSkuCatalog(localRawSkuFixtures);
}

function admissionIssues(
  raw: RawSkuFixture,
): SkuAdmissionIssue[] {
  const issues = [
    ...(raw.price === undefined || raw.price.amount <= 0
      ? [
          issue(
            raw.skuId,
            "missing_price",
            "SKU requires a positive local fixture price.",
          ),
        ]
      : []),
    ...(raw.size?.widthMm === undefined ||
    raw.size.depthMm === undefined ||
    raw.size.heightMm === undefined
      ? [
          issue(
            raw.skuId,
            "missing_dimensions",
            "SKU requires width, depth, and height in millimeters.",
          ),
        ]
      : []),
    ...(raw.imageUri === undefined ||
    !isFixtureUri(raw.imageUri)
      ? [
          issue(
            raw.skuId,
            "missing_fixture_image",
            "SKU requires a local fixture image URI.",
          ),
        ]
      : []),
    ...(raw.leadUri === undefined ||
    !isFixtureUri(raw.leadUri)
      ? [
          issue(
            raw.skuId,
            "missing_fixture_lead",
            "SKU requires a local fixture lead URI.",
          ),
        ]
      : []),
    ...(raw.availability !== "available"
      ? [
          issue(
            raw.skuId,
            "unavailable",
            "SKU must be available before admission.",
          ),
        ]
      : []),
  ];

  return issues;
}

function rejectSku(
  rawSkuId: string,
  checkedAt: string,
  issues: SkuAdmissionIssue[],
): VerifiedSkuAdmissionResult {
  return deepFreeze(
    VerifiedSkuAdmissionResultSchema.parse({
      rawSkuId,
      status: "rejected",
      issues,
      checkedAt,
    }),
  );
}

function issue(
  skuId: string,
  code: SkuAdmissionIssue["code"],
  message: string,
): SkuAdmissionIssue {
  return {
    issueId: `${skuId}-${code}`,
    code,
    message,
    blocking: true,
  };
}

function isFixtureUri(value: string): boolean {
  return value.startsWith("fixture://");
}

function rawSkuIdOf(rawSku: unknown): string {
  if (
    typeof rawSku === "object" &&
    rawSku !== null &&
    "skuId" in rawSku
  ) {
    const candidate = (rawSku as { skuId?: unknown }).skuId;
    if (
      typeof candidate === "string" &&
      candidate.length > 0
    ) {
      return candidate;
    }
  }
  return "unknown-sku";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(
      (value as Record<PropertyKey, unknown>)[key],
    );
  }
  return Object.freeze(value);
}
