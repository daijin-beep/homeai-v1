import { z } from "zod";
import { ConfidenceSchema, IdSchema, PriceSchema, SizeMmSchema, TimestampSchema } from "./common.js";
import { BudgetBandSchema } from "./design-brief.js";
import { RoomTypeSchema } from "./floorplan.js";

export const ProductCategorySchema = z.enum([
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
  "decor"
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
        warnings: z.array(z.string())
      })
      .strict()
  })
  .strict();

export const PlacementAnchorSchema = z
  .object({
    type: z.enum(["wall", "window", "room_center", "corner", "opening_adjacent"]),
    targetId: IdSchema.optional(),
    description: z.string().min(1)
  })
  .strict();

export const SoftDecorRecommendationSchema = z
  .object({
    id: IdSchema,
    roomId: IdSchema,
    category: ProductCategorySchema,
    placementAnchor: PlacementAnchorSchema,
    sizeConstraint: SizeMmSchema,
    styleConstraints: z.array(z.string().min(1)),
    budgetBand: BudgetBandSchema,
    primaryCandidate: ProductCandidateSchema,
    alternatives: z.array(ProductCandidateSchema)
  })
  .strict();

export const RoomSoftDecorGuideSchema = z
  .object({
    roomId: IdSchema,
    roomType: RoomTypeSchema,
    recommendations: z.array(SoftDecorRecommendationSchema),
    warnings: z.array(z.string())
  })
  .strict();

export const SoftDecorGPSPlanStatusSchema = z.enum(["queued", "running", "ready", "failed"]);

export const SoftDecorGPSPlanSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    schemeId: IdSchema,
    sceneContractId: IdSchema,
    styleProfileId: IdSchema,
    status: SoftDecorGPSPlanStatusSchema,
    rooms: z.array(RoomSoftDecorGuideSchema),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type SoftDecorRecommendation = z.infer<typeof SoftDecorRecommendationSchema>;
export type RoomSoftDecorGuide = z.infer<typeof RoomSoftDecorGuideSchema>;
export type SoftDecorGPSPlan = z.infer<typeof SoftDecorGPSPlanSchema>;
