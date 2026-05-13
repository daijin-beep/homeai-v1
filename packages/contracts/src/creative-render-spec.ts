import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common.js";
import {
  DesignKernelBudgetBandSchema,
  DesignKernelStatusSchema,
  SchemeLiteContractSchema,
  SchemeVerificationSchema
} from "./design-kernel.js";
import { LayoutIntentHashSchema } from "./layout-intent.js";
import { GeometryHashSchema, P1RoomTypeSchema } from "./p1-floorplan-adjustment.js";

export const CreativeRenderAssetKindSchema = z.enum([
  "control_render",
  "depth_map",
  "semantic_mask",
  "line_map",
  "locked_geometry_mask",
  "anchor_layout_mask"
]);

const DevFixtureUriSchema = z.string().regex(/^(dev|fixture):\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=-]+$/);

export const CreativeRenderAssetRefSchema = z
  .object({
    assetId: IdSchema,
    kind: CreativeRenderAssetKindSchema,
    roomId: IdSchema,
    geometryHash: GeometryHashSchema,
    uri: DevFixtureUriSchema
  })
  .strict();

export const CreativeRenderCameraRefSchema = z
  .object({
    cameraId: IdSchema,
    roomId: IdSchema,
    label: z.string().min(1),
    source: z.enum(["camera_plan", "fixture", "debug"]),
    geometryHash: GeometryHashSchema
  })
  .strict();

export const CreativeRenderHardConstraintsSchema = z
  .object({
    preserveWalls: z.literal(true),
    preserveDoors: z.literal(true),
    preserveWindows: z.literal(true),
    preserveRoomProportion: z.literal(true),
    preserveAnchorZones: z.literal(true)
  })
  .strict();

export const CreativeRenderStyleDirectiveSchema = z
  .object({
    displayName: z.string().min(1),
    tags: z.array(z.string().min(1)),
    palette: z.array(z.string().min(1)),
    materialTags: z.array(z.string().min(1)),
    avoidTokens: z.array(z.string().min(1))
  })
  .strict();

export const CreativeRenderBudgetDirectiveSchema = z
  .object({
    band: DesignKernelBudgetBandSchema,
    currency: z.literal("CNY"),
    minCny: z.number().nonnegative().optional(),
    maxCny: z.number().nonnegative().optional()
  })
  .strict()
  .superRefine((budget, ctx) => {
    if (budget.minCny !== undefined && budget.maxCny !== undefined && budget.minCny > budget.maxCny) {
      ctx.addIssue({
        code: "custom",
        message: "minCny cannot be greater than maxCny",
        path: ["minCny"]
      });
    }
  });

export const CreativeRenderSpecTraceSchema = z
  .object({
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    roomId: IdSchema,
    cameraId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    source: z.enum(["contract_compiler", "fixture", "debug"]),
    compilerVersion: z.string().min(1)
  })
  .strict();

export const CreativeRenderPromptDirectivesSchema = z
  .object({
    positive: z.array(z.string().min(1)),
    negative: z.array(z.string().min(1)),
    forbiddenChanges: z.array(z.string().min(1))
  })
  .strict();

export const CreativeRenderSpecInputsSchema = z
  .object({
    controlRender: CreativeRenderAssetRefSchema.extend({ kind: z.literal("control_render") }).strict(),
    depthMap: CreativeRenderAssetRefSchema.extend({ kind: z.literal("depth_map") }).strict(),
    semanticMask: CreativeRenderAssetRefSchema.extend({ kind: z.literal("semantic_mask") }).strict(),
    lineMap: CreativeRenderAssetRefSchema.extend({ kind: z.literal("line_map") }).strict(),
    lockedGeometryMask: CreativeRenderAssetRefSchema.extend({ kind: z.literal("locked_geometry_mask") }).strict(),
    anchorLayoutMask: CreativeRenderAssetRefSchema.extend({ kind: z.literal("anchor_layout_mask") }).strict()
  })
  .strict();

