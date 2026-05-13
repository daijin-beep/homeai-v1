import { z } from "zod";

export const IdSchema = z.string().min(1);

export const TimestampSchema = z.string().datetime({ offset: true });

export const VersionSchema = z.number().int().positive();

export const UnitSchema = z.enum(["mm", "cm", "m", "px"]);

export const MmUnitSchema = z.literal("mm");

export const Point2DSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite()
  })
  .strict();

export const Point3DSchema = Point2DSchema.extend({
  z: z.number().finite()
}).strict();

export const PolygonSchema = z.array(Point2DSchema).min(4);

export const ConfidenceSchema = z.number().min(0).max(1);

export const WarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    blocking: z.boolean().default(false)
  })
  .strict();

export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const MetadataSchema = z.record(z.string(), JsonPrimitiveSchema);

export const PriceSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(3).max(3),
    budgetBand: z.enum(["low", "mid", "high", "premium"])
  })
  .strict();

export const SizeMmSchema = z
  .object({
    widthMm: z.number().positive(),
    depthMm: z.number().positive().optional(),
    heightMm: z.number().positive().optional()
  })
  .strict();

export type Point2D = z.infer<typeof Point2DSchema>;
export type Point3D = z.infer<typeof Point3DSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type SizeMm = z.infer<typeof SizeMmSchema>;
