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

export const CreativeRenderSpecCoverageStatusSchema = z.enum([
  "covered",
  "cautious",
  "non_renderable",
  "missing_scheme_room",
  "missing_camera_plan",
  "missing_asset",
  "insufficient_specs",
  "geometry_hash_mismatch",
  "invalid_spec"
]);

export const CreativeRenderSpecCompilerIssueSchema = z
  .object({
    issueId: IdSchema,
    severity: z.enum(["info", "warning", "blocking"]),
    code: z.string().min(1),
    message: z.string().min(1),
    roomId: IdSchema.optional(),
    cameraId: IdSchema.optional(),
    assetKind: CreativeRenderAssetKindSchema.optional()
  })
  .strict();

export const CreativeRenderSpecCoveragePolicySchema = z
  .object({
    includeCautiousRooms: z.boolean(),
    minSpecsPerValidRoom: z.number().int().positive()
  })
  .strict();

export const CreativeRenderSpecRoomCoverageSummarySchema = z
  .object({
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    status: CreativeRenderSpecCoverageStatusSchema,
    renderableCameraCount: z.number().int().nonnegative(),
    emittedSpecCount: z.number().int().nonnegative(),
    requiredSpecCount: z.number().int().nonnegative(),
    cameraIds: z.array(IdSchema),
    specIds: z.array(IdSchema),
    issueIds: z.array(IdSchema)
  })
  .strict()
  .superRefine((room, ctx) => {
    if (room.emittedSpecCount !== room.specIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "emittedSpecCount must match specIds",
        path: ["emittedSpecCount"]
      });
    }
    if (room.renderableCameraCount !== room.cameraIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "renderableCameraCount must match cameraIds",
        path: ["renderableCameraCount"]
      });
    }
    if (room.status === "non_renderable" && (room.requiredSpecCount !== 0 || room.emittedSpecCount !== 0)) {
      ctx.addIssue({
        code: "custom",
        message: "non_renderable rooms must not require or emit specs",
        path: ["status"]
      });
    }
  });

export const CreativeRenderSpecBatchSummarySchema = z
  .object({
    status: DesignKernelStatusSchema,
    policy: CreativeRenderSpecCoveragePolicySchema,
    sceneRoomCount: z.number().int().nonnegative(),
    coveredRoomCount: z.number().int().nonnegative(),
    cautiousRoomCount: z.number().int().nonnegative(),
    nonRenderableRoomCount: z.number().int().nonnegative(),
    missingRoomCount: z.number().int().nonnegative(),
    renderableCameraCount: z.number().int().nonnegative(),
    emittedSpecCount: z.number().int().nonnegative(),
    rooms: z.array(CreativeRenderSpecRoomCoverageSummarySchema)
  })
  .strict()
  .superRefine((summary, ctx) => {
    const coveredRooms = summary.rooms.filter((room) => room.status === "covered" || room.status === "cautious").length;
    const cautiousRooms = summary.rooms.filter((room) => room.status === "cautious").length;
    const nonRenderableRooms = summary.rooms.filter((room) => room.status === "non_renderable").length;
    const missingRooms = summary.rooms.filter((room) =>
      room.status !== "covered" && room.status !== "cautious" && room.status !== "non_renderable"
    ).length;
    const renderableCameraCount = summary.rooms.reduce((sum, room) => sum + room.renderableCameraCount, 0);
    const emittedSpecCount = summary.rooms.reduce((sum, room) => sum + room.emittedSpecCount, 0);

    const checks = [
      { path: ["sceneRoomCount"], actual: summary.sceneRoomCount, expected: summary.rooms.length },
      { path: ["coveredRoomCount"], actual: summary.coveredRoomCount, expected: coveredRooms },
      { path: ["cautiousRoomCount"], actual: summary.cautiousRoomCount, expected: cautiousRooms },
      { path: ["nonRenderableRoomCount"], actual: summary.nonRenderableRoomCount, expected: nonRenderableRooms },
      { path: ["missingRoomCount"], actual: summary.missingRoomCount, expected: missingRooms },
      { path: ["renderableCameraCount"], actual: summary.renderableCameraCount, expected: renderableCameraCount },
      { path: ["emittedSpecCount"], actual: summary.emittedSpecCount, expected: emittedSpecCount }
    ];

    for (const check of checks) {
      if (check.actual !== check.expected) {
        ctx.addIssue({
          code: "custom",
          message: `${check.path[0]} must match room coverage`,
          path: check.path
        });
      }
    }
  });

export const CreativeRenderSpecCompilerTraceSchema = z
  .object({
    traceId: IdSchema,
    compilerName: z.literal("deterministic_creative_render_spec_compiler"),
    compilerVersion: z.string().min(1),
    mode: z.literal("contract_only"),
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    networkCalls: z.literal(false),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema
  })
  .strict();

