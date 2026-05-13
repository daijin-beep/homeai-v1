import { createHash } from "node:crypto";
import {
  AnchorPlannerInputContractSchema,
  FurniturePlaceholderSchema,
  LayoutIntentArtifactDependencySchema,
  LayoutIntentContractSchema,
  LayoutIntentEventSchema,
  LayoutIntentHashComparisonSchema,
  LayoutIntentHashInputSchema,
  LayoutIntentInvalidationSummarySchema,
  LayoutIntentOperationSchema,
  LayoutIntentRevisionSchema,
  LayoutIntentValidationStateSchema,
  type AnchorPlannerInputContract,
  type FurnitureCategory,
  type FurniturePlaceholder,
  type GeometryHash,
  type LayoutIntentArtifactDependency,
  type LayoutIntentContract,
  type LayoutIntentEvent,
  type LayoutIntentEventType,
  type LayoutIntentHash,
  type LayoutIntentHashComparison,
  type LayoutIntentHashInput,
  type LayoutIntentInvalidationSummary,
  type LayoutIntentOperation,
  type LayoutIntentRevision,
  type LayoutIntentValidationIssue,
  type LayoutIntentValidationState,
  type P1RoomAffordanceGraph,
  type P1SceneContractV02,
  type Point2D
} from "@homeai/contracts";
import type { LayoutIntentEventRepository, LayoutIntentRepository } from "./repositories.js";

export type CreateInitialLayoutIntentOptions = {
  layoutIntentRevisionId: string;
  revision?: number;
  source?: LayoutIntentRevision["source"];
  aiAutofillEnabled?: boolean;
  createdAt: string;
};

export type ConfirmLayoutIntentResult =
  | {
      ok: true;
      layoutIntentRevision: LayoutIntentRevision;
      layoutIntentContract: LayoutIntentContract;
    }
  | {
      ok: false;
      validation: LayoutIntentValidationState;
    };

export type LayoutIntentActor = {
  userId?: string;
  anonymousSessionId?: string;
};

export const LAYOUT_DEPENDENT_ARTIFACT_TYPES = [
  "AnchorPlan",
  "SchemeLiteContract",
  "RoomSchemeLite",
  "CreativeRenderSpec",
  "RenderJob",
  "RenderCandidate",
  "RenderVerificationReport",
  "RoomGallery",
  "SkuFitResult"
] as const;

const DEFAULT_DISPLAY_SIZES: Record<FurnitureCategory, { width: number; depth: number }> = {
  bed: { width: 1800, depth: 2000 },
  sofa: { width: 2200, depth: 900 },
  dining_table: { width: 1600, depth: 900 },
  dining_chair: { width: 500, depth: 500 },
  wardrobe: { width: 1600, depth: 600 },
  desk: { width: 1400, depth: 700 },
  tv_console: { width: 1800, depth: 450 },
  coffee_table: { width: 900, depth: 600 },
  side_table: { width: 500, depth: 500 },
  bookshelf: { width: 900, depth: 350 },
  shoe_cabinet: { width: 900, depth: 350 },
  storage_cabinet: { width: 1000, depth: 500 },
  washing_machine: { width: 600, depth: 650 },
  dryer: { width: 600, depth: 650 },
  fridge: { width: 800, depth: 750 },
  custom: { width: 800, depth: 800 }
};

export function defaultFurnitureDisplaySize(category: FurnitureCategory): { width: number; depth: number } {
  return { ...DEFAULT_DISPLAY_SIZES[category] };
}

