import { z } from "zod";
import { IdSchema, TimestampSchema, VersionSchema } from "./common.js";

export const BudgetBandSchema = z.enum(["low", "mid", "high", "premium"]);

export const StyleProfileSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema.optional(),
    version: VersionSchema,
    name: z.string().min(1),
    styleKeywords: z.array(z.string().min(1)),
    colorPreferences: z.array(z.string().min(1)),
    avoidItems: z.array(z.string().min(1)),
    budgetBand: BudgetBandSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export const DesignBriefSourceSchema = z.enum(["user_text", "preset_tags", "mock"]);

export const DesignBriefSchema = z
  .object({
    id: IdSchema,
    projectId: IdSchema,
    source: DesignBriefSourceSchema,
    styleProfile: StyleProfileSchema,
    functionalPreferences: z.array(z.string().min(1)),
    clarificationNeeded: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict();

export type BudgetBand = z.infer<typeof BudgetBandSchema>;
export type StyleProfile = z.infer<typeof StyleProfileSchema>;
export type DesignBrief = z.infer<typeof DesignBriefSchema>;
