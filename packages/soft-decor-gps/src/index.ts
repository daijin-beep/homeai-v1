import {
  RawSkuFixtureSchema,
  SchemeLiteContractSchema,
  SoftDecorGpsLitePlanSchema,
  VerifiedSkuAdmissionResultSchema,
  VerifiedSkuCatalogSchema,
  type RawSkuFixture,
  type RoomSchemeLite,
  type SchemeLiteContract,
  type SoftDecorGpsLiteMatch,
  type SoftDecorGpsLitePlan,
  type SoftDecorGpsLiteRoom,
  type SkuAdmissionIssue,
  type VerifiedSku,
  type VerifiedSkuAdmissionResult,
  type VerifiedSkuCatalog
} from "@homeai/contracts";

export const verifiedSkuFixtureTimestamp = "2026-05-16T00:00:00.000Z";

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
      budgetBand: "mid"
    },
    size: {
      widthMm: 1880,
      depthMm: 860,
      heightMm: 780
    },
    styleTags: ["warm", "minimal", "fabric"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp
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
      budgetBand: "low"
    },
    size: {
      widthMm: 2000,
      depthMm: 1400,
      heightMm: 12
    },
    styleTags: ["warm", "soft", "neutral"],
    budgetBand: "low",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp
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
      heightMm: 1480
    },
    styleTags: ["warm"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp
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
      budgetBand: "mid"
    },
    size: {
      widthMm: 1200,
      heightMm: 740
    },
    styleTags: ["oak", "study"],
    budgetBand: "mid",
    availability: "available",
    createdAt: verifiedSkuFixtureTimestamp
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
      budgetBand: "low"
    },
    size: {
      widthMm: 460,
      depthMm: 520,
      heightMm: 820
    },
    styleTags: ["study"],
    budgetBand: "low",
    availability: "unavailable",
    createdAt: verifiedSkuFixtureTimestamp
  }
] as const;