export const CreativeRenderSpecSchema = z
  .object({
    renderSpecId: IdSchema,
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    cameraId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    sourceRoomSchemeId: IdSchema.optional(),
    inputs: CreativeRenderSpecInputsSchema,
    hardConstraints: CreativeRenderHardConstraintsSchema,
    style: CreativeRenderStyleDirectiveSchema,
    budget: CreativeRenderBudgetDirectiveSchema,
    anchorRefs: z.array(IdSchema),
    layoutIntentRefs: z.array(IdSchema).optional(),
    promptDirectives: CreativeRenderPromptDirectivesSchema,
    trace: CreativeRenderSpecTraceSchema
  })
  .strict()
  .superRefine((spec, ctx) => {
    const traceMatches =
      spec.trace.renderSpecId === spec.renderSpecId &&
      spec.trace.schemeId === spec.schemeId &&
      spec.trace.homeId === spec.homeId &&
      spec.trace.floorplanRevisionId === spec.floorplanRevisionId &&
      spec.trace.sceneContractId === spec.sceneContractId &&
      spec.trace.roomId === spec.roomId &&
      spec.trace.cameraId === spec.cameraId &&
      spec.trace.geometryHash === spec.geometryHash &&
      spec.trace.layoutIntentHash === spec.layoutIntentHash;
    if (!traceMatches) {
      ctx.addIssue({ code: "custom", message: "spec trace must match render spec fields", path: ["trace"] });
    }

    for (const [inputKey, asset] of Object.entries(spec.inputs)) {
      if (asset.roomId !== spec.roomId || asset.geometryHash !== spec.geometryHash) {
        ctx.addIssue({
          code: "custom",
          message: "asset roomId and geometryHash must match render spec",
          path: ["inputs", inputKey]
        });
      }
    }
  });

export const CreativeRenderSpecVerificationCheckSchema = z
  .object({
    checkId: IdSchema,
    status: DesignKernelStatusSchema,
    message: z.string().min(1),
    roomId: IdSchema.optional(),
    renderSpecId: IdSchema.optional()
  })
  .strict();

export const CreativeRenderSpecVerificationSchema = z
  .object({
    status: DesignKernelStatusSchema,
    checks: z.array(CreativeRenderSpecVerificationCheckSchema)
  })
  .strict();

export const CreativeRenderSpecProviderTraceSchema = z
  .object({
    traceId: IdSchema,
    compilerName: z.literal("deterministic_creative_render_spec_compiler"),
    compilerVersion: z.string().min(1),
    mode: z.literal("contract_only"),
    status: DesignKernelStatusSchema,
    networkCalls: z.literal(false),
    warnings: z.array(z.string().min(1)),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema
  })
  .strict();

