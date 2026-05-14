import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import { GeometryHashSchema, P1RoomTypeSchema } from "./p1-floorplan-adjustment.js";

export const RenderLifecycleStatusSchema = z.enum(["pass", "warning", "fail"]);

export const RenderTraceSchema = z
  .object({
    traceId: IdSchema,
    sourceModule: z.enum([
      "render_job_builder",
      "render_candidate_builder",
      "render_verifier_mock",
      "gallery_eligibility_evaluator"
    ]),
    networkCalls: z.literal(false),
    providerCalls: z.array(
      z
        .object({
          providerId: IdSchema,
          providerKind: z.enum(["mock", "none"]),
          startedAt: TimestampSchema,
          completedAt: TimestampSchema,
          status: z.enum(["success", "failed", "skipped"])
        })
        .strict()
    ),
    inputHashes: z
      .object({
        geometryHash: GeometryHashSchema,
        renderSpecHash: z.string().min(1).optional(),
        candidateOutputHash: z.string().min(1).optional()
      })
      .strict(),
    warnings: z.array(z.string().min(1))
  })
  .strict();

export const RenderJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial_failed",
  "failed",
  "cancelled"
]);

export const RenderRoomJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "partial_failed",
  "failed",
  "skipped"
]);

export const RenderJobIssueSchema = z
  .object({
    issueId: IdSchema,
    severity: z.enum(["info", "warning", "error", "blocking"]),
    code: z.string().min(1),
    message: z.string().min(1),
    roomId: IdSchema.optional(),
    renderSpecId: IdSchema.optional()
  })
  .strict();

export const RenderRoomJobSchema = z
  .object({
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    geometryHash: GeometryHashSchema,
    status: RenderRoomJobStatusSchema,
    renderSpecIds: z.array(IdSchema),
    candidateIds: z.array(IdSchema),
    verificationReportIds: z.array(IdSchema),
    coverage: z
      .object({
        expectedSpecCount: z.number().int().nonnegative(),
        candidateCount: z.number().int().nonnegative(),
        verifiedPassCount: z.number().int().nonnegative(),
        verifiedWarningCount: z.number().int().nonnegative(),
        verifiedFailCount: z.number().int().nonnegative(),
        galleryEligibleCount: z.number().int().nonnegative()
      })
      .strict(),
    issues: z.array(RenderJobIssueSchema)
  })
  .strict()
  .superRefine((roomJob, ctx) => {
    if (roomJob.coverage.expectedSpecCount !== roomJob.renderSpecIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "expectedSpecCount must match renderSpecIds",
        path: ["coverage", "expectedSpecCount"]
      });
    }
    if (roomJob.coverage.candidateCount !== roomJob.candidateIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "candidateCount must match candidateIds",
        path: ["coverage", "candidateCount"]
      });
    }
  });

export const RenderJobCoverageSummarySchema = z
  .object({
    validRoomCount: z.number().int().nonnegative(),
    coveredRoomCount: z.number().int().nonnegative(),
    missingRoomIds: z.array(IdSchema),
    totalRenderSpecCount: z.number().int().nonnegative(),
    totalCandidateCount: z.number().int().nonnegative(),
    totalVerificationReportCount: z.number().int().nonnegative(),
    galleryEligibleCandidateCount: z.number().int().nonnegative(),
    status: RenderLifecycleStatusSchema
  })
  .strict()
  .superRefine((coverage, ctx) => {
    if (coverage.missingRoomIds.length > 0 && coverage.status !== "fail") {
      ctx.addIssue({
        code: "custom",
        message: "coverage status must fail when rooms are missing render coverage",
        path: ["status"]
      });
    }
  });

export const RenderJobSchema = z
  .object({
    renderJobId: IdSchema,
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    source: z
      .object({
        schemeLiteContractId: IdSchema,
        creativeRenderSpecBatchId: IdSchema.optional(),
        compilerVersion: z.string().min(1).optional()
      })
      .strict(),
    status: RenderJobStatusSchema,
    roomJobs: z.array(RenderRoomJobSchema),
    coverage: RenderJobCoverageSummarySchema,
    trace: RenderTraceSchema,
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema
  })
  .strict()
  .superRefine((job, ctx) => {
    if (job.trace.inputHashes.geometryHash !== job.geometryHash) {
      ctx.addIssue({ code: "custom", message: "trace geometryHash must match render job", path: ["trace"] });
    }
    for (const [index, roomJob] of job.roomJobs.entries()) {
      if (roomJob.geometryHash !== job.geometryHash) {
        ctx.addIssue({ code: "custom", message: "room job geometryHash must match render job", path: ["roomJobs", index] });
      }
    }
  });

export type RenderLifecycleStatus = z.infer<typeof RenderLifecycleStatusSchema>;
export type RenderTrace = z.infer<typeof RenderTraceSchema>;
export type RenderJobStatus = z.infer<typeof RenderJobStatusSchema>;
export type RenderRoomJobStatus = z.infer<typeof RenderRoomJobStatusSchema>;
export type RenderJobIssue = z.infer<typeof RenderJobIssueSchema>;
export type RenderRoomJob = z.infer<typeof RenderRoomJobSchema>;
export type RenderJobCoverageSummary = z.infer<typeof RenderJobCoverageSummarySchema>;
export type RenderJob = z.infer<typeof RenderJobSchema>;
