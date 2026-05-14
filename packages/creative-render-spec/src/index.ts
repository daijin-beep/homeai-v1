import {
  CreativeRenderSpecBatchSchema,
  CreativeRenderSpecDebugPayloadSchema,
  CreativeRenderSpecInputSchema,
  CreativeRenderSpecPreviewRequestSchema,
  CreativeRenderSpecSchema,
  CreativeRenderSpecVerificationSchema,
  SchemeLiteContractSchema,
  type CreativeRenderAssetKind,
  type CreativeRenderAssetRef,
  type CreativeRenderCameraRef,
  type CreativeRenderSpec,
  type CreativeRenderSpecBatch,
  type CreativeRenderSpecDebugPayload,
  type CreativeRenderSpecInput,
  type CreativeRenderSpecInputs,
  type CreativeRenderSpecPreviewRequest,
  type CreativeRenderSpecVerification,
  type CreativeRenderSpecVerificationCheck,
  type RoomSchemeLite,
  type SchemeLiteContract
} from "@homeai/contracts";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";

export type CreativeRenderSpecInputBuildOptions = {
  inputId?: string;
  source?: CreativeRenderSpecInput["source"];
  createdAt?: string;
  cameraRefs?: CreativeRenderCameraRef[];
  controlAssets?: CreativeRenderAssetRef[];
};

export type CreativeRenderSpecCompileOptions = {
  createdAt?: string;
  compilerVersion?: string;
};

export type AdsCreativeRenderSpecFreezeContext = {
  homeId?: string;
  floorplanRevisionId?: string;
  sceneContractId?: string;
  geometryHash?: string;
};

const DEFAULT_CREATED_AT = "2026-05-14T00:00:00.000Z";
const DEFAULT_COMPILER_VERSION = "0.1.0";
export const creativeRenderSpecFixtureTimestamp = DEFAULT_CREATED_AT;
const REQUIRED_ASSET_KINDS: CreativeRenderAssetKind[] = [
  "control_render",
  "depth_map",
  "semantic_mask",
  "line_map",
  "locked_geometry_mask",
  "anchor_layout_mask"
];
const REQUIRED_FORBIDDEN_CHANGES = [
  "no wall changes",
  "no door changes",
  "no window changes",
  "no room proportion changes",
  "no structural changes",
  "no floorplan changes",
  "no anchor zone movement"
];
export const ADS_FREEZE_REQUIRED_INPUT_FIELDS = [
  "inputs.controlRender.uri",
  "inputs.depthMap.uri",
  "inputs.semanticMask.uri",
  "inputs.lineMap.uri",
  "inputs.lockedGeometryMask.uri",
  "inputs.anchorLayoutMask.uri"
] as const;
export const ADS_FREEZE_REQUIRED_FORBIDDEN_CHANGES = REQUIRED_FORBIDDEN_CHANGES;

export function buildCreativeRenderSpecInputFromSchemeLite(
  rawScheme: SchemeLiteContract,
  options: CreativeRenderSpecInputBuildOptions = {}
): CreativeRenderSpecInput {
  const scheme = SchemeLiteContractSchema.parse(clone(rawScheme));
  const cameraRefs = options.cameraRefs === undefined
    ? buildFixtureCameraRefs(scheme)
    : clone(options.cameraRefs);
  const controlAssets = options.controlAssets === undefined
    ? buildFixtureAssetRefs(scheme)
    : clone(options.controlAssets);

  return deepFreeze(CreativeRenderSpecInputSchema.parse({
    inputId: options.inputId ?? `creative-render-spec-input-${scheme.schemeId}`,
    scheme,
    cameraRefs,
    controlAssets,
    source: options.source ?? "scheme_lite_contract",
    createdAt: options.createdAt ?? DEFAULT_CREATED_AT
  }));
}

