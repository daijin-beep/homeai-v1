import {
  ProductCandidateSchema,
  SoftDecorGPSPlanSchema,
  type ProductCandidate,
  type ProductCategory,
  type RoomSoftDecorGuide,
  type SoftDecorGPSPlan,
  type SoftDecorRecommendation,
} from "@homeai/contracts";
import type { BudgetBand } from "@homeai/contracts";

export const softDecorGpsPackage = "homeai-soft-decor-gps";

// ---------------------------------------------------------------------------
// Input types for the local matcher
// ---------------------------------------------------------------------------

export interface LocalProductInput {
  id: string;
  provider: string;
  category: ProductCategory;
  title: string;
  imageUrl: string;
  leadUrl: string;
  priceAmount: number;
  currency: string;
  budgetBand: BudgetBand;
  widthMm: number;
  depthMm?: number;
  heightMm?: number;
  styleTags?: string[];
}

export interface RoomConstraint {
  roomId: string;
  roomType: RoomSoftDecorGuide["roomType"];
  categories: ProductCategory[];
  styleKeywords: string[];
  budgetBand: BudgetBand;
  maxWidthMm?: number;
  maxDepthMm?: number;
  maxHeightMm?: number;
}

export interface MatcherInput {
  projectId: string;
  schemeId: string;
  sceneContractId: string;
  styleProfileId: string;
  candidates: LocalProductInput[];
  rooms: RoomConstraint[];
  generatedAt?: string;
}

// ---------------------------------------------------------------------------
// Budget band ordering for comparison
// ---------------------------------------------------------------------------

const BUDGET_ORDER: Record<BudgetBand, number> = {
  low: 0,
  mid: 1,
  high: 2,
  premium: 3,
};

// ---------------------------------------------------------------------------
// Deterministic scoring helpers (exported for testing)
// ---------------------------------------------------------------------------

export function scoreCategoryMatch(
  candidate: LocalProductInput,
  category: ProductCategory,
): number {
  return candidate.category === category ? 1.0 : 0.0;
}

export function scoreStyle(
  candidate: LocalProductInput,
  styleKeywords: string[],
): number {
  if (styleKeywords.length === 0) return 0.5;
  const lowerKeywords = styleKeywords.map((k) => k.toLowerCase());
  const searchable = [
    candidate.title.toLowerCase(),
    candidate.provider.toLowerCase(),
    ...(candidate.styleTags ?? []).map((t) => t.toLowerCase()),
  ].join(" ");
  let matches = 0;
  for (const kw of lowerKeywords) {
    if (searchable.includes(kw)) matches++;
  }
  return matches / lowerKeywords.length;
}

export function scoreSizeFit(
  candidate: LocalProductInput,
  constraint: RoomConstraint,
): number {
  let score = 1.0;
  let checks = 0;
  if (constraint.maxWidthMm !== undefined) {
    checks++;
    if (candidate.widthMm > constraint.maxWidthMm) {
      score -= 0.5;
    }
  }
  if (constraint.maxDepthMm !== undefined && candidate.depthMm !== undefined) {
    checks++;
    if (candidate.depthMm > constraint.maxDepthMm) {
      score -= 0.5;
    }
  }
  if (constraint.maxHeightMm !== undefined && candidate.heightMm !== undefined) {
    checks++;
    if (candidate.heightMm > constraint.maxHeightMm) {
      score -= 0.5;
    }
  }
  return checks === 0 ? 0.5 : Math.max(0, score);
}

export function scoreBudget(
  candidate: LocalProductInput,
  targetBand: BudgetBand,
): number {
  const diff = Math.abs(BUDGET_ORDER[candidate.budgetBand] - BUDGET_ORDER[targetBand]);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.6;
  return 0.2;
}

// ---------------------------------------------------------------------------
// Warning generation
// ---------------------------------------------------------------------------