export function computeLayoutIntentHash(input: LayoutIntentHashInput): LayoutIntentHash {
  const parsed = LayoutIntentHashInputSchema.parse(input);
  const normalized = {
    aiAutofillEnabled: parsed.aiAutofillEnabled,
    placeholders: [...parsed.placeholders]
      .map((placeholder) => ({
        placeholderId: placeholder.placeholderId,
        roomId: placeholder.roomId,
        category: placeholder.category,
        center: normalizePoint(placeholder.center),
        rotationDeg: normalizeNumber(placeholder.rotationDeg),
        displaySizeMm: {
          width: normalizeNumber(placeholder.displaySizeMm.width),
          depth: normalizeNumber(placeholder.displaySizeMm.depth)
        },
        sizeSource: placeholder.sizeSource,
        userResizable: placeholder.userResizable,
        source: placeholder.source,
        ...(placeholder.label === undefined ? {} : { label: placeholder.label })
      }))
      .sort((a, b) => a.placeholderId.localeCompare(b.placeholderId))
  };
  const digest = createHash("sha256").update(stableStringify(normalized)).digest("hex");
  return `sha256:${digest}`;
}

export function createInitialLayoutIntentFromSceneContract(
  sceneContract: P1SceneContractV02,
  options: CreateInitialLayoutIntentOptions
): LayoutIntentRevision {
  const hash = computeLayoutIntentHash({
    aiAutofillEnabled: options.aiAutofillEnabled ?? true,
    placeholders: []
  });
  const validation = LayoutIntentValidationStateSchema.parse({
    status: "valid",
    canConfirm: true,
    issues: [],
    validatedAt: options.createdAt
  });
  return deepFreeze(LayoutIntentRevisionSchema.parse({
    layoutIntentRevisionId: options.layoutIntentRevisionId,
    homeId: sceneContract.homeId,
    canonicalRevisionId: sceneContract.canonicalRevisionId,
    sceneContractId: sceneContract.sceneContractId,
    geometryHash: sceneContract.geometryHash,
    layoutIntentHash: hash,
    revision: options.revision ?? 1,
    source: options.source ?? "p1_advanced",
    aiAutofillEnabled: options.aiAutofillEnabled ?? true,
    placeholders: [],
    validation,
    createdAt: options.createdAt,
    updatedAt: options.createdAt
  }));
}

export function applyLayoutIntentOperations(
  layoutIntent: LayoutIntentRevision,
  operations: readonly LayoutIntentOperation[],
  options: { sceneContract: P1SceneContractV02; updatedAt: string; store?: LayoutIntentRepository } 
): LayoutIntentRevision {
  let current = clone(LayoutIntentRevisionSchema.parse(layoutIntent));
  for (const rawOperation of operations) {
    const operation = LayoutIntentOperationSchema.parse(rawOperation);
    current = applyLayoutIntentOperation(current, operation, options.updatedAt);
    options.store?.appendOperation(current.layoutIntentRevisionId, operation);
  }
  const validation = validateLayoutIntent(current, options.sceneContract, { validatedAt: options.updatedAt });
  const updated = deepFreeze(LayoutIntentRevisionSchema.parse({
    ...current,
    validation,
    updatedAt: options.updatedAt
  }));
  options.store?.updateLayoutIntentRevision(updated);
  return updated;
}

