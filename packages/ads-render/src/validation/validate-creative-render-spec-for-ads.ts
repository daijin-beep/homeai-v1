import { createHash } from "node:crypto";

import {
  CreativeRenderSpecConsumerSchema,
  type CreativeRenderSpecConsumer
} from "../contracts/creative-render-spec-consumer.js";
import type { AdsSpecValidationIssue } from "../errors/spec-validation-errors.js";

export type AdsRenderInputValidationResult =
  | { status: "pass"; spec: CreativeRenderSpecConsumer; immutableInputHash: string }
  | { status: "fail"; issues: AdsSpecValidationIssue[] };

/**
 * Consumer-side gate for CreativeRenderSpec. The validator never mutates input,
 * never fills missing geometryHash, never compiles SceneContract, and never
 * imports any Track A write path. ADS callers must treat a "fail" result as
 * a hard reject (no provider call, no candidate creation).
 */
export function validateCreativeRenderSpecForADS(input: unknown): AdsRenderInputValidationResult {
  const parsed = CreativeRenderSpecConsumerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "fail",
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.map((segment) => String(segment)).join("."),
        message: issue.message
      }))
    };
  }
  const spec = parsed.data;
  return {
    status: "pass",
    spec,
    immutableInputHash: computeImmutableInputHash(spec)
  };
}

function computeImmutableInputHash(spec: CreativeRenderSpecConsumer): string {
  return createHash("sha256").update(canonicalStringify(spec)).digest("hex");
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}
