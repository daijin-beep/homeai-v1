import { z } from "zod";
import {
  ConfidenceSchema,
  IdSchema,
  PriceSchema,
  SizeMmSchema,
  TimestampSchema,
} from "./common.js";
import { BudgetBandSchema } from "./design-brief.js";
import { RoomTypeSchema } from "./floorplan.js";

export const ProductCategorySchema =
  z.enum([
    "sofa",
    "coffee_table",
    "tv_cabinet",
    "dining_table",
    "dining_chair",
    "bed",
    "wardrobe",
    "desk",
    "chair",
    "curtain",
    "rug",
    "lamp",
    "storage_cabinet",
    "mirror",
    "decor",
  ]);

export const ProductCandidateSchema = z
  .object({
    id: IdSchema,
    provider: z.string().min(1),
    category: ProductCategorySchema,
    title: z.string().min(1),
    imageUrl: z.string().min(1),
    leadUrl: z.string().min(1),
    price: PriceSchema,
    size: SizeMmSchema,
    fit: z
      .object({
        roomId: IdSchema,
        fitScore: ConfidenceSchema,
        styleScore: ConfidenceSchema,
        sizeScore: ConfidenceSchema,
        budgetScore: ConfidenceSchema,
        warnings: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

export const VerifiedSkuSizeSchema = z
  .object({
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
  })
  .strict();

export const RawSkuFixtureSchema = z
  .object({
    skuId: IdSchema,
    source: z.literal("local_fixture"),
    category: ProductCategorySchema,
    title: z.string().min(1),
    imageUri: z
      .string()
      .min(1)
      .optional(),
    leadUri: z
      .string()
      .min(1)
      .optional(),
    price: PriceSchema.optional(),
    size: z
      .object({
        widthMm: z
          .number()
          .positive()
          .optional(),
        depthMm: z
          .number()
          .positive()
          .optional(),
        heightMm: z
          .number()
          .positive()
          .optional(),
      })
      .strict()
      .optional(),
    styleTags: z.array(
      z.string().min(1),
    ),
    budgetBand: BudgetBandSchema,
    availability: z.enum([
      "available",
      "unavailable",
      "unknown",
    ]),
    createdAt: TimestampSchema,
  })
  .strict();

export const VerifiedSkuSchema = z
  .object({
    skuId: IdSchema,
    source: z.literal("local_fixture"),
    category: ProductCategorySchema,
    title: z.string().min(1),
    imageUri: z.string().min(1),
    leadUri: z.string().min(1),
    price: PriceSchema,
    size: VerifiedSkuSizeSchema,
    styleTags: z.array(
      z.string().min(1),
    ),
    budgetBand: BudgetBandSchema,
    availability: z.literal(
      "available",
    ),
    admittedAt: TimestampSchema,
  })
  .strict()
  .superRefine((sku, ctx) => {
    if (
      !sku.imageUri.startsWith(
        "fixture://",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "VerifiedSku imageUri must use a local fixture URI",
        path: ["imageUri"],
      });
    }
    if (
      !sku.leadUri.startsWith(
        "fixture://",
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "VerifiedSku leadUri must use a local fixture URI",
        path: ["leadUri"],
      });
    }
    if (sku.price.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "VerifiedSku price amount must be positive",
        path: ["price", "amount"],
      });
    }
  });

export const SkuAdmissionIssueSchema = z
  .object({
    issueId: IdSchema,
    code: z.enum([
      "missing_price",
      "missing_dimensions",
      "missing_fixture_image",
      "missing_fixture_lead",
      "unavailable",
      "invalid_payload",
    ]),
    message: z.string().min(1),
    blocking: z.literal(true),
  })
  .strict();

export const VerifiedSkuAdmissionResultSchema =
  z
    .object({
      rawSkuId: IdSchema,
      status: z.enum([
        "admitted",
        "rejected",
      ]),
      sku: VerifiedSkuSchema.optional(),
      issues: z.array(
        SkuAdmissionIssueSchema,
      ),
      checkedAt: TimestampSchema,
    })
    .strict()
    .superRefine((result, ctx) => {
      if (
        result.status === "admitted" &&
        result.sku === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "admitted SKU requires sku",
          path: ["sku"],
        });
      }
      if (
        result.status === "rejected" &&
        result.issues.length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "rejected SKU requires issues",
          path: ["issues"],
        });
      }
      if (
        result.status === "admitted" &&
        result.issues.length > 0
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "admitted SKU must not carry blocking issues",
          path: ["issues"],
        });
      }
    });

