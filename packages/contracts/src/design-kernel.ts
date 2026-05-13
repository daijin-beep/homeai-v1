import { z } from "zod";
import { ConfidenceSchema, IdSchema, TimestampSchema } from "./common.js";
import {
  GeometryHashSchema,
  P1AnchorPlanSchema,
  P1RoomAffordanceGraphSchema,
  P1RoomCameraPlanBatchSchema,
  P1RoomTypeSchema,
  P1SceneContractV02Schema
} from "./p1-floorplan-adjustment.js";
import { LayoutIntentContractSchema, LayoutIntentHashSchema } from "./layout-intent.js";

export const DesignKernelStatusSchema = z.enum(["pass", "warning", "fail"]);

export const DesignKernelBudgetBandSchema = z.enum([
  "unknown",
  "starter",
  "standard",
  "premium",
  "luxury"
]);

export const UserBriefInputSchema = z
  .object({
    homeId: IdSchema,
    text: z.string().trim().min(1).optional(),
    language: z.enum(["zh-CN", "en-US", "unknown"]),
    styleTags: z.array(z.string().min(1)).optional(),
    budgetBand: DesignKernelBudgetBandSchema,
    budgetMinCny: z.number().nonnegative().optional(),
    budgetMaxCny: z.number().nonnegative().optional(),
    householdHints: z.array(z.string().min(1)).optional(),
    functionalNeeds: z.array(z.string().min(1)).optional(),
    avoid: z.array(z.string().min(1)).optional(),
    source: z.enum(["user_text", "debug_fixture", "default"])
  })
  .strict()
  .superRefine((brief, ctx) => {
    if (brief.source !== "default" && brief.text === undefined && (brief.styleTags?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        message: "non-default brief input requires text or style tags",
        path: ["text"]
      });
    }
    if (
      brief.budgetMinCny !== undefined &&
      brief.budgetMaxCny !== undefined &&
      brief.budgetMinCny > brief.budgetMaxCny
    ) {
      ctx.addIssue({
        code: "custom",
        message: "budgetMinCny cannot be greater than budgetMaxCny",
        path: ["budgetMinCny"]
      });
    }
  });

export const DesignBriefLiteSchema = z
  .object({
    summary: z.string().min(1),
    language: UserBriefInputSchema.shape.language,
    householdProfile: z.array(z.string().min(1)),
    functionalNeeds: z.array(z.string().min(1)),
    avoid: z.array(z.string().min(1)),
    unknowns: z.array(z.string().min(1)),
    source: z.enum(["deterministic_mock", "provider", "default"])
  })
  .strict();