export function validateLayoutIntent(
  layoutIntentInput: unknown,
  sceneContract: P1SceneContractV02,
  options: { validatedAt: string; affordanceGraph?: P1RoomAffordanceGraph } 
): LayoutIntentValidationState {
  const issues: LayoutIntentValidationIssue[] = [];
  const parsedRevision = LayoutIntentRevisionSchema.safeParse(layoutIntentInput);
  const raw = layoutIntentInput as Partial<LayoutIntentRevision>;
  const placeholders = Array.isArray(raw?.placeholders) ? raw.placeholders : [];

  if (!parsedRevision.success) {
    issues.push(issue("LAYOUT_INTENT_SCHEMA_INVALID", "Layout intent data is outside the supported shape.", "error"));
  }

  for (const rawPlaceholder of placeholders) {
    const placeholder = FurniturePlaceholderSchema.safeParse(rawPlaceholder);
    if (!placeholder.success) {
      const candidate = rawPlaceholder as Partial<FurniturePlaceholder>;
      issues.push(issue(
        "PLACEHOLDER_INVALID",
        "The furniture placeholder data is outside the supported shape.",
        "error",
        candidate.placeholderId,
        candidate.roomId
      ));
      continue;
    }
    issues.push(...validatePlaceholder(placeholder.data, sceneContract, options.affordanceGraph));
  }

  const countsByRoom = new Map<string, number>();
  for (const rawPlaceholder of placeholders) {
    const placeholder = FurniturePlaceholderSchema.safeParse(rawPlaceholder);
    if (!placeholder.success) {
      continue;
    }
    countsByRoom.set(placeholder.data.roomId, (countsByRoom.get(placeholder.data.roomId) ?? 0) + 1);
  }
  for (const [roomId, count] of countsByRoom.entries()) {
    if (count > 20) {
      issues.push(issue(
        "ROOM_PLACEHOLDER_LIMIT_EXCEEDED",
        "The room has more placeholders than this stage can process.",
        "error",
        undefined,
        roomId
      ));
    }
  }

  const hasErrors = issues.some((item) => item.severity === "error");
  return LayoutIntentValidationStateSchema.parse({
    status: hasErrors ? "invalid" : issues.length > 0 ? "warning" : "valid",
    canConfirm: !hasErrors,
    issues,
    validatedAt: options.validatedAt
  });
}

export function confirmLayoutIntentRevision(
  layoutIntent: LayoutIntentRevision,
  sceneContract: P1SceneContractV02,
  options: { layoutIntentContractId: string; confirmedAt: string; store?: LayoutIntentRepository }
): ConfirmLayoutIntentResult {
  const validation = validateLayoutIntent(layoutIntent, sceneContract, { validatedAt: options.confirmedAt });
  if (!validation.canConfirm) {
    return { ok: false, validation };
  }
  const validatedRevision = deepFreeze(LayoutIntentRevisionSchema.parse({
    ...layoutIntent,
    validation,
    updatedAt: options.confirmedAt
  }));
  options.store?.updateLayoutIntentRevision(validatedRevision);
  const contract = buildLayoutIntentContract(validatedRevision, sceneContract, {
    layoutIntentContractId: options.layoutIntentContractId,
    createdAt: options.confirmedAt
  });
  const persistedContract = options.store?.createLayoutIntentContract(contract) ?? contract;
  return {
    ok: true,
    layoutIntentRevision: validatedRevision,
    layoutIntentContract: persistedContract
  };
}

export function buildLayoutIntentContract(
  layoutIntent: LayoutIntentRevision,
  sceneContract: P1SceneContractV02,
  options: { layoutIntentContractId: string; createdAt: string }
): LayoutIntentContract {
  if (layoutIntent.sceneContractId !== sceneContract.sceneContractId || layoutIntent.geometryHash !== sceneContract.geometryHash) {
    throw new Error("LayoutIntentContract requires matching SceneContract geometry trace.");
  }
  return deepFreeze(LayoutIntentContractSchema.parse({
    layoutIntentContractId: options.layoutIntentContractId,
    homeId: layoutIntent.homeId,
    canonicalRevisionId: layoutIntent.canonicalRevisionId,
    sceneContractId: layoutIntent.sceneContractId,
    geometryHash: layoutIntent.geometryHash,
    layoutIntentRevisionId: layoutIntent.layoutIntentRevisionId,
    layoutIntentHash: layoutIntent.layoutIntentHash,
    aiAutofillEnabled: layoutIntent.aiAutofillEnabled,
    readonly: true,
    placeholders: layoutIntent.placeholders.map(clonePlaceholder),
    constraints: {
      mayMutateGeometry: false,
      mayMutateSceneContract: false,
      placeholderCoordinatesAreFinalFurnitureCoordinates: false,
      placeholderSizesAreSkuSizes: false
    },
    createdAt: options.createdAt
  }));
}

