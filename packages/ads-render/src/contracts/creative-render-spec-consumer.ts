import { z } from "zod";

import { IdSchema } from "@homeai/contracts";

export const CreativeRenderSpecInputsSchema = z
  .object({
    controlRenderUrl: z.string().url(),
    depthMapUrl: z.string().url(),
    semanticMaskUrl: z.string().url(),
    lineMapUrl: z.string().url(),
    lockedGeometryMaskUrl: z.string().url(),
    anchorLayoutMaskUrl: z.string().url()
  })
  .strict();

export const CreativeRenderSpecHardConstraintsSchema = z
  .object({
    preserveWalls: z.literal(true),
    preserveDoors: z.literal(true),
    preserveWindows: z.literal(true),
    preserveRoomProportion: z.literal(true),
    preserveAnchorZones: z.literal(true)
  })
  .strict();

/**
 * Minimal style schema that ADS consumes. The full StylePacket shape is owned
 * by the Codex Design Kernel batch and is not yet frozen; this lite schema
 * enforces only the fields ADS needs to route a render (styleId is mandatory
 * so traces can be attributed; paletteHint is optional metadata).
 */
export const StylePacketLiteSchema = z
  .object({
    styleId: IdSchema,
    paletteHint: z.array(z.string().min(1)).optional()
  })
  .passthrough();

/**
 * Minimal budget schema. Full BudgetProfile (with SKU-tier breakdowns) is
 * owned by the Codex Design Kernel batch. ADS only requires the band label
 * and a non-negative integer total so cost forensics can compare against
 * RenderProviderPolicy.maxEstimatedCostCentsPerCandidate.
 */
export const BudgetProfileLiteSchema = z
  .object({
    band: z.enum(["low", "mid", "high", "premium"]),
    totalCents: z.number().int().nonnegative()
  })
  .passthrough();

export const CreativeRenderSpecConsumerSchema = z
  .object({
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    canonicalRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: z.string().min(1),
    layoutIntentHash: z.string().min(1).optional(),
    inputs: CreativeRenderSpecInputsSchema,
    hardConstraints: CreativeRenderSpecHardConstraintsSchema,
    style: StylePacketLiteSchema,
    budget: BudgetProfileLiteSchema,
    forbiddenChanges: z.array(z.string()).default([])
  })
  .strict();

export type StylePacketLite = z.infer<typeof StylePacketLiteSchema>;
export type BudgetProfileLite = z.infer<typeof BudgetProfileLiteSchema>;
export type CreativeRenderSpecConsumerInput = z.input<typeof CreativeRenderSpecConsumerSchema>;
export type CreativeRenderSpecConsumer = z.output<typeof CreativeRenderSpecConsumerSchema>;