export function compileCreativeRenderSpecBatch(
  rawInput: CreativeRenderSpecInput,
  options: CreativeRenderSpecCompileOptions = {}
): CreativeRenderSpecBatch {
  const input = CreativeRenderSpecInputSchema.parse(clone(rawInput));
  const scheme = input.scheme;
  const createdAt = options.createdAt ?? DEFAULT_CREATED_AT;
  const compilerVersion = options.compilerVersion ?? DEFAULT_COMPILER_VERSION;
  const specs = [...scheme.rooms]
    .sort((a, b) => a.roomId.localeCompare(b.roomId))
    .map((room) => compileRoomSpec(input, room, compilerVersion));
  const preliminaryBatch = CreativeRenderSpecBatchSchema.parse({
    batchId: `crs-batch-${scheme.schemeId}`,
    schemeId: scheme.schemeId,
    homeId: scheme.homeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scheme.sceneContractId,
    geometryHash: scheme.geometryHash,
    ...(scheme.layoutIntentHash === undefined ? {} : { layoutIntentHash: scheme.layoutIntentHash }),
    specs,
    verification: { status: "pass", checks: [] },
    trace: {
      traceId: `crs-trace-${scheme.schemeId}`,
      compilerName: "deterministic_creative_render_spec_compiler",
      compilerVersion,
      mode: "contract_only",
      status: "pass",
      networkCalls: false,
      warnings: [],
      startedAt: createdAt,
      completedAt: createdAt
    },
    createdAt
  });
  const verification = verifyCreativeRenderSpecBatch(preliminaryBatch, input);
  if (verification.status === "fail") {
    throw new Error(verification.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "));
  }

  return deepFreeze(CreativeRenderSpecBatchSchema.parse({
    ...preliminaryBatch,
    verification,
    trace: {
      ...preliminaryBatch.trace,
      status: verification.status,
      warnings: verification.checks
        .filter((check) => check.status === "warning")
        .map((check) => check.message)
    }
  }));
}

export function verifyCreativeRenderSpecBatch(
  rawBatch: CreativeRenderSpecBatch,
  rawInput: CreativeRenderSpecInput
): CreativeRenderSpecVerification {
  const input = CreativeRenderSpecInputSchema.parse(clone(rawInput));
  const batch = CreativeRenderSpecBatchSchema.parse(clone(rawBatch));
  const checks: CreativeRenderSpecVerificationCheck[] = [];

  addBatchTraceChecks(checks, batch, input.scheme);
  addCoverageChecks(checks, batch, input.scheme);
  addSpecInputChecks(checks, batch);
  addConstraintChecks(checks, batch);
  addDirectiveChecks(checks, batch);
  addUnsupportedClaimChecks(checks, batch);
  addSourceWarnings(checks, input);

  return CreativeRenderSpecVerificationSchema.parse({
    status: aggregateStatus(checks),
    checks
  });
}

export function assertCreativeRenderSpecFullRoomCoverage(
  batch: CreativeRenderSpecBatch,
  input: CreativeRenderSpecInput
): void {
  const verification = verifyCreativeRenderSpecBatch(batch, input);
  const failures = verification.checks.filter((check) =>
    check.status === "fail" && check.checkId.startsWith("coverage-")
  );
  if (failures.length > 0) {
    throw new Error(failures.map((check) => check.message).join(" "));
  }
}

export function validateCreativeRenderSpecForADS(
  rawSpec: unknown,
  context: AdsCreativeRenderSpecFreezeContext = {}
): CreativeRenderSpecVerification {
  const checks: CreativeRenderSpecVerificationCheck[] = [];
  const parsed = CreativeRenderSpecSchema.safeParse(clone(rawSpec));
  if (!parsed.success) {
    return CreativeRenderSpecVerificationSchema.parse({
      status: "fail",
      checks: parsed.error.issues.map((issue, index) => ({
        checkId: `ads-freeze-schema-${index}`,
        status: "fail",
        message: `CreativeRenderSpec schema validation failed at ${issue.path.join(".") || "root"}: ${issue.message}`
      }))
    });
  }

  const spec = parsed.data;
  addCheck(checks, "ads-freeze-render-spec-id", spec.renderSpecId.length > 0, "renderSpecId is present.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-room-id", spec.roomId.length > 0, "roomId is present.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-camera-id", spec.cameraId.length > 0, "cameraId is present.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-geometry-hash", spec.geometryHash.length > 0, "geometryHash is present.", spec.roomId, spec.renderSpecId);
  addSpecContextChecks(checks, spec, context);
  addSpecTraceChecks(checks, spec);
  addSingleSpecInputChecks(checks, spec);
  addSingleSpecConstraintChecks(checks, spec);
  addSingleSpecDirectiveChecks(checks, spec);

  return CreativeRenderSpecVerificationSchema.parse({
    status: aggregateStatus(checks),
    checks
  });
}

export function assertCreativeRenderSpecForADS(
  rawSpec: unknown,
  context: AdsCreativeRenderSpecFreezeContext = {}
): CreativeRenderSpec {
  const verification = validateCreativeRenderSpecForADS(rawSpec, context);
  if (verification.status === "fail") {
    throw new Error(verification.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "));
  }
  return CreativeRenderSpecSchema.parse(clone(rawSpec));
}

export function buildCreativeRenderSpecDebugPayload(
  rawRequest: CreativeRenderSpecPreviewRequest
): CreativeRenderSpecDebugPayload {
  const request = CreativeRenderSpecPreviewRequestSchema.parse(clone(rawRequest));
  const batch = compileCreativeRenderSpecBatch(request.input);
  const renderSpecVerification = verifyCreativeRenderSpecBatch(batch, request.input);
  if (renderSpecVerification.status === "fail") {
    throw new Error(renderSpecVerification.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "));
  }

  return deepFreeze(CreativeRenderSpecDebugPayloadSchema.parse({
    input: request.input,
    batch,
    schemeVerification: request.input.scheme.verification,
    renderSpecVerification,
    trace: batch.trace,
    coverage: {
      schemeRoomCount: request.input.scheme.rooms.length,
      renderSpecCount: batch.specs.length,
      roomsWithSpecs: new Set(batch.specs.map((spec) => spec.roomId)).size,
      hasLayoutIntent: request.input.scheme.layoutIntentHash !== undefined
    }
  }));
}

export function createCreativeRenderSpecFixtureInput(
  options: { withLayoutIntent?: boolean; withWarnings?: boolean } = {}
): CreativeRenderSpecInput {
  const scheme = createSchemePageFixtureContract({
    withLayoutIntent: options.withLayoutIntent ?? true,
    withWarnings: options.withWarnings ?? true
  });
  return buildCreativeRenderSpecInputFromSchemeLite(scheme, {
    inputId: "creative-render-spec-fixture-input",
    source: "fixture",
    createdAt: creativeRenderSpecFixtureTimestamp
  });
}

function compileRoomSpec(
  input: CreativeRenderSpecInput,
  room: RoomSchemeLite,
  compilerVersion: string
): CreativeRenderSpec {
  const scheme = input.scheme;
  const camera = firstCameraForRoom(input, room.roomId);
  const inputs = assetsForRoom(input, room.roomId);
  const renderSpecId = `crs-${sanitizeId(scheme.schemeId)}-${sanitizeId(room.roomId)}-${sanitizeId(camera.cameraId)}`;

  return {
    renderSpecId,
    schemeId: scheme.schemeId,
    homeId: scheme.homeId,
    floorplanRevisionId: scheme.floorplanRevisionId,
    sceneContractId: scheme.sceneContractId,
    roomId: room.roomId,
    roomType: room.roomType,
    cameraId: camera.cameraId,
    geometryHash: scheme.geometryHash,
    ...(scheme.layoutIntentHash === undefined ? {} : { layoutIntentHash: scheme.layoutIntentHash }),
    sourceRoomSchemeId: room.roomSchemeId,
    inputs,
    hardConstraints: {
      preserveWalls: true,
      preserveDoors: true,
      preserveWindows: true,
      preserveRoomProportion: true,
      preserveAnchorZones: true
    },
    style: {
      displayName: scheme.style.displayName,
      tags: scheme.style.tags,
      palette: scheme.style.palette,
      materialTags: scheme.style.materialTags,
      avoidTokens: scheme.style.avoidTokens
    },
    budget: {
      band: scheme.budget.band,
      currency: scheme.budget.currency,
      ...(scheme.budget.minCny === undefined ? {} : { minCny: scheme.budget.minCny }),
      ...(scheme.budget.maxCny === undefined ? {} : { maxCny: scheme.budget.maxCny })
    },
    anchorRefs: room.anchorRefs.map((ref) => ref.anchorId).sort(),
    ...(room.layoutIntentRefs.length === 0 ? {} : { layoutIntentRefs: room.layoutIntentRefs.map((ref) => ref.placeholderId).sort() }),
    promptDirectives: {
      positive: [
        scheme.brief.summary,
        room.designIntent,
        ...room.keyMoves,
        room.storageStrategy,
        ...room.circulationNotes,
        ...room.lightingNotes
      ],
      negative: uniqueSorted([...scheme.brief.avoid, ...scheme.style.avoidTokens]),
      forbiddenChanges: REQUIRED_FORBIDDEN_CHANGES
    },
    trace: {
      renderSpecId,
      schemeId: scheme.schemeId,
      homeId: scheme.homeId,
      floorplanRevisionId: scheme.floorplanRevisionId,
      sceneContractId: scheme.sceneContractId,
      roomId: room.roomId,
      cameraId: camera.cameraId,
      geometryHash: scheme.geometryHash,
      ...(scheme.layoutIntentHash === undefined ? {} : { layoutIntentHash: scheme.layoutIntentHash }),
      source: input.source === "debug" ? "debug" : input.source === "fixture" ? "fixture" : "contract_compiler",
      compilerVersion
    }
  };
}

function buildFixtureCameraRefs(scheme: SchemeLiteContract): CreativeRenderCameraRef[] {
  return scheme.rooms.map((room) => ({
    cameraId: `camera-${room.roomId}-primary`,
    roomId: room.roomId,
    label: `${room.roomType} primary camera`,
    source: "fixture",
    geometryHash: scheme.geometryHash
  }));
}

function buildFixtureAssetRefs(scheme: SchemeLiteContract): CreativeRenderAssetRef[] {
  return scheme.rooms.flatMap((room) =>
    REQUIRED_ASSET_KINDS.map((kind) => ({
      assetId: `asset-${kind}-${room.roomId}`,
      kind,
      roomId: room.roomId,
      geometryHash: scheme.geometryHash,
      uri: `fixture://creative-render-spec/${scheme.schemeId}/${room.roomId}/${kind}`
    }))
  );
}

function firstCameraForRoom(input: CreativeRenderSpecInput, roomId: string): CreativeRenderCameraRef {
  const camera = input.cameraRefs
    .filter((candidate) => candidate.roomId === roomId)
    .sort((a, b) => a.cameraId.localeCompare(b.cameraId))[0];
  if (camera === undefined) {
    throw new Error(`Missing camera ref for room ${roomId}.`);
  }
  return camera;
}

function assetsForRoom(input: CreativeRenderSpecInput, roomId: string): CreativeRenderSpecInputs {
  const assets = input.controlAssets.filter((asset) => asset.roomId === roomId);
  const byKind = new Map(assets.map((asset) => [asset.kind, asset]));
  const missingKinds = REQUIRED_ASSET_KINDS.filter((kind) => !byKind.has(kind));
  if (missingKinds.length > 0) {
    throw new Error(`Missing asset refs for room ${roomId}: ${missingKinds.join(", ")}`);
  }

  return {
    controlRender: assetByKind(byKind, "control_render"),
    depthMap: assetByKind(byKind, "depth_map"),
    semanticMask: assetByKind(byKind, "semantic_mask"),
    lineMap: assetByKind(byKind, "line_map"),
    lockedGeometryMask: assetByKind(byKind, "locked_geometry_mask"),
    anchorLayoutMask: assetByKind(byKind, "anchor_layout_mask")
  };
}

function assetByKind<K extends CreativeRenderAssetKind>(
  byKind: ReadonlyMap<CreativeRenderAssetKind, CreativeRenderAssetRef>,
  kind: K
): CreativeRenderAssetRef & { kind: K } {
  const asset = byKind.get(kind);
  if (asset === undefined) {
    throw new Error(`Missing ${kind} asset.`);
  }
  if (asset.kind !== kind) {
    throw new Error(`Mismatched ${kind} asset.`);
  }
  return asset as CreativeRenderAssetRef & { kind: K };
}

function addBatchTraceChecks(
  checks: CreativeRenderSpecVerificationCheck[],
  batch: CreativeRenderSpecBatch,
  scheme: SchemeLiteContract
): void {
  addCheck(checks, "trace-home", batch.homeId === scheme.homeId, "Batch homeId matches scheme.");
  addCheck(checks, "trace-floorplan", batch.floorplanRevisionId === scheme.floorplanRevisionId, "Batch floorplanRevisionId matches scheme.");
  addCheck(checks, "trace-scene", batch.sceneContractId === scheme.sceneContractId, "Batch sceneContractId matches scheme.");
  addCheck(checks, "trace-geometry", batch.geometryHash === scheme.geometryHash, "Batch geometryHash matches scheme.");
  addCheck(checks, "trace-layout", batch.layoutIntentHash === scheme.layoutIntentHash, "Batch layoutIntentHash matches scheme state.");
  addCheck(checks, "trace-scheme", batch.schemeId === scheme.schemeId, "Batch schemeId matches scheme.");
}

function addCoverageChecks(
  checks: CreativeRenderSpecVerificationCheck[],
  batch: CreativeRenderSpecBatch,
  scheme: SchemeLiteContract
): void {
  const schemeRoomIds = scheme.rooms.map((room) => room.roomId).sort();
  const specRoomIds = batch.specs.map((spec) => spec.roomId).sort();
  for (const roomId of schemeRoomIds) {
    const count = specRoomIds.filter((candidate) => candidate === roomId).length;
    addCheck(checks, `coverage-room-${roomId}`, count >= 1, `Room ${roomId} has at least one render spec.`, roomId);
  }
  const extraRoomIds = specRoomIds.filter((roomId) => !schemeRoomIds.includes(roomId));
  addCheck(checks, "coverage-no-extra-rooms", extraRoomIds.length === 0, "Batch has no specs for unknown rooms.");
  addCheck(checks, "coverage-room-count", batch.specs.length >= scheme.rooms.length, "Batch has one or more specs per scheme room.");
}

function addSpecInputChecks(checks: CreativeRenderSpecVerificationCheck[], batch: CreativeRenderSpecBatch): void {
  for (const spec of batch.specs) {
    for (const [inputKey, asset] of Object.entries(spec.inputs)) {
      addCheck(
        checks,
        `asset-room-${spec.renderSpecId}-${inputKey}`,
        asset.roomId === spec.roomId,
        `Asset ${inputKey} roomId matches render spec.`,
        spec.roomId,
        spec.renderSpecId
      );
      addCheck(
        checks,
        `asset-hash-${spec.renderSpecId}-${inputKey}`,
        asset.geometryHash === spec.geometryHash,
        `Asset ${inputKey} geometryHash matches render spec.`,
        spec.roomId,
        spec.renderSpecId
      );
    }
  }
}

function addSingleSpecInputChecks(checks: CreativeRenderSpecVerificationCheck[], spec: CreativeRenderSpec): void {
  for (const inputKey of Object.keys(spec.inputs) as Array<keyof CreativeRenderSpecInputs>) {
    const asset = spec.inputs[inputKey];
    addCheck(
      checks,
      `ads-freeze-input-uri-${spec.renderSpecId}-${inputKey}`,
      asset.uri.length > 0,
      `Input asset ${String(inputKey)} uri is present.`,
      spec.roomId,
      spec.renderSpecId
    );
    addCheck(
      checks,
      `ads-freeze-input-room-${spec.renderSpecId}-${inputKey}`,
      asset.roomId === spec.roomId,
      `Input asset ${String(inputKey)} roomId matches render spec.`,
      spec.roomId,
      spec.renderSpecId
    );
    addCheck(
      checks,
      `ads-freeze-input-hash-${spec.renderSpecId}-${inputKey}`,
      asset.geometryHash === spec.geometryHash,
      `Input asset ${String(inputKey)} geometryHash matches render spec.`,
      spec.roomId,
      spec.renderSpecId
    );
  }
}

function addConstraintChecks(checks: CreativeRenderSpecVerificationCheck[], batch: CreativeRenderSpecBatch): void {
  for (const spec of batch.specs) {
    const constraints = Object.values(spec.hardConstraints);
    addCheck(
      checks,
      `constraints-${spec.renderSpecId}`,
      constraints.every((value) => value === true),
      "All hard constraints are locked true.",
      spec.roomId,
      spec.renderSpecId
    );
  }
}

function addSingleSpecConstraintChecks(checks: CreativeRenderSpecVerificationCheck[], spec: CreativeRenderSpec): void {
  for (const [key, value] of Object.entries(spec.hardConstraints)) {
    addCheck(
      checks,
      `ads-freeze-hard-constraint-${spec.renderSpecId}-${key}`,
      value === true,
      `Hard constraint ${key} is locked true.`,
      spec.roomId,
      spec.renderSpecId
    );
  }
}

function addDirectiveChecks(checks: CreativeRenderSpecVerificationCheck[], batch: CreativeRenderSpecBatch): void {
  for (const spec of batch.specs) {
    for (const directive of REQUIRED_FORBIDDEN_CHANGES) {
      addCheck(
        checks,
        `directive-${spec.renderSpecId}-${sanitizeId(directive)}`,
        spec.promptDirectives.forbiddenChanges.includes(directive),
        `Forbidden change directive is present: ${directive}.`,
        spec.roomId,
        spec.renderSpecId
      );
    }
  }
}

function addSingleSpecDirectiveChecks(checks: CreativeRenderSpecVerificationCheck[], spec: CreativeRenderSpec): void {
  for (const directive of REQUIRED_FORBIDDEN_CHANGES) {
    addCheck(
      checks,
      `ads-freeze-forbidden-change-${spec.renderSpecId}-${sanitizeId(directive)}`,
      spec.promptDirectives.forbiddenChanges.includes(directive),
      `Forbidden change directive is present: ${directive}.`,
      spec.roomId,
      spec.renderSpecId
    );
  }
}

function addSpecTraceChecks(checks: CreativeRenderSpecVerificationCheck[], spec: CreativeRenderSpec): void {
  addCheck(checks, "ads-freeze-trace-render-spec", spec.trace.renderSpecId === spec.renderSpecId, "Trace renderSpecId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-scheme", spec.trace.schemeId === spec.schemeId, "Trace schemeId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-home", spec.trace.homeId === spec.homeId, "Trace homeId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-floorplan", spec.trace.floorplanRevisionId === spec.floorplanRevisionId, "Trace floorplanRevisionId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-scene", spec.trace.sceneContractId === spec.sceneContractId, "Trace sceneContractId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-room", spec.trace.roomId === spec.roomId, "Trace roomId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-camera", spec.trace.cameraId === spec.cameraId, "Trace cameraId matches.", spec.roomId, spec.renderSpecId);
  addCheck(checks, "ads-freeze-trace-geometry", spec.trace.geometryHash === spec.geometryHash, "Trace geometryHash matches.", spec.roomId, spec.renderSpecId);
}

function addSpecContextChecks(
  checks: CreativeRenderSpecVerificationCheck[],
  spec: CreativeRenderSpec,
  context: AdsCreativeRenderSpecFreezeContext
): void {
  if (context.homeId !== undefined) {
    addCheck(checks, "ads-freeze-context-home", spec.homeId === context.homeId, "Spec homeId matches ADS freeze context.", spec.roomId, spec.renderSpecId);
  }
  if (context.floorplanRevisionId !== undefined) {
    addCheck(
      checks,
      "ads-freeze-context-floorplan",
      spec.floorplanRevisionId === context.floorplanRevisionId,
      "Spec floorplanRevisionId matches ADS freeze context.",
      spec.roomId,
      spec.renderSpecId
    );
  }
  if (context.sceneContractId !== undefined) {
    addCheck(checks, "ads-freeze-context-scene", spec.sceneContractId === context.sceneContractId, "Spec sceneContractId matches ADS freeze context.", spec.roomId, spec.renderSpecId);
  }
  if (context.geometryHash !== undefined) {
    addCheck(checks, "ads-freeze-context-geometry", spec.geometryHash === context.geometryHash, "Spec geometryHash matches ADS freeze context.", spec.roomId, spec.renderSpecId);
  }
}

function addUnsupportedClaimChecks(checks: CreativeRenderSpecVerificationCheck[], batch: CreativeRenderSpecBatch): void {
  const serialized = JSON.stringify(batch);
  const forbidden = [
    pattern(["s", "ku"]),
    pattern(["product", "Url"]),
    pattern(["check", "out"]),
    pattern(["pay", "ment"]),
    pattern(["p", "df"]),
    pattern(["d", "wg"]),
    pattern(["d", "xf"]),
    pattern(["final", "Furniture", "Coordinates"])
  ];
  addCheck(
    checks,
    "unsupported-claims-absent",
    !forbidden.some((candidate) => candidate.test(serialized)),
    "Batch avoids unsupported downstream claims."
  );
}

function addSourceWarnings(checks: CreativeRenderSpecVerificationCheck[], input: CreativeRenderSpecInput): void {
  if (input.cameraRefs.some((camera) => camera.source === "fixture")) {
    addWarning(checks, "warning-fixture-camera-refs", "Fixture camera refs are used.");
  }
  if (input.controlAssets.some((asset) => asset.uri.startsWith("fixture://"))) {
    addWarning(checks, "warning-fixture-control-assets", "Fixture control assets are used.");
  }
  if (input.scheme.rooms.some((room) => room.anchorRefs.length === 0)) {
    addWarning(checks, "warning-missing-anchor-refs", "One or more rooms have no anchor refs.");
  }
  if (input.scheme.layoutIntentHash === undefined) {
    addWarning(checks, "warning-layout-intent-absent", "Layout intent is absent.");
  }
}

function addCheck(
  checks: CreativeRenderSpecVerificationCheck[],
  checkId: string,
  passes: boolean,
  message: string,
  roomId?: string,
  renderSpecId?: string
): void {
  checks.push({
    checkId,
    status: passes ? "pass" : "fail",
    message,
    ...(roomId === undefined ? {} : { roomId }),
    ...(renderSpecId === undefined ? {} : { renderSpecId })
  });
}

function addWarning(checks: CreativeRenderSpecVerificationCheck[], checkId: string, message: string): void {
  checks.push({ checkId, status: "warning", message });
}

function aggregateStatus(checks: readonly CreativeRenderSpecVerificationCheck[]): CreativeRenderSpecVerification["status"] {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }
  return "pass";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function pattern(parts: string[]): RegExp {
  return new RegExp(parts.join(""), "i");
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