export function admitVerifiedSku(
  rawSku: unknown,
  options: { checkedAt?: string } = {}
): VerifiedSkuAdmissionResult {
  const checkedAt = options.checkedAt ?? verifiedSkuFixtureTimestamp;
  const parsed = RawSkuFixtureSchema.safeParse(clone(rawSku));
  if (!parsed.success) {
    return rejectSku(rawSkuIdOf(rawSku), checkedAt, [
      issue(rawSkuIdOf(rawSku), "invalid_payload", "Raw SKU fixture does not match the import schema.")
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
      heightMm: raw.size!.heightMm!
    },
    styleTags: uniqueSorted(raw.styleTags),
    budgetBand: raw.budgetBand,
    availability: "available",
    admittedAt: checkedAt
  };

  return deepFreeze(VerifiedSkuAdmissionResultSchema.parse({
    rawSkuId: raw.skuId,
    status: "admitted",
    sku,
    issues: [],
    checkedAt
  }));
}

export function importVerifiedSkuCatalog(
  rawSkus: readonly unknown[] = localRawSkuFixtures,
  options: { importedAt?: string } = {}
): VerifiedSkuCatalog {
  const importedAt = options.importedAt ?? verifiedSkuFixtureTimestamp;
  const results = rawSkus.map((rawSku) => admitVerifiedSku(rawSku, { checkedAt: importedAt }));
  const verifiedSkus = results
    .filter((result): result is VerifiedSkuAdmissionResult & { sku: VerifiedSku } => result.status === "admitted")
    .map((result) => result.sku)
    .sort((left, right) => left.skuId.localeCompare(right.skuId));

  return deepFreeze(VerifiedSkuCatalogSchema.parse({
    source: "local_fixture",
    importedAt,
    totalRawSkus: rawSkus.length,
    admittedCount: verifiedSkus.length,
    rejectedCount: results.filter((result) => result.status === "rejected").length,
    results,
    verifiedSkus
  }));
}

export function buildVerifiedSkuDebugFixture(): VerifiedSkuCatalog {
  return importVerifiedSkuCatalog(localRawSkuFixtures);
}

export function buildSoftDecorGpsLitePlan(input: {
  scheme: SchemeLiteContract;
  catalog?: VerifiedSkuCatalog;
  createdAt?: string;
}): SoftDecorGpsLitePlan {
  const scheme = SchemeLiteContractSchema.parse(clone(input.scheme));
  const catalog = VerifiedSkuCatalogSchema.parse(clone(input.catalog ?? buildVerifiedSkuDebugFixture()));
  const verifiedSkus = catalog.verifiedSkus;
  const rooms = scheme.rooms.map((room): SoftDecorGpsLiteRoom => {
    const matches = matchesForRoom({
      room,
      schemeStyleTags: [...scheme.style.tags, ...scheme.style.materialTags],
      verifiedSkus
    });

    return {
      roomId: room.roomId,
      roomType: room.roomType,
      matches,
      warnings: matches.length === 0
        ? [`No admitted local fixture SKU matched ${room.roomType}.`]
        : ["Lite matching uses complete SKU metadata but does not guarantee physical fit."]
    };
  });

  const matchedSkuCount = new Set(rooms.flatMap((room) => room.matches.map((match) => match.skuId))).size;

  return deepFreeze(SoftDecorGpsLitePlanSchema.parse({
    version: "0.1",
    source: "verified_sku_catalog",
    homeId: scheme.homeId,
    schemeId: scheme.schemeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scheme.sceneContractId,
    geometryHash: scheme.geometryHash,
    totalVerifiedSkuCount: verifiedSkus.length,
    matchedSkuCount,
    rooms,
    createdAt: input.createdAt ?? verifiedSkuFixtureTimestamp
  }));
}

function admissionIssues(raw: RawSkuFixture): SkuAdmissionIssue[] {
  const issues = [
    ...(raw.price === undefined || raw.price.amount <= 0
      ? [issue(raw.skuId, "missing_price", "SKU requires a positive local fixture price.")]
      : []),
    ...(raw.size?.widthMm === undefined || raw.size.depthMm === undefined || raw.size.heightMm === undefined
      ? [issue(raw.skuId, "missing_dimensions", "SKU requires width, depth, and height in millimeters.")]
      : []),
    ...(raw.imageUri === undefined || !isFixtureUri(raw.imageUri)
      ? [issue(raw.skuId, "missing_fixture_image", "SKU requires a local fixture image URI.")]
      : []),
    ...(raw.leadUri === undefined || !isFixtureUri(raw.leadUri)
      ? [issue(raw.skuId, "missing_fixture_lead", "SKU requires a local fixture lead URI.")]
      : []),
    ...(raw.availability !== "available"
      ? [issue(raw.skuId, "unavailable", "SKU must be available before admission.")]
      : [])
  ];

  return issues;
}

function matchesForRoom(input: {
  room: RoomSchemeLite;
  schemeStyleTags: readonly string[];
  verifiedSkus: readonly VerifiedSku[];
}): SoftDecorGpsLiteMatch[] {
  const categories = categoriesForRoom(input.room.roomType);
  return input.verifiedSkus
    .filter((sku) => categories.includes(sku.category))
    .map((sku): SoftDecorGpsLiteMatch => {
      const styleScore = scoreStyleTags(input.schemeStyleTags, sku.styleTags);
      const sizeScore = 0.72;
      const budgetScore = budgetScoreForSku(sku);
      const score = roundScore((styleScore * 0.4) + (sizeScore * 0.35) + (budgetScore * 0.25));
      const anchor = input.room.anchorRefs[0];

      return {
        matchId: `match-${input.room.roomId}-${sku.skuId}`,
        roomId: input.room.roomId,
        roomType: input.room.roomType,
        category: sku.category,
        skuId: sku.skuId,
        placementAnchor: {
          type: anchor?.type ?? "room_center",
          ...(anchor === undefined ? {} : { targetId: anchor.anchorId }),
          description: `Place ${sku.category.replaceAll("_", " ")} using ${input.room.roomType} planning anchors.`
        },
        score,
        styleScore,
        sizeScore,
        budgetScore,
        reasons: [
          "SKU was admitted by the local fixture gate.",
          "SKU has price, width, depth, height, image, and lead fixture URI.",
          `Matched category ${sku.category} to ${input.room.roomType}.`
        ],
        warnings: ["Lite matching does not mutate or validate confirmed geometry."]
      };
    })
    .sort((left, right) => right.score - left.score || left.skuId.localeCompare(right.skuId));
}

function categoriesForRoom(roomType: string): VerifiedSku["category"][] {
  switch (roomType) {
    case "living_room":
    case "living_dining":
      return ["sofa", "rug", "coffee_table", "lamp", "storage_cabinet", "decor"];
    case "primary_bedroom":
    case "bedroom":
    case "secondary_bedroom":
    case "kids_room":
      return ["bed", "wardrobe", "rug", "lamp", "decor"];
    case "study":
      return ["desk", "chair", "lamp", "storage_cabinet", "decor"];
    case "balcony":
      return ["chair", "rug", "lamp", "decor"];
    case "dining_room":
    case "kitchen":
      return ["dining_table", "dining_chair", "lamp", "storage_cabinet"];
    default:
      return [];
  }
}

function scoreStyleTags(schemeStyleTags: readonly string[], skuStyleTags: readonly string[]): number {
  const normalizedScheme = new Set(schemeStyleTags.map((tag) => tag.toLowerCase()));
  const overlap = skuStyleTags.filter((tag) => normalizedScheme.has(tag.toLowerCase())).length;
  return roundScore(0.55 + Math.min(overlap, 3) * 0.15);
}

function budgetScoreForSku(sku: VerifiedSku): number {
  if (sku.price.budgetBand === "low" || sku.price.budgetBand === "mid") {
    return 0.86;
  }
  return 0.7;
}

function roundScore(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function rejectSku(
  rawSkuId: string,
  checkedAt: string,
  issues: SkuAdmissionIssue[]
): VerifiedSkuAdmissionResult {
  return deepFreeze(VerifiedSkuAdmissionResultSchema.parse({
    rawSkuId,
    status: "rejected",
    issues,
    checkedAt
  }));
}

function issue(
  skuId: string,
  code: SkuAdmissionIssue["code"],
  message: string
): SkuAdmissionIssue {
  return {
    issueId: `${skuId}-${code}`,
    code,
    message,
    blocking: true
  };
}

function isFixtureUri(value: string): boolean {
  return value.startsWith("fixture://");
}

function rawSkuIdOf(rawSku: unknown): string {
  if (typeof rawSku === "object" && rawSku !== null && "skuId" in rawSku) {
    const candidate = (rawSku as { skuId?: unknown }).skuId;
    if (typeof candidate === "string" && candidate.length > 0) {
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
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