export const BudgetProfileSchema = z
  .object({
    currency: z.literal("CNY"),
    band: DesignKernelBudgetBandSchema,
    minCny: z.number().nonnegative().optional(),
    maxCny: z.number().nonnegative().optional(),
    confidence: ConfidenceSchema,
    notes: z.array(z.string().min(1))
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

export const StylePacketSchema = z
  .object({
    styleId: IdSchema,
    displayName: z.string().min(1),
    tags: z.array(z.string().min(1)),
    palette: z.array(z.string().min(1)),
    materialTags: z.array(z.string().min(1)),
    avoidTokens: z.array(z.string().min(1)),
    source: z.enum(["user_brief", "deterministic_default", "provider"]),
    confidence: ConfidenceSchema
  })
  .strict();

export const RoomRolePlanItemSchema = z
  .object({
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    displayLabel: z.string().min(1).optional(),
    inferredRole: z.string().min(1),
    confidence: ConfidenceSchema,
    source: z.enum([
      "scene_room_type",
      "affordance_graph",
      "layout_intent",
      "deterministic_default"
    ]),
    reasons: z.array(z.string().min(1)),
    riskFlags: z.array(z.string().min(1))
  })
  .strict();

export const RoomRolePlanSchema = z
  .object({
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    rooms: z.array(RoomRolePlanItemSchema)
  })
  .strict();

export const RoomSchemeLiteAnchorRefSchema = z
  .object({
    anchorPlanId: IdSchema,
    anchorId: IdSchema,
    type: z.enum(["wall", "window", "room_center", "corner", "opening_adjacent"]),
    targetId: IdSchema.optional()
  })
  .strict();

export const RoomSchemeLiteLayoutIntentRefSchema = z
  .object({
    layoutIntentRevisionId: IdSchema,
    placeholderId: IdSchema,
    category: z.string().min(1),
    label: z.string().min(1).optional()
  })
  .strict();

export const RoomSchemeLiteIssueSchema = z
  .object({
    issueId: IdSchema,
    severity: z.enum(["info", "warning", "error"]),
    code: z.string().min(1),
    message: z.string().min(1)
  })
  .strict();

export const RoomSchemeLiteSchema = z
  .object({
    roomSchemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    roomId: IdSchema,
    roomType: P1RoomTypeSchema,
    displayLabel: z.string().min(1).optional(),
    role: z.string().min(1),
    status: DesignKernelStatusSchema,
    designIntent: z.string().min(1),
    keyMoves: z.array(z.string().min(1)),
    storageStrategy: z.string().min(1),
    circulationNotes: z.array(z.string().min(1)),
    lightingNotes: z.array(z.string().min(1)),
    anchorRefs: z.array(RoomSchemeLiteAnchorRefSchema),
    layoutIntentRefs: z.array(RoomSchemeLiteLayoutIntentRefSchema),
    riskFlags: z.array(z.string().min(1)),
    issues: z.array(RoomSchemeLiteIssueSchema)
  })
  .strict();

export const SchemeVerificationCheckSchema = z
  .object({
    checkId: IdSchema,
    status: DesignKernelStatusSchema,
    message: z.string().min(1),
    roomId: IdSchema.optional()
  })
  .strict();

export const SchemeVerificationSchema = z
  .object({
    status: DesignKernelStatusSchema,
    checks: z.array(SchemeVerificationCheckSchema)
  })
  .strict();

export const DesignKernelProviderTraceSchema = z
  .object({
    traceId: IdSchema,
    providerName: z.literal("deterministic_mock"),
    providerVersion: z.string().min(1),
    mode: z.literal("contract_only"),
    inputId: IdSchema,
    status: DesignKernelStatusSchema,
    networkCalls: z.literal(false),
    warnings: z.array(z.string().min(1)),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema
  })
  .strict();

export const SchemeLiteContractSchema = z
  .object({
    version: z.literal("0.1"),
    schemeId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    brief: DesignBriefLiteSchema,
    budget: BudgetProfileSchema,
    style: StylePacketSchema,
    roomRolePlan: RoomRolePlanSchema,
    rooms: z.array(RoomSchemeLiteSchema).min(1),
    verification: SchemeVerificationSchema,
    trace: DesignKernelProviderTraceSchema,
    createdAt: TimestampSchema
  })
  .strict()
  .superRefine((scheme, ctx) => {
    if (scheme.roomRolePlan.homeId !== scheme.homeId) {
      ctx.addIssue({ code: "custom", message: "roomRolePlan homeId must match scheme", path: ["roomRolePlan", "homeId"] });
    }
    if (scheme.roomRolePlan.floorplanRevisionId !== scheme.floorplanRevisionId) {
      ctx.addIssue({
        code: "custom",
        message: "roomRolePlan floorplanRevisionId must match scheme",
        path: ["roomRolePlan", "floorplanRevisionId"]
      });
    }
    if (scheme.roomRolePlan.sceneContractId !== scheme.sceneContractId) {
      ctx.addIssue({
        code: "custom",
        message: "roomRolePlan sceneContractId must match scheme",
        path: ["roomRolePlan", "sceneContractId"]
      });
    }
    if (scheme.roomRolePlan.geometryHash !== scheme.geometryHash) {
      ctx.addIssue({
        code: "custom",
        message: "roomRolePlan geometryHash must match scheme",
        path: ["roomRolePlan", "geometryHash"]
      });
    }
    if (scheme.layoutIntentHash !== scheme.roomRolePlan.layoutIntentHash) {
      ctx.addIssue({
        code: "custom",
        message: "layoutIntentHash must match roomRolePlan",
        path: ["layoutIntentHash"]
      });
    }
    for (const [index, room] of scheme.rooms.entries()) {
      if (
        room.homeId !== scheme.homeId ||
        room.floorplanRevisionId !== scheme.floorplanRevisionId ||
        room.sceneContractId !== scheme.sceneContractId ||
        room.geometryHash !== scheme.geometryHash ||
        room.layoutIntentHash !== scheme.layoutIntentHash
      ) {
        ctx.addIssue({
          code: "custom",
          message: "room scheme trace must match parent scheme",
          path: ["rooms", index]
        });
      }
    }
  });

export const DesignKernelInputSchema = z
  .object({
    inputId: IdSchema,
    homeId: IdSchema,
    floorplanRevisionId: IdSchema,
    sceneContractId: IdSchema,
    geometryHash: GeometryHashSchema,
    sceneContract: P1SceneContractV02Schema,
    roomAffordanceGraph: P1RoomAffordanceGraphSchema,
    anchorPlans: z.array(P1AnchorPlanSchema).min(1),
    cameraPlan: P1RoomCameraPlanBatchSchema.optional(),
    layoutIntentContract: LayoutIntentContractSchema.optional(),
    layoutIntentHash: LayoutIntentHashSchema.optional(),
    userBriefInput: UserBriefInputSchema,
    source: z.enum(["p1_confirmed_scene_contract", "fixture", "debug"])
  })
  .strict()
  .superRefine((input, ctx) => {
    const traceChecks: Array<[boolean, string, (string | number)[]]> = [
      [input.sceneContract.homeId === input.homeId, "sceneContract homeId must match input", ["sceneContract", "homeId"]],
      [
        input.sceneContract.canonicalRevisionId === input.floorplanRevisionId,
        "sceneContract canonicalRevisionId must match floorplanRevisionId",
        ["sceneContract", "canonicalRevisionId"]
      ],
      [
        input.sceneContract.sceneContractId === input.sceneContractId,
        "sceneContractId must match input",
        ["sceneContract", "sceneContractId"]
      ],
      [
        input.sceneContract.geometryHash === input.geometryHash,
        "sceneContract geometryHash must match input",
        ["sceneContract", "geometryHash"]
      ],
      [
        input.roomAffordanceGraph.homeId === input.homeId,
        "affordance graph homeId must match input",
        ["roomAffordanceGraph", "homeId"]
      ],
      [
        input.roomAffordanceGraph.canonicalRevisionId === input.floorplanRevisionId,
        "affordance graph canonicalRevisionId must match input",
        ["roomAffordanceGraph", "canonicalRevisionId"]
      ],
      [
        input.roomAffordanceGraph.sceneContractId === input.sceneContractId,
        "affordance graph sceneContractId must match input",
        ["roomAffordanceGraph", "sceneContractId"]
      ],
      [
        input.roomAffordanceGraph.geometryHash === input.geometryHash,
        "affordance graph geometryHash must match input",
        ["roomAffordanceGraph", "geometryHash"]
      ],
      [
        input.userBriefInput.homeId === input.homeId,
        "user brief homeId must match input",
        ["userBriefInput", "homeId"]
      ]
    ];
    for (const [passes, message, path] of traceChecks) {
      if (!passes) {
        ctx.addIssue({ code: "custom", message, path });
      }
    }
    for (const [index, anchorPlan] of input.anchorPlans.entries()) {
      if (
        anchorPlan.homeId !== input.homeId ||
        anchorPlan.canonicalRevisionId !== input.floorplanRevisionId ||
        anchorPlan.sceneContractId !== input.sceneContractId ||
        anchorPlan.geometryHash !== input.geometryHash ||
        anchorPlan.affordanceGraphId !== input.roomAffordanceGraph.affordanceGraphId
      ) {
        ctx.addIssue({
          code: "custom",
          message: "anchor plan trace must match input and affordance graph",
          path: ["anchorPlans", index]
        });
      }
    }
    if (
      input.cameraPlan !== undefined &&
      (
        input.cameraPlan.homeId !== input.homeId ||
        input.cameraPlan.canonicalRevisionId !== input.floorplanRevisionId ||
        input.cameraPlan.sceneContractId !== input.sceneContractId ||
        input.cameraPlan.geometryHash !== input.geometryHash
      )
    ) {
      ctx.addIssue({ code: "custom", message: "camera plan trace must match input", path: ["cameraPlan"] });
    }
    if (input.layoutIntentContract === undefined && input.layoutIntentHash !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "layoutIntentHash cannot be provided without LayoutIntentContract",
        path: ["layoutIntentHash"]
      });
    }
    if (input.layoutIntentContract !== undefined) {
      const layout = input.layoutIntentContract;
      if (
        layout.homeId !== input.homeId ||
        layout.canonicalRevisionId !== input.floorplanRevisionId ||
        layout.sceneContractId !== input.sceneContractId ||
        layout.geometryHash !== input.geometryHash
      ) {
        ctx.addIssue({ code: "custom", message: "layout intent trace must match input", path: ["layoutIntentContract"] });
      }
      if (input.layoutIntentHash !== layout.layoutIntentHash) {
        ctx.addIssue({
          code: "custom",
          message: "layoutIntentHash must be copied from LayoutIntentContract",
          path: ["layoutIntentHash"]
        });
      }
    }
  });