export function generateWarnings(
  candidate: LocalProductInput,
  constraint: RoomConstraint,
  expectedCategory: ProductCategory = constraint.categories[0]!,
): string[] {
  const warnings: string[] = [];
  if (candidate.budgetBand !== constraint.budgetBand) {
    warnings.push(
      `Budget mismatch: product is ${candidate.budgetBand}, room target is ${constraint.budgetBand}`,
    );
  }
  if (
    constraint.maxWidthMm !== undefined &&
    candidate.widthMm > constraint.maxWidthMm
  ) {
    warnings.push(
      `Size mismatch: width ${candidate.widthMm}mm exceeds max ${constraint.maxWidthMm}mm`,
    );
  }
  if (
    constraint.maxDepthMm !== undefined &&
    candidate.depthMm !== undefined &&
    candidate.depthMm > constraint.maxDepthMm
  ) {
    warnings.push(
      `Size mismatch: depth ${candidate.depthMm}mm exceeds max ${constraint.maxDepthMm}mm`,
    );
  }
  if (
    constraint.maxHeightMm !== undefined &&
    candidate.heightMm !== undefined &&
    candidate.heightMm > constraint.maxHeightMm
  ) {
    warnings.push(
      `Size mismatch: height ${candidate.heightMm}mm exceeds max ${constraint.maxHeightMm}mm`,
    );
  }
  const styleScore = scoreStyle(candidate, constraint.styleKeywords);
  if (styleScore < 0.5) {
    warnings.push(
      `Style mismatch: low style alignment (${styleScore.toFixed(2)}) with room keywords`,
    );
  }
  if (candidate.category !== expectedCategory) {
    warnings.push(
      `Category mismatch: product is ${candidate.category}, expected ${expectedCategory}`,
    );
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Build a scored ProductCandidate (contract-compatible)
// ---------------------------------------------------------------------------

function buildProductCandidate(
  input: LocalProductInput,
  roomConstraint: RoomConstraint,
  category: ProductCategory,
): ProductCandidate {
  const styleScore = scoreStyle(input, roomConstraint.styleKeywords);
  const sizeScore = scoreSizeFit(input, roomConstraint);
  const budgetScore = scoreBudget(input, roomConstraint.budgetBand);
  const fitScore = (styleScore + sizeScore + budgetScore) / 3;
  const warnings = generateWarnings(input, roomConstraint, category);

  const candidate: ProductCandidate = {
    id: input.id,
    provider: input.provider,
    category: input.category,
    title: input.title,
    imageUrl: input.imageUrl,
    leadUrl: input.leadUrl,
    price: {
      amount: input.priceAmount,
      currency: input.currency,
      budgetBand: input.budgetBand,
    },
    size: {
      widthMm: input.widthMm,
      ...(input.depthMm !== undefined ? { depthMm: input.depthMm } : {}),
      ...(input.heightMm !== undefined ? { heightMm: input.heightMm } : {}),
    },
    fit: {
      roomId: roomConstraint.roomId,
      fitScore: parseFloat(fitScore.toFixed(4)),
      styleScore: parseFloat(styleScore.toFixed(4)),
      sizeScore: parseFloat(sizeScore.toFixed(4)),
      budgetScore: parseFloat(budgetScore.toFixed(4)),
      warnings,
    },
  };

  return ProductCandidateSchema.parse(candidate);
}

// ---------------------------------------------------------------------------
// Default placement anchor for a category
// ---------------------------------------------------------------------------

function defaultPlacementAnchor(category: ProductCategory) {
  const wallCategories = new Set<ProductCategory>([
    "tv_cabinet", "wardrobe", "storage_cabinet", "mirror", "desk",
  ]);
  const windowCategories = new Set<ProductCategory>(["curtain"]);
  const centerCategories = new Set<ProductCategory>([
    "sofa", "coffee_table", "dining_table", "bed", "rug",
  ]);

  if (wallCategories.has(category)) {
    return { type: "wall" as const, description: `${category} placed against wall` };
  }
  if (windowCategories.has(category)) {
    return { type: "window" as const, description: `${category} placed at window` };
  }
  if (centerCategories.has(category)) {
    return { type: "room_center" as const, description: `${category} placed at room center` };
  }
  return { type: "corner" as const, description: `${category} placed in corner` };
}

// ---------------------------------------------------------------------------
// Main matching function
// ---------------------------------------------------------------------------

export function matchCandidates(input: MatcherInput): SoftDecorGPSPlan {
  const generatedAt = input.generatedAt ?? "2026-01-01T00:00:00.000Z";
  const rooms: RoomSoftDecorGuide[] = [];

  for (const room of input.rooms) {
    const recommendations: SoftDecorRecommendation[] = [];
    const roomWarnings: string[] = [];

    for (const category of room.categories) {
      const categoryProducts = input.candidates.filter(
        (c) => c.category === category,
      );

      if (categoryProducts.length === 0) {
        roomWarnings.push(`No candidates available for category: ${category}`);
        continue;
      }

      const scored = categoryProducts
        .map((c) => ({
          input: c,
          candidate: buildProductCandidate(c, room, category),
        }))
        .sort((a, b) => {
          const diff = b.candidate.fit.fitScore - a.candidate.fit.fitScore;
          if (diff !== 0) return diff;
          return a.candidate.id.localeCompare(b.candidate.id);
        });

      const primary = scored[0]!;
      const alternatives = scored.slice(1).map((s) => s.candidate);
      const sizeConstraint = {
        widthMm: room.maxWidthMm ?? 5000,
        ...(room.maxDepthMm !== undefined ? { depthMm: room.maxDepthMm } : {}),
        ...(room.maxHeightMm !== undefined ? { heightMm: room.maxHeightMm } : {}),
      };

      const recommendation: SoftDecorRecommendation = {
        id: `rec-${room.roomId}-${category}`,
        roomId: room.roomId,
        category,
        placementAnchor: defaultPlacementAnchor(category),
        sizeConstraint,
        styleConstraints: room.styleKeywords.length > 0 ? room.styleKeywords : ["default"],
        budgetBand: room.budgetBand,
        primaryCandidate: primary.candidate,
        alternatives,
      };
      recommendations.push(recommendation);
    }

    rooms.push({
      roomId: room.roomId,
      roomType: room.roomType,
      recommendations,
      warnings: roomWarnings,
    });
  }

  const plan: SoftDecorGPSPlan = {
    id: `plan-${input.projectId}-${input.schemeId}-${input.sceneContractId}`,
    projectId: input.projectId,
    schemeId: input.schemeId,
    sceneContractId: input.sceneContractId,
    styleProfileId: input.styleProfileId,
    status: "ready",
    rooms,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  return SoftDecorGPSPlanSchema.parse(plan);
}