export const VerifiedSkuCatalogSchema =
  z
    .object({
      source: z.literal(
        "local_fixture",
      ),
      importedAt: TimestampSchema,
      totalRawSkus: z
        .number()
        .int()
        .nonnegative(),
      admittedCount: z
        .number()
        .int()
        .nonnegative(),
      rejectedCount: z
        .number()
        .int()
        .nonnegative(),
      results: z.array(
        VerifiedSkuAdmissionResultSchema,
      ),
      verifiedSkus: z.array(
        VerifiedSkuSchema,
      ),
    })
    .strict()
    .superRefine((catalog, ctx) => {
      if (
        catalog.totalRawSkus !==
        catalog.results.length
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "totalRawSkus must match results",
          path: ["totalRawSkus"],
        });
      }
      if (
        catalog.admittedCount !==
        catalog.verifiedSkus.length
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "admittedCount must match verifiedSkus",
          path: ["admittedCount"],
        });
      }
      if (
        catalog.rejectedCount !==
        catalog.results.filter(
          (result) =>
            result.status ===
            "rejected",
        ).length
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "rejectedCount must match rejected results",
          path: ["rejectedCount"],
        });
      }
    });

export const PlacementAnchorSchema = z
  .object({
    type: z.enum([
      "wall",
      "window",
      "room_center",
      "corner",
      "opening_adjacent",
    ]),
    targetId: IdSchema.optional(),
    description: z.string().min(1),
  })
  .strict();

export const SoftDecorRecommendationSchema =
  z
    .object({
      id: IdSchema,
      roomId: IdSchema,
      category: ProductCategorySchema,
      placementAnchor:
        PlacementAnchorSchema,
      sizeConstraint: SizeMmSchema,
      styleConstraints: z.array(
        z.string().min(1),
      ),
      budgetBand: BudgetBandSchema,
      primaryCandidate:
        ProductCandidateSchema,
      alternatives: z.array(
        ProductCandidateSchema,
      ),
    })
    .strict();

export const RoomSoftDecorGuideSchema =
  z
    .object({
      roomId: IdSchema,
      roomType: RoomTypeSchema,
      recommendations: z.array(
        SoftDecorRecommendationSchema,
      ),
      warnings: z.array(z.string()),
    })
    .strict();

export const SoftDecorGPSPlanStatusSchema =
  z.enum([
    "queued",
    "running",
    "ready",
    "failed",
  ]);

export const SoftDecorGPSPlanSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    schemeId: IdSchema,
    sceneContractId: IdSchema,
    styleProfileId: IdSchema,
    status:
      SoftDecorGPSPlanStatusSchema,
    rooms: z.array(
      RoomSoftDecorGuideSchema,
    ),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .strict();

export type ProductCategory = z.infer<
  typeof ProductCategorySchema
>;
export type ProductCandidate = z.infer<
  typeof ProductCandidateSchema
>;
export type VerifiedSkuSize = z.infer<
  typeof VerifiedSkuSizeSchema
>;
export type RawSkuFixture = z.infer<
  typeof RawSkuFixtureSchema
>;
export type VerifiedSku = z.infer<
  typeof VerifiedSkuSchema
>;
export type SkuAdmissionIssue = z.infer<
  typeof SkuAdmissionIssueSchema
>;
export type VerifiedSkuAdmissionResult =
  z.infer<
    typeof VerifiedSkuAdmissionResultSchema
  >;
export type VerifiedSkuCatalog =
  z.infer<
    typeof VerifiedSkuCatalogSchema
  >;
export type SoftDecorRecommendation =
  z.infer<
    typeof SoftDecorRecommendationSchema
  >;
export type RoomSoftDecorGuide =
  z.infer<
    typeof RoomSoftDecorGuideSchema
  >;
export type SoftDecorGPSPlan = z.infer<
  typeof SoftDecorGPSPlanSchema
>;
