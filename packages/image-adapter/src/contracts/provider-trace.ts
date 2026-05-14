import { z } from "zod";

import { IdSchema, TimestampSchema } from "@homeai/contracts";

import { RenderProviderPolicySnapshotSchema } from "./render-provider-policy.js";

export const ProviderSafetyStatusSchema = z.enum(["not_checked", "passed", "blocked"]);

export const ProviderTraceErrorCodeSchema = z.enum([
  "timeout",
  "malformed",
  "policy_denied",
  "storage_failed",
  "safety_blocked",
  "spec_invalid",
  "unknown"
]);

export const ProviderTraceSchema = z
  .object({
    traceId: IdSchema,
    providerName: z.string().min(1),
    providerModel: z.string().min(1),
    adapterVersion: z.string().min(1),
    requestId: z.string().min(1).optional(),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema.optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    estimatedCostCents: z.number().int().nonnegative().optional(),
    inputAssetHashes: z.array(z.string().min(1)),
    outputAssetHash: z.string().min(1).optional(),
    policySnapshot: RenderProviderPolicySnapshotSchema,
    safetyStatus: ProviderSafetyStatusSchema,
    errorCode: ProviderTraceErrorCodeSchema.optional()
  })
  .strict();

export type ProviderTrace = z.infer<typeof ProviderTraceSchema>;