export const CreativeRenderSpecCompilerOutputSchema = z
  .object({
    specs: z.array(CreativeRenderSpecSchema),
    summary: CreativeRenderSpecBatchSummarySchema,
    issues: z.array(CreativeRenderSpecCompilerIssueSchema),
    trace: CreativeRenderSpecCompilerTraceSchema
  })
  .strict()
  .superRefine((output, ctx) => {
    if (output.summary.emittedSpecCount !== output.specs.length) {
      ctx.addIssue({
        code: "custom",
        message: "summary emittedSpecCount must match specs",
        path: ["summary", "emittedSpecCount"]
      });
    }
    const issueIds = new Set(output.issues.map((issue) => issue.issueId));
    for (const [roomIndex, room] of output.summary.rooms.entries()) {
      for (const issueId of room.issueIds) {
        if (!issueIds.has(issueId)) {
          ctx.addIssue({
            code: "custom",
            message: "room issueIds must reference compiler issues",
            path: ["summary", "rooms", roomIndex, "issueIds"]
          });
        }
      }
    }
  });

export const CreativeRenderSpecDispatchRoomStatusSchema = z.enum([
  "ready",
  "render_asset_pending",
  "render_ineligible"
]);

export const CreativeRenderSpecDispatchRoomSchema = z
  .object({
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    status: CreativeRenderSpecDispatchRoomStatusSchema,
    renderSpecIds: z.array(IdSchema),
    issueIds: z.array(IdSchema)
  })
  .strict()
  .superRefine((room, ctx) => {
    if (room.status === "ready" && room.renderSpecIds.length === 0) {
      ctx.addIssue({ code: "custom", message: "ready rooms must include renderSpecIds", path: ["renderSpecIds"] });
    }
    if (room.status !== "ready" && room.renderSpecIds.length > 0) {
      ctx.addIssue({ code: "custom", message: "non-ready rooms must not include renderSpecIds", path: ["renderSpecIds"] });
    }
  });

export const CreativeRenderSpecDispatchPayloadSchema = z
  .object({
    dispatchId: IdSchema,
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    status: DesignKernelStatusSchema,
    specs: z.array(CreativeRenderSpecSchema),
    rooms: z.array(CreativeRenderSpecDispatchRoomSchema),
    coverage: CreativeRenderSpecBatchSummarySchema,
    trace: CreativeRenderSpecCompilerTraceSchema,
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (payload.coverage.sceneRoomCount !== payload.rooms.length) {
      ctx.addIssue({ code: "custom", message: "dispatch rooms must match coverage", path: ["rooms"] });
    }
    if (payload.coverage.emittedSpecCount !== payload.specs.length) {
      ctx.addIssue({ code: "custom", message: "dispatch specs must match coverage", path: ["specs"] });
    }
    for (const [index, spec] of payload.specs.entries()) {
      if (
        spec.schemeId !== payload.schemeId ||
        spec.homeId !== payload.homeId ||
        spec.floorplanRevisionId !== payload.floorplanRevisionId ||
        spec.sceneContractId !== payload.sceneContractId ||
        spec.geometryHash !== payload.geometryHash ||
        spec.layoutIntentHash !== payload.layoutIntentHash
      ) {
        ctx.addIssue({ code: "custom", message: "dispatch spec trace must match payload", path: ["specs", index] });
      }
    }
  });

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
export type CreativeRenderSpecCoverageStatus = z.infer<typeof CreativeRenderSpecCoverageStatusSchema>;
export type CreativeRenderSpecCompilerIssue = z.infer<typeof CreativeRenderSpecCompilerIssueSchema>;
export type CreativeRenderSpecCoveragePolicy = z.infer<typeof CreativeRenderSpecCoveragePolicySchema>;
export type CreativeRenderSpecRoomCoverageSummary = z.infer<typeof CreativeRenderSpecRoomCoverageSummarySchema>;
export type CreativeRenderSpecBatchSummary = z.infer<typeof CreativeRenderSpecBatchSummarySchema>;
export type CreativeRenderSpecCompilerTrace = z.infer<typeof CreativeRenderSpecCompilerTraceSchema>;
export type CreativeRenderSpecCompilerOutput = z.infer<typeof CreativeRenderSpecCompilerOutputSchema>;
export type CreativeRenderSpecDispatchRoomStatus = z.infer<typeof CreativeRenderSpecDispatchRoomStatusSchema>;
export type CreativeRenderSpecDispatchRoom = z.infer<typeof CreativeRenderSpecDispatchRoomSchema>;
export type CreativeRenderSpecDispatchPayload = z.infer<typeof CreativeRenderSpecDispatchPayloadSchema>;
export type CreativeRenderSpecBatch = z.infer<typeof CreativeRenderSpecBatchSchema>;
export type CreativeRenderSpecInput = z.infer<typeof CreativeRenderSpecInputSchema>;
export type CreativeRenderSpecDebugPayload = z.infer<typeof CreativeRenderSpecDebugPayloadSchema>;
export type CreativeRenderSpecPreviewRequest = z.infer<typeof CreativeRenderSpecPreviewRequestSchema>;
export type CreativeRenderSpecPreviewResponse = z.infer<typeof CreativeRenderSpecPreviewResponseSchema>;