export function buildAnchorPlannerInputContract(
  layoutIntentContract: LayoutIntentContract,
  roomAffordanceGraphs: readonly P1RoomAffordanceGraph[]
): AnchorPlannerInputContract {
  return AnchorPlannerInputContractSchema.parse({
    homeId: layoutIntentContract.homeId,
    canonicalRevisionId: layoutIntentContract.canonicalRevisionId,
    sceneContractId: layoutIntentContract.sceneContractId,
    geometryHash: layoutIntentContract.geometryHash,
    layoutIntentRevisionId: layoutIntentContract.layoutIntentRevisionId,
    layoutIntentHash: layoutIntentContract.layoutIntentHash,
    aiAutofillEnabled: layoutIntentContract.aiAutofillEnabled,
    roomAffordanceGraphs: roomAffordanceGraphs.map((graph) => clone(graph)),
    userPlaceholders: layoutIntentContract.placeholders.map(clonePlaceholder),
    rules: {
      respectUserPlaceholders: true,
      verifyUserPlaceholders: true,
      mayAutofillMissingAnchors: layoutIntentContract.aiAutofillEnabled,
      mayMoveUserPlaceholders: false,
      mayMutateGeometry: false
    }
  });
}

export function emitLayoutIntentEvent(
  repository: LayoutIntentEventRepository,
  input: LayoutIntentActor & {
    eventId: string;
    eventType: LayoutIntentEventType;
    homeId: string;
    canonicalRevisionId: string;
    sceneContractId: string;
    geometryHash: GeometryHash;
    layoutIntentRevisionId: string;
    layoutIntentHash?: LayoutIntentHash;
    placeholderId?: string;
    timestamp: string;
  }
): LayoutIntentEvent {
  return repository.appendLayoutIntentEvent(LayoutIntentEventSchema.parse({
    eventId: input.eventId,
    eventType: input.eventType,
    homeId: input.homeId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.anonymousSessionId === undefined ? {} : { anonymousSessionId: input.anonymousSessionId }),
    canonicalRevisionId: input.canonicalRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    layoutIntentRevisionId: input.layoutIntentRevisionId,
    ...(input.layoutIntentHash === undefined ? {} : { layoutIntentHash: input.layoutIntentHash }),
    ...(input.placeholderId === undefined ? {} : { placeholderId: input.placeholderId }),
    timestamp: input.timestamp,
    source: "layout_intent"
  }));
}

export function layoutEventTypeForOperation(operationType: LayoutIntentOperation["operationType"]): LayoutIntentEventType {
  switch (operationType) {
    case "layout.placeholder.add":
      return "layout_placeholder_added";
    case "layout.placeholder.delete":
      return "layout_placeholder_deleted";
    case "layout.placeholder.move":
      return "layout_placeholder_moved";
    case "layout.placeholder.rotate":
      return "layout_placeholder_rotated";
    case "layout.placeholder.category.change":
      return "layout_placeholder_category_changed";
    case "layout.placeholder.displaySize.change":
      return "layout_placeholder_display_size_changed";
    case "layout.aiAutofill.toggle":
      return "layout_ai_autofill_toggled";
  }
}

export function compareLayoutIntentHash(
  previousLayoutIntentHash: LayoutIntentHash | undefined,
  newLayoutIntentHash: LayoutIntentHash | undefined
): LayoutIntentHashComparison {
  return LayoutIntentHashComparisonSchema.parse({
    changed:
      previousLayoutIntentHash !== undefined &&
      newLayoutIntentHash !== undefined &&
      previousLayoutIntentHash !== newLayoutIntentHash,
    ...(previousLayoutIntentHash === undefined ? {} : { previousLayoutIntentHash }),
    ...(newLayoutIntentHash === undefined ? {} : { newLayoutIntentHash })
  });
}

