import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { RenderTraceSchema } from "./render-job.js";

export const RenderVerificationStatusSchema = z.enum(["pass", "warning", "fail"]);

export const DeterministicRenderCheckTypeSchema = z.enum([
  "geometry_hash_match",
  "room_id_match",
  "camera_id_match",
  "walls_preserved",
  "doors_preserved",
  "windows_preserved",
  "room_proportion_preserved",
  "anchor_zones_preserved",
  "forbidden_region_clear",
  "output_asset_present"
]);

export const DeterministicRenderCheckSchema = z
  .object({
    checkType: DeterministicRenderCheckTypeSchema,
    status: RenderVerificationStatusSchema,
    severity: z.enum(["info", "warning", "blocking"]),
    message: z.string().min(1),
    expected: z.unknown().optional(),
    actual: z.unknown().optional()
  })
  .strict();

export const VlmChecklistQuestionIdSchema = z.enum([
  "room_type_consistent",
  "no_structural_change",
  "doors_windows_visible",
  "major_furniture_not_blocking_openings",
  "forbidden_changes_respected"
]);

export const VlmRenderChecklistResultSchema = z
  .object({
    questionId: VlmChecklistQuestionIdSchema,
    answer: z.enum(["yes", "no", "uncertain", "not_evaluated"]),
    status: RenderVerificationStatusSchema,
    rationale: z.string().min(1).optional(),
    provider: z
      .object({
        providerId: z.literal("mock_vlm"),
        modelId: z.literal("mock")
      })
      .strict()
  })
  .strict();

export const RetryRecommendationSchema = z
  .object({
    recommended: z.boolean(),
    reason: z.string().min(1),
    maxRetries: z.number().int().nonnegative()
  })
  .strict();

export const HumanReviewRecommendationSchema = z
  .object({
    required: z.boolean(),
    reason: z.string().min(1)
  })
  .strict();

const BlockingFailTypes = new Set([
  "geometry_hash_match",
  "walls_preserved",
  "doors_preserved",
  "windows_preserved",
  "room_proportion_preserved",
  "anchor_zones_preserved"
]);

export const RenderVerificationReportSchema = z
  .object({
    renderVerificationReportId: IdSchema,
    renderCandidateId: IdSchema,
    renderJobId: IdSchema,
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: GeometryHashSchema,
    status: RenderVerificationStatusSchema,
    l1Checks: z.array(DeterministicRenderCheckSchema).min(1),
    l2Checks: z.array(VlmRenderChecklistResultSchema),
    retryRecommendation: RetryRecommendationSchema.optional(),
    humanReview: HumanReviewRecommendationSchema.optional(),
    trace: RenderTraceSchema,
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((report, ctx) => {
    if (report.trace.inputHashes.geometryHash !== report.geometryHash) {
      ctx.addIssue({ code: "custom", message: "trace geometryHash must match render verification report", path: ["trace"] });
    }
    const hasBlockingFailure = report.l1Checks.some(
      (check) => check.status === "fail" && BlockingFailTypes.has(check.checkType)
    );
    if (hasBlockingFailure && report.status !== "fail") {
      ctx.addIssue({
        code: "custom",
        message: "blocking deterministic failures require report status fail",
        path: ["status"]
      });
    }
  });

export type RenderVerificationStatus = z.infer<typeof RenderVerificationStatusSchema>;
export type DeterministicRenderCheckType = z.infer<typeof DeterministicRenderCheckTypeSchema>;
export type DeterministicRenderCheck = z.infer<typeof DeterministicRenderCheckSchema>;
export type VlmChecklistQuestionId = z.infer<typeof VlmChecklistQuestionIdSchema>;
export type VlmRenderChecklistResult = z.infer<typeof VlmRenderChecklistResultSchema>;
export type RetryRecommendation = z.infer<typeof RetryRecommendationSchema>;
export type HumanReviewRecommendation = z.infer<typeof HumanReviewRecommendationSchema>;
export type RenderVerificationReport = z.infer<typeof RenderVerificationReportSchema>;