export const DesignKernelDebugPayloadSchema = z
  .object({
    input: DesignKernelInputSchema,
    scheme: SchemeLiteContractSchema,
    verification: SchemeVerificationSchema,
    trace: DesignKernelProviderTraceSchema,
    coverage: z
      .object({
        sceneRoomCount: z.number().int().nonnegative(),
        roomSchemeCount: z.number().int().nonnegative(),
        hasLayoutIntent: z.boolean(),
        anchorRefCount: z.number().int().nonnegative(),
        layoutIntentRefCount: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();

export const DesignKernelPreviewRequestSchema = z
  .object({
    input: DesignKernelInputSchema
  })
  .strict();

export const DesignKernelPreviewResponseSchema = z
  .object({
    ok: z.literal(true),
    debug: DesignKernelDebugPayloadSchema
  })
  .strict();

export type DesignKernelStatus = z.infer<typeof DesignKernelStatusSchema>;
export type DesignKernelBudgetBand = z.infer<typeof DesignKernelBudgetBandSchema>;
export type UserBriefInput = z.infer<typeof UserBriefInputSchema>;
export type DesignBriefLite = z.infer<typeof DesignBriefLiteSchema>;
export type BudgetProfile = z.infer<typeof BudgetProfileSchema>;
export type StylePacket = z.infer<typeof StylePacketSchema>;
export type RoomRolePlanItem = z.infer<typeof RoomRolePlanItemSchema>;
export type RoomRolePlan = z.infer<typeof RoomRolePlanSchema>;
export type RoomSchemeLiteAnchorRef = z.infer<typeof RoomSchemeLiteAnchorRefSchema>;
export type RoomSchemeLiteLayoutIntentRef = z.infer<typeof RoomSchemeLiteLayoutIntentRefSchema>;
export type RoomSchemeLiteIssue = z.infer<typeof RoomSchemeLiteIssueSchema>;
export type RoomSchemeLite = z.infer<typeof RoomSchemeLiteSchema>;
export type SchemeVerificationCheck = z.infer<typeof SchemeVerificationCheckSchema>;
export type SchemeVerification = z.infer<typeof SchemeVerificationSchema>;
export type DesignKernelProviderTrace = z.infer<typeof DesignKernelProviderTraceSchema>;
export type SchemeLiteContract = z.infer<typeof SchemeLiteContractSchema>;
export type DesignKernelInput = z.infer<typeof DesignKernelInputSchema>;
export type DesignKernelDebugPayload = z.infer<typeof DesignKernelDebugPayloadSchema>;
export type DesignKernelPreviewRequest = z.infer<typeof DesignKernelPreviewRequestSchema>;
export type DesignKernelPreviewResponse = z.infer<typeof DesignKernelPreviewResponseSchema>;