export function preserveGeometryArtifactsForLayoutOnlyChange() {
  return {
    canonicalFloorplan: true as const,
    sceneContract: true as const,
    whiteModel: true as const,
    cameraPlan: true as const,
    baseAffordanceGraph: true as const
  };
}

export function invalidateForLayoutIntentChange(
  dependencies: readonly LayoutIntentArtifactDependency[],
  input: {
    previousLayoutIntentHash?: LayoutIntentHash;
    newLayoutIntentHash?: LayoutIntentHash;
    invalidatedAt: string;
  }
): {
  summary: LayoutIntentInvalidationSummary;
  dependencies: LayoutIntentArtifactDependency[];
} {
  const comparison = compareLayoutIntentHash(input.previousLayoutIntentHash, input.newLayoutIntentHash);
  const updated = dependencies.map((dependency) => {
    const parsed = LayoutIntentArtifactDependencySchema.parse(dependency);
    if (!comparison.changed || !parsed.active || !LAYOUT_DEPENDENT_ARTIFACT_TYPES.includes(parsed.artifactType)) {
      return parsed;
    }
    return LayoutIntentArtifactDependencySchema.parse({
      ...parsed,
      status: "invalidated",
      active: false,
      invalidatedAt: input.invalidatedAt
    });
  });
  const invalidatedDependencyIds = updated
    .filter((dependency, index) => dependency.status === "invalidated" && dependencies[index]?.status === "active")
    .map((dependency) => dependency.dependencyId)
    .sort();
  return {
    summary: LayoutIntentInvalidationSummarySchema.parse({
      changed: comparison.changed,
      ...(comparison.previousLayoutIntentHash === undefined ? {} : { previousLayoutIntentHash: comparison.previousLayoutIntentHash }),
      ...(comparison.newLayoutIntentHash === undefined ? {} : { newLayoutIntentHash: comparison.newLayoutIntentHash }),
      invalidatedDependencyIds,
      archivedLayoutIntentRevisionIds: [],
      preservedGeometryArtifacts: preserveGeometryArtifactsForLayoutOnlyChange()
    }),
    dependencies: updated
  };
}

export function invalidateLayoutIntentIfGeometryChanged(
  layoutIntent: LayoutIntentRevision,
  sceneContract: P1SceneContractV02
): LayoutIntentInvalidationSummary {
  const missingRoom = layoutIntent.placeholders.some(
    (placeholder) => !sceneContract.rooms.some((room) => room.roomId === placeholder.roomId)
  );
  const invalid = layoutIntent.geometryHash !== sceneContract.geometryHash || missingRoom;
  return LayoutIntentInvalidationSummarySchema.parse({
    changed: invalid,
    previousLayoutIntentHash: layoutIntent.layoutIntentHash,
    newLayoutIntentHash: layoutIntent.layoutIntentHash,
    invalidatedDependencyIds: [],
    archivedLayoutIntentRevisionIds: invalid ? [layoutIntent.layoutIntentRevisionId] : [],
    preservedGeometryArtifacts: preserveGeometryArtifactsForLayoutOnlyChange()
  });
}

