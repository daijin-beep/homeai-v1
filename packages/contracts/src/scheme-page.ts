import { z } from "zod";
import {
  DesignKernelStatusSchema,
  SchemeLiteContractSchema,
  SchemeVerificationSchema
} from "./design-kernel.js";
import { GeometryHashSchema } from "./p1-floorplan-adjustment.js";
import { LayoutIntentHashSchema } from "./layout-intent.js";
import { IdSchema, TimestampSchema } from "./common.js";

export const SchemePagePresentationDepthSchema = z.enum(["primary", "standard", "light"]);

export const SchemePageTraceSummarySchema = z
  .object({
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    schemeId: IdSchema
  })
  .strict();

export const SchemePageHeaderSchema = z
  .object({
    title: z.string().min(1),
    schemeId: IdSchema,
    status: DesignKernelStatusSchema,
    briefSummary: z.string().min(1),
    createdAt: TimestampSchema
  })
  .strict();

export const SchemePageCoverageSummarySchema = z
  .object({
    totalRooms: z.number().int().positive(),
    primaryRooms: z.number().int().nonnegative(),
    standardRooms: z.number().int().nonnegative(),
    lightRooms: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    failCount: z.number().int().nonnegative()
  })
  .strict();

export const SchemePageBudgetSummarySchema = z
  .object({
    band: z.enum(["unknown", "starter", "standard", "premium", "luxury"]),
    currency: z.literal("CNY"),
    minCny: z.number().nonnegative().optional(),
    maxCny: z.number().nonnegative().optional(),
    notes: z.array(z.string().min(1))
  })
  .strict();

export const SchemePageStyleSummarySchema = z
  .object({
    displayName: z.string().min(1),
    tags: z.array(z.string().min(1)),
    palette: z.array(z.string().min(1)),
    materialTags: z.array(z.string().min(1))
  })
  .strict();

export const SchemePageRoomActionHintSchema = z
  .object({
    actionId: IdSchema,
    kind: z.enum(["ready_for_render_spec_later", "needs_human_review", "layout_intent_present"]),
    label: z.string().min(1)
  })
  .strict();

export const SchemePageWarningSchema = z
  .object({
    warningId: IdSchema,
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1),
    roomId: IdSchema.optional()
  })
  .strict();

export const SchemePageRoomCardSchema = z
  .object({
    roomId: IdSchema,
    roomType: z.string().min(1),
    roomLabel: z.string().min(1),
    role: z.string().min(1),
    presentationDepth: SchemePagePresentationDepthSchema,
    summary: z.string().min(1),
    keyMoves: z.array(z.string().min(1)),
    warnings: z.array(z.string().min(1)),
    anchorRefs: z.array(IdSchema),
    layoutIntentRefs: z.array(IdSchema).optional(),
    trace: SchemePageTraceSummarySchema.omit({ schemeId: true }).strict()
  })
  .strict();

export const SchemePageViewModelSchema = z
  .object({
    version: z.literal("0.1"),
    header: SchemePageHeaderSchema,
    coverage: SchemePageCoverageSummarySchema,
    trace: SchemePageTraceSummarySchema,
    budget: SchemePageBudgetSummarySchema,
    style: SchemePageStyleSummarySchema,
    rooms: z.array(SchemePageRoomCardSchema).min(1),
    warnings: z.array(SchemePageWarningSchema),
    actions: z.array(SchemePageRoomActionHintSchema),
    generatedAt: TimestampSchema
  })
  .strict()
  .superRefine((viewModel, ctx) => {
    const countedRooms =
      viewModel.coverage.primaryRooms + viewModel.coverage.standardRooms + viewModel.coverage.lightRooms;
    if (countedRooms !== viewModel.coverage.totalRooms || countedRooms !== viewModel.rooms.length) {
      ctx.addIssue({
        code: "custom",
        message: "coverage room counts must match rendered rooms",
        path: ["coverage"]
      });
    }
    for (const [index, room] of viewModel.rooms.entries()) {
      if (
        room.trace.homeId !== viewModel.trace.homeId ||
        room.trace.floorplanRevisionId !== viewModel.trace.floorplanRevisionId ||
        room.trace.sceneContractId !== viewModel.trace.sceneContractId ||
        room.trace.geometryHash !== viewModel.trace.geometryHash ||
        room.trace.layoutIntentHash !== viewModel.trace.layoutIntentHash
      ) {
        ctx.addIssue({
          code: "custom",
          message: "room trace must match page trace",
          path: ["rooms", index, "trace"]
        });
      }
    }
  });

export const SchemePageVerificationCheckSchema = z
  .object({
    checkId: IdSchema,
    status: DesignKernelStatusSchema,
    message: z.string().min(1),
    roomId: IdSchema.optional()
  })
  .strict();

export const SchemePageVerificationSchema = z
  .object({
    status: DesignKernelStatusSchema,
    checks: z.array(SchemePageVerificationCheckSchema)
  })
  .strict();

export const SchemePageDebugPayloadSchema = z
  .object({
    request: z
      .object({
        schemeId: IdSchema
      })
      .strict(),
    scheme: SchemeLiteContractSchema,
    viewModel: SchemePageViewModelSchema,
    schemeVerification: SchemeVerificationSchema,
    pageVerification: SchemePageVerificationSchema,
    trace: SchemePageTraceSummarySchema,
    coverage: SchemePageCoverageSummarySchema,
    warnings: z.array(SchemePageWarningSchema)
  })
  .strict();

export const SchemePagePreviewRequestSchema = z
  .object({
    scheme: SchemeLiteContractSchema
  })
  .strict();

export const SchemePagePreviewResponseSchema = z
  .object({
    ok: z.literal(true),
    debug: SchemePageDebugPayloadSchema
  })
  .strict();

export type SchemePagePresentationDepth = z.infer<typeof SchemePagePresentationDepthSchema>;
export type SchemePageTraceSummary = z.infer<typeof SchemePageTraceSummarySchema>;
export type SchemePageHeader = z.infer<typeof SchemePageHeaderSchema>;
export type SchemePageCoverageSummary = z.infer<typeof SchemePageCoverageSummarySchema>;
export type SchemePageBudgetSummary = z.infer<typeof SchemePageBudgetSummarySchema>;
export type SchemePageStyleSummary = z.infer<typeof SchemePageStyleSummarySchema>;
export type SchemePageRoomActionHint = z.infer<typeof SchemePageRoomActionHintSchema>;
export type SchemePageWarning = z.infer<typeof SchemePageWarningSchema>;
export type SchemePageRoomCard = z.infer<typeof SchemePageRoomCardSchema>;
export type SchemePageViewModel = z.infer<typeof SchemePageViewModelSchema>;
export type SchemePageVerificationCheck = z.infer<typeof SchemePageVerificationCheckSchema>;
export type SchemePageVerification = z.infer<typeof SchemePageVerificationSchema>;
export type SchemePageDebugPayload = z.infer<typeof SchemePageDebugPayloadSchema>;
export type SchemePagePreviewRequest = z.infer<typeof SchemePagePreviewRequestSchema>;
export type SchemePagePreviewResponse = z.infer<typeof SchemePagePreviewResponseSchema>;