export const CreativeRenderSpecBatchSchema = z
  .object({
    batchId: IdSchema,
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    specs: z.array(CreativeRenderSpecSchema).min(1),
    verification: CreativeRenderSpecVerificationSchema,
    trace: CreativeRenderSpecProviderTraceSchema,
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((batch, ctx) => {
    for (const [index, spec] of batch.specs.entries()) {
      if (
        spec.schemeId !== batch.schemeId ||
        spec.homeId !== batch.homeId ||
        spec.floorplanRevisionId !== batch.floorplanRevisionId ||
        spec.sceneContractId !== batch.sceneContractId ||
        spec.geometryHash !== batch.geometryHash ||
        spec.layoutIntentHash !== batch.layoutIntentHash
      ) {
        ctx.addIssue({
          code: "custom",
          message: "render spec trace fields must match batch",
          path: ["specs", index]
        });
      }
    }
  });

export const CreativeRenderSpecInputSchema = z
  .object({
    inputId: IdSchema,
    scheme: SchemeLiteContractSchema,
    cameraRefs: z.array(CreativeRenderCameraRefSchema).min(1),
    controlAssets: z.array(CreativeRenderAssetRefSchema).min(1),
    source: z.enum(["scheme_lite_contract", "fixture", "debug"]),
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((input, ctx) => {
    const roomIds = new Set(input.scheme.rooms.map((room) => room.roomId));
    for (const [index, camera] of input.cameraRefs.entries()) {
      if (!roomIds.has(camera.roomId)) {
        ctx.addIssue({ code: "custom", message: "camera roomId must exist in scheme", path: ["cameraRefs", index, "roomId"] });
      }
      if (camera.geometryHash !== input.scheme.geometryHash) {
        ctx.addIssue({
          code: "custom",
          message: "camera geometryHash must match scheme",
          path: ["cameraRefs", index, "geometryHash"]
        });
      }
    }
    for (const [index, asset] of input.controlAssets.entries()) {
      if (!roomIds.has(asset.roomId)) {
        ctx.addIssue({ code: "custom", message: "asset roomId must exist in scheme", path: ["controlAssets", index, "roomId"] });
      }
      if (asset.geometryHash !== input.scheme.geometryHash) {
        ctx.addIssue({
          code: "custom",
          message: "asset geometryHash must match scheme",
          path: ["controlAssets", index, "geometryHash"]
        });
      }
    }
  });

export const CreativeRenderSpecDebugPayloadSchema = z
  .object({
    input: CreativeRenderSpecInputSchema,
    batch: CreativeRenderSpecBatchSchema,
    schemeVerification: SchemeVerificationSchema,
    renderSpecVerification: CreativeRenderSpecVerificationSchema,
    trace: CreativeRenderSpecProviderTraceSchema,
    coverage: z
      .object({
        schemeRoomCount: z.number().int().nonnegative(),
        renderSpecCount: z.number().int().nonnegative(),
        roomsWithSpecs: z.number().int().nonnegative(),
        hasLayoutIntent: z.boolean()
      })
      .strict()
  })
  .strict();

export const CreativeRenderSpecPreviewRequestSchema = z
  .object({
    input: CreativeRenderSpecInputSchema
  })
  .strict();

export const CreativeRenderSpecPreviewResponseSchema = z
  .object({
    ok: z.literal(true),
    debug: CreativeRenderSpecDebugPayloadSchema
  })
  .strict();

export type CreativeRenderAssetKind = z.infer<typeof CreativeRenderAssetKindSchema>;
export type CreativeRenderAssetRef = z.infer<typeof CreativeRenderAssetRefSchema>;
export type CreativeRenderCameraRef = z.infer<typeof CreativeRenderCameraRefSchema>;
export type CreativeRenderHardConstraints = z.infer<typeof CreativeRenderHardConstraintsSchema>;
export type CreativeRenderStyleDirective = z.infer<typeof CreativeRenderStyleDirectiveSchema>;
export type CreativeRenderBudgetDirective = z.infer<typeof CreativeRenderBudgetDirectiveSchema>;
export type CreativeRenderSpecTrace = z.infer<typeof CreativeRenderSpecTraceSchema>;
export type CreativeRenderPromptDirectives = z.infer<typeof CreativeRenderPromptDirectivesSchema>;
export type CreativeRenderSpecInputs = z.infer<typeof CreativeRenderSpecInputsSchema>;
export type CreativeRenderSpec = z.infer<typeof CreativeRenderSpecSchema>;
export type CreativeRenderSpecVerificationCheck = z.infer<typeof CreativeRenderSpecVerificationCheckSchema>;
export type CreativeRenderSpecVerification = z.infer<typeof CreativeRenderSpecVerificationSchema>;
export type CreativeRenderSpecProviderTrace = z.infer<typeof CreativeRenderSpecProviderTraceSchema>;
export type CreativeRenderSpecBatch = z.infer<typeof CreativeRenderSpecBatchSchema>;
export type CreativeRenderSpecInput = z.infer<typeof CreativeRenderSpecInputSchema>;
export type CreativeRenderSpecDebugPayload = z.infer<typeof CreativeRenderSpecDebugPayloadSchema>;
export type CreativeRenderSpecPreviewRequest = z.infer<typeof CreativeRenderSpecPreviewRequestSchema>;
export type CreativeRenderSpecPreviewResponse = z.infer<typeof CreativeRenderSpecPreviewResponseSchema>;