function applyLayoutIntentOperation(
  layoutIntent: LayoutIntentRevision,
  operation: LayoutIntentOperation,
  updatedAt: string
): LayoutIntentRevision {
  let updated: LayoutIntentRevision;
  switch (operation.operationType) {
    case "layout.placeholder.add": {
      const placeholder = FurniturePlaceholderSchema.parse(requirePayload(operation.payload?.placeholder, "placeholder"));
      updated = {
        ...layoutIntent,
        placeholders: [...layoutIntent.placeholders, placeholder]
      };
      break;
    }
    case "layout.placeholder.delete": {
      const placeholderId = requirePlaceholderId(operation);
      updated = {
        ...layoutIntent,
        placeholders: layoutIntent.placeholders.filter((placeholder) => placeholder.placeholderId !== placeholderId)
      };
      break;
    }
    case "layout.placeholder.move": {
      updated = replacePlaceholder(layoutIntent, requirePlaceholderId(operation), (placeholder) => ({
        ...placeholder,
        center: requirePoint(operation.payload?.center, "center"),
        updatedAt
      }));
      break;
    }
    case "layout.placeholder.rotate": {
      updated = replacePlaceholder(layoutIntent, requirePlaceholderId(operation), (placeholder) => ({
        ...placeholder,
        rotationDeg: requireNumber(operation.payload?.rotationDeg, "rotationDeg"),
        updatedAt
      }));
      break;
    }
    case "layout.placeholder.category.change": {
      updated = replacePlaceholder(layoutIntent, requirePlaceholderId(operation), (placeholder) => ({
        ...placeholder,
        category: requireCategory(operation.payload?.category),
        updatedAt
      }));
      break;
    }
    case "layout.placeholder.displaySize.change": {
      updated = replacePlaceholder(layoutIntent, requirePlaceholderId(operation), (placeholder) => ({
        ...placeholder,
        displaySizeMm: {
          width: requireNumber(operation.payload?.width, "width"),
          depth: requireNumber(operation.payload?.depth, "depth")
        },
        sizeSource: "user_adjusted_display_only" as const,
        updatedAt
      }));
      break;
    }
    case "layout.aiAutofill.toggle": {
      updated = {
        ...layoutIntent,
        aiAutofillEnabled: requireBoolean(operation.payload?.aiAutofillEnabled, "aiAutofillEnabled")
      };
      break;
    }
  }

  const layoutIntentHash = computeLayoutIntentHash({
    aiAutofillEnabled: updated.aiAutofillEnabled,
    placeholders: updated.placeholders
  });
  return LayoutIntentRevisionSchema.parse({
    ...updated,
    layoutIntentHash,
    updatedAt
  });
}

function validatePlaceholder(
  placeholder: FurniturePlaceholder,
  sceneContract: P1SceneContractV02,
  affordanceGraph?: P1RoomAffordanceGraph
): LayoutIntentValidationIssue[] {
  const issues: LayoutIntentValidationIssue[] = [];
  const room = sceneContract.rooms.find((candidate) => candidate.roomId === placeholder.roomId);
  if (room === undefined) {
    issues.push(issue("PLACEHOLDER_ROOM_MISSING", "The furniture placeholder is not assigned to a valid room.", "error", placeholder.placeholderId, placeholder.roomId));
    return issues;
  }
  if (!pointInPolygon(placeholder.center, room.polygon)) {
    issues.push(issue("PLACEHOLDER_OUTSIDE_ROOM", "The furniture placeholder is not inside the referenced room.", "error", placeholder.placeholderId, placeholder.roomId));
  }
  if (!Number.isFinite(placeholder.rotationDeg)) {
    issues.push(issue("PLACEHOLDER_ROTATION_INVALID", "The furniture placeholder rotation is outside the supported range.", "error", placeholder.placeholderId, placeholder.roomId));
  }
  if (
    placeholder.displaySizeMm.width < 100 ||
    placeholder.displaySizeMm.depth < 100 ||
    placeholder.displaySizeMm.width > 6000 ||
    placeholder.displaySizeMm.depth > 6000
  ) {
    issues.push(issue("PLACEHOLDER_SIZE_OUT_OF_RANGE", "The furniture placeholder size is outside the supported range.", "error", placeholder.placeholderId, placeholder.roomId));
  }
  const openingConflict = sceneContract.openings.some((opening) => {
    const wall = sceneContract.walls.find((candidate) => candidate.wallId === opening.wallId);
    if (wall === undefined) {
      return false;
    }
    const point = pointOnSegment(wall.start, wall.end, opening.positionOnWall);
    return distance(point, placeholder.center) < Math.max(placeholder.displaySizeMm.width, placeholder.displaySizeMm.depth) / 2 + 600;
  });
  if (openingConflict) {
    issues.push(issue("PLACEHOLDER_DOOR_CLEARANCE_CONFLICT", "The furniture placeholder may affect door or window clearance.", "warning", placeholder.placeholderId, placeholder.roomId));
  }
  const affordanceRoom = affordanceGraph?.rooms.find((candidate) => candidate.roomId === placeholder.roomId);
  if (affordanceRoom !== undefined && affordanceRoom.blockedOpeningIds.length > 0 && openingConflict) {
    issues.push(issue("PLACEHOLDER_AFFORDANCE_CLEARANCE_CONFLICT", "The furniture placeholder overlaps a reserved circulation area.", "warning", placeholder.placeholderId, placeholder.roomId));
  }
  return issues;
}

function issue(
  code: string,
  message: string,
  severity: "info" | "warning" | "error",
  placeholderId?: string,
  roomId?: string
): LayoutIntentValidationIssue {
  return {
    issueId: `issue-${code.toLowerCase()}${placeholderId === undefined ? "" : `-${placeholderId}`}`,
    severity,
    code,
    message,
    ...(placeholderId === undefined ? {} : { placeholderId }),
    ...(roomId === undefined ? {} : { roomId }),
    blocksConfirmation: severity === "error"
  };
}

function replacePlaceholder(
  layoutIntent: LayoutIntentRevision,
  placeholderId: string,
  update: (placeholder: FurniturePlaceholder) => FurniturePlaceholder
): LayoutIntentRevision {
  let found = false;
  const placeholders = layoutIntent.placeholders.map((placeholder) => {
    if (placeholder.placeholderId !== placeholderId) {
      return placeholder;
    }
    found = true;
    return FurniturePlaceholderSchema.parse(update(placeholder));
  });
  if (!found) {
    throw new Error(`Layout placeholder not found: ${placeholderId}`);
  }
  return {
    ...layoutIntent,
    placeholders
  };
}

function clonePlaceholder(placeholder: FurniturePlaceholder): FurniturePlaceholder {
  return FurniturePlaceholderSchema.parse(clone(placeholder));
}

function requirePayload(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Layout operation payload requires ${key}.`);
  }
  return value;
}

function requirePlaceholderId(operation: LayoutIntentOperation): string {
  const placeholderId = operation.placeholderId ?? operation.payload?.placeholderId;
  if (typeof placeholderId !== "string" || placeholderId.length === 0) {
    throw new Error(`${operation.operationType} requires placeholderId.`);
  }
  return placeholderId;
}

function requirePoint(value: unknown, key: string): Point2D {
  if (typeof value !== "object" || value === null || !("x" in value) || !("y" in value)) {
    throw new Error(`Layout operation payload requires point ${key}.`);
  }
  const point = value as Record<string, unknown>;
  return {
    x: requireNumber(point.x, `${key}.x`),
    y: requireNumber(point.y, `${key}.y`)
  };
}

function requireNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Layout operation payload requires numeric ${key}.`);
  }
  return value;
}

function requireBoolean(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Layout operation payload requires boolean ${key}.`);
  }
  return value;
}

function requireCategory(value: unknown): FurnitureCategory {
  const parsed = FurniturePlaceholderSchema.shape.category.safeParse(value);
  if (!parsed.success) {
    throw new Error("Unsupported furniture category.");
  }
  return parsed.data;
}

function normalizePoint(point: Point2D): Point2D {
  return {
    x: normalizeNumber(point.x),
    y: normalizeNumber(point.y)
  };
}

function normalizeNumber(value: number): number {
  return Number(value.toFixed(3));
}

function pointOnSegment(start: Point2D, end: Point2D, t: number): Point2D {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInPolygon(point: Point2D, polygon: readonly Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (pi === undefined || pj === undefined) {
      continue;
    }
    const intersects =
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }

  return Object.freeze(value);
}
