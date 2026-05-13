"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent } from "react";
import type {
  DraftDoorOpening,
  DraftOpening,
  DraftRoom,
  DraftValidationIssue,
  DraftValidationState,
  DraftWallSegment,
  DraftWindowOpening,
  FloorplanDraftRevision,
  FloorplanEditOperation,
  FurnitureCategory,
  FurniturePlaceholder,
  LayoutIntentInvalidationSummary,
  LayoutIntentOperation,
  LayoutIntentRevision,
  LayoutIntentValidationIssue,
  LayoutIntentValidationState,
  P1InvalidationSummary,
  P1RoomType,
  Point2D
} from "@homeai/contracts";
import {
  applyPan,
  applyZoom,
  convertArcLikeInputToPolyline,
  computeFloorplanBBox,
  computeSegmentLengthMm,
  computeViewBoxFromFloorplanBBox,
  constrainToOrthogonal,
  DEFAULT_VIEW_TRANSFORM,
  formatMmAsCm,
  parseCmToMm,
  pointInPolygon,
  pointOnWallAt,
  positionOnWallFromPoint,
  resizeWallToLengthMm,
  roomCentroid,
  snapPoint,
  svgClientPointToWorldMm,
  type ViewTransform
} from "../_lib/geometry-view.js";
import {
  applyLayoutIntentOperations,
  applyP1Operations,
  confirmLayoutIntent,
  confirmP1Draft,
  debugPayloadUrl,
  fetchP1Draft,
  getLayoutIntent,
  recomputeP1Boundaries,
  startLayoutIntentSession,
  startP1Session,
  validateLayoutIntent,
  validateP1Draft
} from "../_lib/p1-api-client.js";

type ToolMode = "select" | "wall.add" | "door.add" | "window.add" | "balcony.add" | "freeWall.draw";

type AdvancedWallMode = "free_straight" | "polyline" | "arc_like";

type LayoutToolMode = "layout.select" | "layout.placeholder.add" | "layout.placeholder.move" | "layout.placeholder.rotate";

type SelectedElement =
  | { type: "wall"; id: string }
  | { type: "door"; id: string }
  | { type: "window"; id: string }
  | { type: "balcony"; id: string }
  | { type: "room"; id: string }
  | null;

type DragState = {
  wallId: string;
  endpoint: "start" | "end";
};

type OpeningDragState = {
  openingId: string;
  startPoint: Point2D;
};

type BalconyDragState = {
  roomId: string;
  startPoint: Point2D;
};

type PlaceholderDragState = {
  placeholderId: string;
};

type ConfirmSuccess = {
  canonicalRevisionId: string;
  geometryHash: string;
  sceneContractId: string;
  nextStage: string;
  invalidationSummary: P1InvalidationSummary;
};

type LayoutConfirmSuccess = {
  layoutIntentRevisionId: string;
  layoutIntentContractId: string;
  layoutIntentHash: string;
  geometryHash: string;
  invalidationSummary: LayoutIntentInvalidationSummary;
};

const ROOM_TYPES: P1RoomType[] = [
  "bedroom",
  "primary_bedroom",
  "secondary_bedroom",
  "kids_room",
  "living_room",
  "dining_room",
  "kitchen",
  "bathroom",
  "balcony",
  "study",
  "storage",
  "entry",
  "corridor",
  "cloakroom",
  "living_dining"
];

const FURNITURE_CATEGORIES: FurnitureCategory[] = [
  "bed",
  "sofa",
  "dining_table",
  "dining_chair",
  "wardrobe",
  "desk",
  "tv_console",
  "coffee_table",
  "side_table",
  "bookshelf",
  "shoe_cabinet",
  "storage_cabinet",
  "washing_machine",
  "dryer",
  "fridge",
  "custom"
];

const FURNITURE_CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  bed: "床",
  sofa: "沙发",
  dining_table: "餐桌",
  dining_chair: "餐椅",
  wardrobe: "衣柜",
  desk: "书桌",
  tv_console: "电视柜",
  coffee_table: "茶几",
  side_table: "边几",
  bookshelf: "书架",
  shoe_cabinet: "鞋柜",
  storage_cabinet: "收纳柜",
  washing_machine: "洗衣机",
  dryer: "烘干机",
  fridge: "冰箱",
  custom: "自定义"
};

const DEFAULT_PLACEHOLDER_SIZE_MM: Record<FurnitureCategory, { width: number; depth: number }> = {
  bed: { width: 1500, depth: 2000 },
  sofa: { width: 2200, depth: 900 },
  dining_table: { width: 1400, depth: 800 },
  dining_chair: { width: 450, depth: 450 },
  wardrobe: { width: 1800, depth: 600 },
  desk: { width: 1200, depth: 600 },
  tv_console: { width: 1600, depth: 400 },
  coffee_table: { width: 900, depth: 500 },
  side_table: { width: 500, depth: 500 },
  bookshelf: { width: 1000, depth: 350 },
  shoe_cabinet: { width: 1000, depth: 350 },
  storage_cabinet: { width: 1000, depth: 450 },
  washing_machine: { width: 600, depth: 650 },
  dryer: { width: 600, depth: 650 },
  fridge: { width: 850, depth: 700 },
  custom: { width: 1000, depth: 1000 }
};

export function P1FloorplanEditor({ homeId }: { homeId: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [draftRevisionId, setDraftRevisionId] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState<FloorplanDraftRevision | null>(null);
  const [validationState, setValidationState] = useState<DraftValidationState | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [viewTransform, setViewTransform] = useState<ViewTransform>(DEFAULT_VIEW_TRANSFORM);
  const [pendingWallStart, setPendingWallStart] = useState<Point2D | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [openingDragState, setOpeningDragState] = useState<OpeningDragState | null>(null);
  const [balconyDragState, setBalconyDragState] = useState<BalconyDragState | null>(null);
  const [lengthInputCm, setLengthInputCm] = useState("");
  const [wallThicknessInputCm, setWallThicknessInputCm] = useState("");
  const [floorHeightInputCm, setFloorHeightInputCm] = useState("");
  const [doorWidthInputCm, setDoorWidthInputCm] = useState("");
  const [doorHeightInputCm, setDoorHeightInputCm] = useState("");
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [lastWallThicknessMm, setLastWallThicknessMm] = useState(120);
  const [advancedWallMode, setAdvancedWallMode] = useState<AdvancedWallMode>("free_straight");
  const [reentryState, setReentryState] = useState<{
    activeCanonicalRevisionId: string;
    previousGeometryHash: string;
  } | null>(null);
  const [showReentryEditNotice, setShowReentryEditNotice] = useState(false);
  const [reentryNoticeDismissed, setReentryNoticeDismissed] = useState(false);
  const [hasShownReentryEditNotice, setHasShownReentryEditNotice] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState<ConfirmSuccess | null>(null);
  const [layoutIntentRevisionId, setLayoutIntentRevisionId] = useState<string | null>(null);
  const [layoutIntent, setLayoutIntent] = useState<LayoutIntentRevision | null>(null);
  const [layoutIntentHash, setLayoutIntentHash] = useState<string | null>(null);
  const [layoutIntentValidation, setLayoutIntentValidation] = useState<LayoutIntentValidationState | null>(null);
  const [layoutIntentContractId, setLayoutIntentContractId] = useState<string | null>(null);
  const [layoutIntentError, setLayoutIntentError] = useState<string | null>(null);
  const [isLayoutIntentLoading, setIsLayoutIntentLoading] = useState(false);
  const [isLayoutIntentSaving, setIsLayoutIntentSaving] = useState(false);
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<string | null>(null);
  const [activeLayoutTool, setActiveLayoutTool] = useState<LayoutToolMode>("layout.select");
  const [aiAutofillEnabled, setAiAutofillEnabled] = useState(true);
  const [selectedFurnitureCategory, setSelectedFurnitureCategory] = useState<FurnitureCategory>("bed");
  const [placeholderWidthCm, setPlaceholderWidthCm] = useState("");
  const [placeholderDepthCm, setPlaceholderDepthCm] = useState("");
  const [placeholderRotationDeg, setPlaceholderRotationDeg] = useState("0");
  const [placeholderDragState, setPlaceholderDragState] = useState<PlaceholderDragState | null>(null);
  const [layoutConfirmSuccess, setLayoutConfirmSuccess] = useState<LayoutConfirmSuccess | null>(null);
  const devHostname = typeof window === "undefined" ? "" : window.location.hostname;
  const showDebugLink = devHostname === "localhost" || devHostname === "127.0.0.1";

  useEffect(() => {
    let cancelled = false;
    void loadDraftSession(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [homeId]);

  const bbox = useMemo(
    () => computeFloorplanBBox(currentDraft ?? { walls: [], rooms: [] }),
    [currentDraft]
  );
  const viewBox = useMemo(
    () => computeViewBoxFromFloorplanBBox(bbox, viewTransform),
    [bbox, viewTransform]
  );
  const selectedWall = selectedElement?.type === "wall"
    ? currentDraft?.walls.find((wall) => wall.wallId === selectedElement.id)
    : undefined;
  const selectedOpening = selectedElement?.type === "door" || selectedElement?.type === "window"
    ? currentDraft?.openings.find((opening) => opening.openingId === selectedElement.id)
    : undefined;
  const selectedRoom = selectedElement?.type === "room" || selectedElement?.type === "balcony"
    ? currentDraft?.rooms.find((room) => room.roomId === selectedElement.id)
    : undefined;
  const layoutSessionEnabled = confirmSuccess !== null || reentryState !== null;
  const selectedPlaceholder = selectedPlaceholderId === null
    ? undefined
    : layoutIntent?.placeholders.find((placeholder) => placeholder.placeholderId === selectedPlaceholderId);

  useEffect(() => {
    setLengthInputCm(selectedWall === undefined ? "" : formatMmAsCm(computeSegmentLengthMm(selectedWall)));
    setWallThicknessInputCm(selectedWall === undefined ? "" : formatMmAsCm(selectedWall.thicknessMm));
    if (selectedWall !== undefined) {
      setLastWallThicknessMm(selectedWall.thicknessMm);
    }
  }, [selectedWall]);

  useEffect(() => {
    setFloorHeightInputCm(formatMmAsCm(currentDraft?.globalParams.floorHeightMm ?? 2800));
  }, [currentDraft?.globalParams.floorHeightMm]);

  useEffect(() => {
    if (selectedOpening?.type !== "door") {
      setDoorWidthInputCm("");
      setDoorHeightInputCm("");
      return;
    }
    setDoorWidthInputCm(formatMmAsCm(selectedOpening.widthMm));
    setDoorHeightInputCm(formatMmAsCm(selectedOpening.heightMm));
  }, [selectedOpening]);

  useEffect(() => {
    if (selectedPlaceholder === undefined) {
      setPlaceholderWidthCm("");
      setPlaceholderDepthCm("");
      setPlaceholderRotationDeg("0");
      return;
    }
    setPlaceholderWidthCm(formatMmAsCm(selectedPlaceholder.displaySizeMm.width));
    setPlaceholderDepthCm(formatMmAsCm(selectedPlaceholder.displaySizeMm.depth));
    setPlaceholderRotationDeg(String(selectedPlaceholder.rotationDeg));
  }, [selectedPlaceholder]);

  useEffect(() => {
    if (selectedElement === null || currentDraft === null) {
      return;
    }
    const stillExists =
      (selectedElement.type === "wall" && currentDraft.walls.some((wall) => wall.wallId === selectedElement.id)) ||
      (selectedElement.type === "door" && currentDraft.openings.some((opening) => opening.type === "door" && opening.openingId === selectedElement.id)) ||
      (selectedElement.type === "window" && currentDraft.openings.some((opening) => opening.type === "window" && opening.openingId === selectedElement.id)) ||
      ((selectedElement.type === "room" || selectedElement.type === "balcony") && currentDraft.rooms.some((room) => room.roomId === selectedElement.id));
    if (!stillExists) {
      setSelectedElement(null);
    }
  }, [currentDraft, selectedElement]);

  useEffect(() => {
    if (selectedPlaceholderId === null || layoutIntent === null) {
      return;
    }
    if (!layoutIntent.placeholders.some((placeholder) => placeholder.placeholderId === selectedPlaceholderId)) {
      setSelectedPlaceholderId(null);
    }
  }, [layoutIntent, selectedPlaceholderId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedElement(null);
        setSelectedPlaceholderId(null);
        setPendingWallStart(null);
        setOpeningDragState(null);
        setBalconyDragState(null);
        setActiveTool("select");
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && (selectedElement !== null || selectedPlaceholderId !== null)) {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
          return;
        }
        event.preventDefault();
        if (selectedPlaceholderId !== null) {
          void handleDeleteSelectedPlaceholder();
        } else {
          void handleDeleteSelected();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, selectedPlaceholderId, currentDraft, draftRevisionId, layoutIntentRevisionId]);

  async function submitOperations(
    operations: FloorplanEditOperation[],
    options: { showReentryNotice?: boolean } = { showReentryNotice: true }
  ): Promise<FloorplanDraftRevision | undefined> {
    if (draftRevisionId === null) {
      return undefined;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const response = await applyP1Operations(draftRevisionId, operations);
      let nextDraft = response.draft;
      if (shouldRecomputeBoundaries(operations)) {
        await recomputeP1Boundaries(draftRevisionId);
        nextDraft = (await fetchP1Draft(draftRevisionId)).draft;
      }
      setCurrentDraft(nextDraft);
      const validation = await validateP1Draft(draftRevisionId);
      setValidationState(validation);
      setIsDirty(true);
      if (options.showReentryNotice !== false && reentryState !== null && !hasShownReentryEditNotice && !reentryNoticeDismissed) {
        setShowReentryEditNotice(true);
        setHasShownReentryEditNotice(true);
      }
      return nextDraft;
    } catch (error) {
      if (isDraftNotFoundError(error)) {
        await loadDraftSession(() => false);
        setApiError("草稿会话已刷新，请重试刚才的操作。");
      } else {
        setApiError(error instanceof Error ? error.message : "操作未保存，已保留服务器草稿");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function loadDraftSession(isCancelled: () => boolean, retried = false): Promise<void> {
    setIsLoading(true);
    setApiError(null);
    try {
      const session = await startP1Session(homeId);
      if (isCancelled()) {
        return;
      }
      setDraftRevisionId(session.draftRevisionId);
      setIsAdvancedSettingsOpen(false);
      setLayoutIntentRevisionId(null);
      setLayoutIntent(null);
      setLayoutIntentHash(null);
      setLayoutIntentValidation(null);
      setLayoutIntentContractId(null);
      setSelectedPlaceholderId(null);
      setReentryState(
        session.activeCanonicalRevisionId !== undefined && session.geometryHash !== undefined
          ? {
              activeCanonicalRevisionId: session.activeCanonicalRevisionId,
              previousGeometryHash: session.geometryHash
            }
          : null
      );
      const response = await fetchP1Draft(session.draftRevisionId);
      if (isCancelled()) {
        return;
      }
      setCurrentDraft(response.draft);
      setValidationState(response.validation);
    } catch (error) {
      if (isDraftNotFoundError(error) && !retried) {
        await loadDraftSession(isCancelled, true);
        return;
      }
      if (!isCancelled()) {
        setApiError(error instanceof Error ? error.message : "无法加载户型草稿");
      }
    } finally {
      if (!isCancelled()) {
        setIsLoading(false);
      }
    }
  }

  function createOperation(
    operationType: FloorplanEditOperation["operationType"],
    targetType: FloorplanEditOperation["targetType"],
    options: { targetId?: string; payload?: Record<string, unknown> } = {}
  ): FloorplanEditOperation {
    return {
      operationId: `op-${operationType}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      operationType,
      targetType,
      ...(options.targetId === undefined ? {} : { targetId: options.targetId }),
      actor: "user",
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      createdAt: new Date().toISOString()
    };
  }

  function createLayoutOperation(
    operationType: LayoutIntentOperation["operationType"],
    options: { placeholderId?: string; payload?: Record<string, unknown> } = {}
  ): LayoutIntentOperation {
    return {
      operationId: `layout-op-${operationType}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      operationType,
      ...(options.placeholderId === undefined ? {} : { placeholderId: options.placeholderId }),
      actor: "user",
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      createdAt: new Date().toISOString()
    };
  }

  async function loadLayoutIntentSession(force = false) {
    if (!force && !layoutSessionEnabled) {
      return;
    }
    setIsLayoutIntentLoading(true);
    setLayoutIntentError(null);
    try {
      const session = await startLayoutIntentSession(homeId);
      const nextLayoutIntent = await getLayoutIntent(session.layoutIntentRevisionId);
      setLayoutIntentRevisionId(session.layoutIntentRevisionId);
      setLayoutIntent(nextLayoutIntent);
      setLayoutIntentHash(nextLayoutIntent.layoutIntentHash);
      setLayoutIntentValidation(nextLayoutIntent.validation);
      setAiAutofillEnabled(nextLayoutIntent.aiAutofillEnabled);
      setLayoutIntentContractId(null);
      setLayoutConfirmSuccess(null);
    } catch (error) {
      setLayoutIntentError(error instanceof Error ? error.message : "无法加载家具摆放意图");
    } finally {
      setIsLayoutIntentLoading(false);
    }
  }

  async function submitLayoutOperations(operations: LayoutIntentOperation[]): Promise<LayoutIntentRevision | undefined> {
    if (layoutIntentRevisionId === null) {
      return undefined;
    }
    setIsLayoutIntentSaving(true);
    setLayoutIntentError(null);
    try {
      const response = await applyLayoutIntentOperations(layoutIntentRevisionId, operations);
      setLayoutIntent(response.layoutIntent);
      setLayoutIntentHash(response.layoutIntentHash);
      setLayoutIntentValidation(response.validation);
      setAiAutofillEnabled(response.layoutIntent.aiAutofillEnabled);
      setLayoutConfirmSuccess(null);
      return response.layoutIntent;
    } catch (error) {
      setLayoutIntentError(error instanceof Error ? error.message : "家具摆放意图未保存，已保留当前状态");
      return undefined;
    } finally {
      setIsLayoutIntentSaving(false);
    }
  }

  function handleAdvancedToggle() {
    const next = !isAdvancedSettingsOpen;
    setIsAdvancedSettingsOpen(next);
    if (!next && activeTool === "freeWall.draw") {
      setActiveTool("select");
      setPendingWallStart(null);
    }
    void submitOperations([
      createOperation("advanced.settings.toggle", "draft", {
        payload: { isOpen: next }
      })
    ], { showReentryNotice: false });
    if (next) {
      void loadLayoutIntentSession();
    }
  }

  function createFreeWallOperations(points: Point2D[], mode: AdvancedWallMode): FloorplanEditOperation[] {
    const usablePoints = points.filter((point, index, allPoints) => {
      const previous = allPoints[index - 1];
      return previous === undefined || previous.x !== point.x || previous.y !== point.y;
    });
    const operations: FloorplanEditOperation[] = [];
    for (let index = 0; index < usablePoints.length - 1; index += 1) {
      const start = usablePoints[index];
      const end = usablePoints[index + 1];
      if (start === undefined || end === undefined) {
        continue;
      }
      operations.push(createOperation("freeWall.draw", "wall", {
        payload: {
          wallId: `wall-free-${Date.now()}-${index + 1}`,
          start,
          end,
          thicknessMm: lastWallThicknessMm,
          kind: "interior",
          uiKind: mode
        }
      }));
    }
    return operations;
  }

  async function handleAddPolylineWall() {
    if (currentDraft === null) {
      return;
    }
    const start = {
      x: Math.round((bbox.minX + bbox.widthMm * 0.2) / 100) * 100,
      y: Math.round((bbox.minY + bbox.heightMm * 0.25) / 100) * 100
    };
    const mid = { x: start.x + 900, y: start.y + 600 };
    const end = { x: start.x + 1800, y: start.y + 300 };
    await submitOperations(createFreeWallOperations([start, mid, end], "polyline"));
  }

  async function handleAddArcLikeWall() {
    if (currentDraft === null) {
      return;
    }
    const start = {
      x: Math.round((bbox.minX + bbox.widthMm * 0.55) / 100) * 100,
      y: Math.round((bbox.minY + bbox.heightMm * 0.25) / 100) * 100
    };
    const control = { x: start.x + 700, y: start.y - 500 };
    const end = { x: start.x + 1400, y: start.y };
    const points = convertArcLikeInputToPolyline(start, control, end);
    await submitOperations(createFreeWallOperations(points, "arc_like"));
  }

  function handleSvgPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (currentDraft === null) {
      return;
    }
    const point = canvasPointFromEvent(event);
    if (point === null) {
      return;
    }
    if (isAdvancedSettingsOpen && activeLayoutTool === "layout.placeholder.add") {
      void addPlaceholderAt(point);
      return;
    }
    if (activeTool === "wall.add") {
      const snapped = snapPoint(point, currentDraft.globalParams.gridSizeMm ?? 100);
      if (pendingWallStart === null) {
        setPendingWallStart(snapped);
        return;
      }
      const end = snapPoint(constrainToOrthogonal(pendingWallStart, snapped), currentDraft.globalParams.gridSizeMm ?? 100);
      const wall: DraftWallSegment = {
        wallId: `wall-user-${Date.now()}`,
        start: pendingWallStart,
        end,
        thicknessMm: lastWallThicknessMm,
        kind: "interior",
        source: "user_created"
      };
      setPendingWallStart(null);
      void submitOperations([createOperation("wall.add", "wall", { payload: { wall } })]);
      return;
    }
    if (activeTool === "freeWall.draw" && isAdvancedSettingsOpen) {
      const snapped = snapPoint(point, currentDraft.globalParams.gridSizeMm ?? 100);
      if (pendingWallStart === null) {
        setPendingWallStart(snapped);
        return;
      }
      setPendingWallStart(null);
      void submitOperations(createFreeWallOperations([pendingWallStart, snapped], advancedWallMode));
      return;
    }
    if (activeTool === "balcony.add") {
      void addBalconyAt(point);
      return;
    }
    const room = currentDraft.rooms.find((candidate) => pointInPolygon(point, candidate.polygon));
    if (room !== undefined) {
      setSelectedElement({ type: room.roomType === "balcony" ? "balcony" : "room", id: room.roomId });
    } else {
      setSelectedElement(null);
    }
  }

  function handleSvgPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (
      dragState === null &&
      placeholderDragState === null &&
      openingDragState === null &&
      balconyDragState === null
    ) {
      return;
    }
    event.preventDefault();
  }

  function handleSvgPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (openingDragState !== null) {
      const point = canvasPointFromEvent(event);
      const state = openingDragState;
      setOpeningDragState(null);
      if (point !== null && distanceBetween(point, state.startPoint) > 30) {
        void moveOpeningToPoint(state.openingId, point);
      }
      return;
    }
    if (balconyDragState !== null) {
      const point = canvasPointFromEvent(event);
      const state = balconyDragState;
      setBalconyDragState(null);
      if (point !== null) {
        const delta = {
          x: Math.round((point.x - state.startPoint.x) / 10) * 10,
          y: Math.round((point.y - state.startPoint.y) / 10) * 10
        };
        if (Math.hypot(delta.x, delta.y) > 30) {
          void submitOperations([
            createOperation("balcony.move", "room", {
              targetId: state.roomId,
              payload: { delta }
            })
          ]);
        }
      }
      return;
    }
    if (placeholderDragState !== null) {
      const point = canvasPointFromEvent(event);
      const placeholderId = placeholderDragState.placeholderId;
      setPlaceholderDragState(null);
      if (point !== null) {
        void movePlaceholder(placeholderId, point);
      }
      return;
    }
    if (dragState === null || currentDraft === null) {
      return;
    }
    const point = canvasPointFromEvent(event);
    const wall = currentDraft.walls.find((candidate) => candidate.wallId === dragState.wallId);
    if (point === null || wall === undefined) {
      setDragState(null);
      return;
    }
    const snapped = snapPoint(point, currentDraft.globalParams.gridSizeMm ?? 100);
    const fixed = dragState.endpoint === "start" ? wall.end : wall.start;
    const constrained = constrainToOrthogonal(fixed, snapped);
    setDragState(null);
    void submitOperations([
      createOperation("wall.moveEndpoint", "wall", {
        targetId: dragState.wallId,
        payload: {
          endpoint: dragState.endpoint,
          point: constrained
        }
      })
    ]);
  }

  function canvasPointFromEvent(event: { clientX: number; clientY: number }): Point2D | null {
    const svg = svgRef.current;
    if (svg === null) {
      return null;
    }
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return {
        x: viewBox.minX + viewBox.width / 2,
        y: viewBox.minY + viewBox.height / 2
      };
    }
    return svgClientPointToWorldMm(
      { x: event.clientX, y: event.clientY },
      rect,
      viewBox
    );
  }

  async function addDoorToSelectedWall() {
    if (currentDraft === null || selectedWall === undefined) {
      return;
    }
    await addDoorToWall(selectedWall);
  }

  async function addDoorToWall(wall: DraftWallSegment, positionOnWall = 0.5) {
    const opening: DraftDoorOpening = {
      openingId: `door-user-${Date.now()}`,
      type: "door",
      wallId: wall.wallId,
      positionOnWall,
      widthMm: 800,
      heightMm: 2000,
      swing: "left_in",
      source: "user_created"
    };
    await submitOperations([createOperation("door.add", "opening", { payload: { opening } })]);
  }

  async function addWindowToSelectedWall() {
    if (currentDraft === null || selectedWall === undefined) {
      return;
    }
    await addWindowToWall(selectedWall);
  }

  async function addWindowToWall(wall: DraftWallSegment, positionOnWall = 0.5) {
    const opening: DraftWindowOpening = {
      openingId: `window-user-${Date.now()}`,
      type: "window",
      windowKind: "standard",
      wallId: wall.wallId,
      positionOnWall,
      widthMm: 1200,
      heightMm: 1300,
      sillHeightMm: 900,
      source: "user_created"
    };
    await submitOperations([createOperation("window.add", "opening", { payload: { opening } })]);
  }

  async function moveOpeningToPoint(openingId: string, point: Point2D) {
    if (currentDraft === null) {
      return;
    }
    const opening = currentDraft.openings.find((candidate) => candidate.openingId === openingId);
    const wall = opening === undefined ? undefined : currentDraft.walls.find((candidate) => candidate.wallId === opening.wallId);
    if (opening === undefined || wall === undefined) {
      return;
    }
    await submitOperations([
      createOperation("opening.position.change", "opening", {
        targetId: opening.openingId,
        payload: { positionOnWall: positionOnWallFromPoint(wall, point) }
      })
    ]);
  }

  async function addBalconyAt(point: Point2D) {
    if (currentDraft === null) {
      return;
    }
    const widthMm = 2400;
    const depthMm = 1200;
    const attachedWall = nearestExteriorWall(currentDraft, point);
    const isAttached = attachedWall !== undefined;
    const anchorX = Math.round(point.x / 100) * 100;
    const anchorY = Math.round(point.y / 100) * 100;
    const room: DraftRoom = {
      roomId: `room-balcony-${Date.now()}`,
      roomType: "balcony",
      polygon: [
        { x: anchorX, y: anchorY },
        { x: anchorX + widthMm, y: anchorY },
        { x: anchorX + widthMm, y: anchorY + depthMm },
        { x: anchorX, y: anchorY + depthMm },
        { x: anchorX, y: anchorY }
      ],
      source: "user_labeled",
      balconyMeta: {
        enclosureType: "closed",
        isExteriorAttached: true,
        adjacentInteriorRoomIds: [currentDraft.rooms.find((candidate) => candidate.roomType !== "balcony")?.roomId ?? "room-missing"],
        connectionWallIds: [isAttached ? attachedWall.wallId : "wall-missing"],
        exteriorEdgeIds: [isAttached ? attachedWall.wallId : "wall-missing"]
      }
    };
    await submitOperations([createOperation("balcony.add", "room", { payload: { room } })]);
  }

  async function addPlaceholderAt(point: Point2D) {
    if (currentDraft === null || layoutIntentRevisionId === null) {
      return;
    }
    const room = currentDraft.rooms.find((candidate) => pointInPolygon(point, candidate.polygon));
    const displaySizeMm = DEFAULT_PLACEHOLDER_SIZE_MM[selectedFurnitureCategory];
    const placeholder: FurniturePlaceholder = {
      placeholderId: `placeholder-user-${Date.now()}`,
      roomId: room?.roomId ?? "room-missing",
      category: selectedFurnitureCategory,
      center: {
        x: Math.round(point.x / 10) * 10,
        y: Math.round(point.y / 10) * 10
      },
      rotationDeg: 0,
      displaySizeMm,
      sizeSource: "category_default",
      userResizable: true,
      source: "user_placed",
      label: FURNITURE_CATEGORY_LABELS[selectedFurnitureCategory],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const nextLayout = await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.add", {
        placeholderId: placeholder.placeholderId,
        payload: { placeholder }
      })
    ]);
    if (nextLayout !== undefined) {
      setSelectedPlaceholderId(placeholder.placeholderId);
      setSelectedElement(null);
      setActiveLayoutTool("layout.select");
    }
  }

  async function movePlaceholder(placeholderId: string, center: Point2D) {
    await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.move", {
        placeholderId,
        payload: {
          center: {
            x: Math.round(center.x / 10) * 10,
            y: Math.round(center.y / 10) * 10
          }
        }
      })
    ]);
  }

  async function rotateSelectedPlaceholder(deltaDeg: number) {
    if (selectedPlaceholder === undefined) {
      return;
    }
    await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.rotate", {
        placeholderId: selectedPlaceholder.placeholderId,
        payload: { rotationDeg: selectedPlaceholder.rotationDeg + deltaDeg }
      })
    ]);
  }

  async function handlePlaceholderRotationSubmit() {
    if (selectedPlaceholder === undefined) {
      return;
    }
    const rotationDeg = Number(placeholderRotationDeg);
    await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.rotate", {
        placeholderId: selectedPlaceholder.placeholderId,
        payload: { rotationDeg: Number.isFinite(rotationDeg) ? rotationDeg : selectedPlaceholder.rotationDeg }
      })
    ]);
  }

  async function handlePlaceholderCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    if (selectedPlaceholder === undefined) {
      return;
    }
    await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.category.change", {
        placeholderId: selectedPlaceholder.placeholderId,
        payload: { category: event.target.value }
      })
    ]);
  }

  async function handlePlaceholderDisplaySizeSubmit() {
    if (selectedPlaceholder === undefined) {
      return;
    }
    await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.displaySize.change", {
        placeholderId: selectedPlaceholder.placeholderId,
        payload: {
          displaySizeMm: {
            width: parseCmToMm(placeholderWidthCm),
            depth: parseCmToMm(placeholderDepthCm)
          }
        }
      })
    ]);
  }

  async function handleAiAutofillChange(event: ChangeEvent<HTMLInputElement>) {
    const enabled = event.target.checked;
    setAiAutofillEnabled(enabled);
    await submitLayoutOperations([
      createLayoutOperation("layout.aiAutofill.toggle", {
        payload: { aiAutofillEnabled: enabled }
      })
    ]);
  }

  async function handleDeleteSelectedPlaceholder() {
    if (selectedPlaceholderId === null) {
      return;
    }
    const deletedPlaceholderId = selectedPlaceholderId;
    const nextLayout = await submitLayoutOperations([
      createLayoutOperation("layout.placeholder.delete", {
        placeholderId: deletedPlaceholderId
      })
    ]);
    if (nextLayout !== undefined) {
      setSelectedPlaceholderId(null);
    }
  }

  async function handleWallLengthSubmit() {
    if (selectedWall === undefined) {
      return;
    }
    const lengthMm = parseCmToMm(lengthInputCm);
    const resized = resizeWallToLengthMm(selectedWall, lengthMm);
    await submitOperations([
      createOperation("wall.resize", "wall", {
        targetId: selectedWall.wallId,
        payload: {
          start: resized.start,
          end: resized.end
        }
      })
    ]);
  }

  async function handleWallThicknessSubmit() {
    if (selectedWall === undefined) {
      return;
    }
    const thicknessMm = parseCmToMm(wallThicknessInputCm);
    setLastWallThicknessMm(thicknessMm);
    await submitOperations([
      createOperation("wall.thickness.change", "wall", {
        targetId: selectedWall.wallId,
        payload: { thicknessMm }
      })
    ]);
  }

  async function handleFloorHeightSubmit() {
    const floorHeightMm = parseCmToMm(floorHeightInputCm);
    const beforeGeometry = JSON.stringify({
      walls: currentDraft?.walls ?? [],
      rooms: currentDraft?.rooms ?? [],
      openings: currentDraft?.openings ?? []
    });
    const updated = await submitOperations([
      createOperation("floorHeight.change", "global_params", {
        payload: { floorHeightMm }
      })
    ]);
    if (updated !== undefined) {
      const afterGeometry = JSON.stringify({
        walls: updated.walls,
        rooms: updated.rooms,
        openings: updated.openings
      });
      if (beforeGeometry !== afterGeometry) {
        setApiError("Floor height changed 2D geometry unexpectedly.");
      }
    }
  }

  async function handleDoorDimensionsSubmit() {
    if (selectedOpening?.type !== "door") {
      return;
    }
    await submitOperations([
      createOperation("door.dimension.change", "opening", {
        targetId: selectedOpening.openingId,
        payload: {
          widthMm: parseCmToMm(doorWidthInputCm),
          heightMm: parseCmToMm(doorHeightInputCm)
        }
      })
    ]);
  }

  async function handleDeleteSelected() {
    if (selectedElement === null) {
      return;
    }
    let updated: FloorplanDraftRevision | undefined;
    if (selectedElement.type === "wall") {
      updated = await submitOperations([createOperation("wall.delete", "wall", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "door") {
      updated = await submitOperations([createOperation("door.delete", "opening", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "window") {
      updated = await submitOperations([createOperation("window.delete", "opening", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "balcony") {
      updated = await submitOperations([createOperation("balcony.delete", "room", { targetId: selectedElement.id })]);
    }
    if (updated !== undefined) {
      setSelectedElement(null);
    }
  }

  async function handleDoorSwingChange(event: ChangeEvent<HTMLSelectElement>) {
    if (selectedOpening?.type !== "door") {
      return;
    }
    await submitOperations([
      createOperation("door.direction.change", "opening", {
        targetId: selectedOpening.openingId,
        payload: { swing: event.target.value }
      })
    ]);
  }

  async function handleWindowKindChange(event: ChangeEvent<HTMLSelectElement>) {
    if (selectedOpening?.type !== "window") {
      return;
    }
    const beforeWalls = JSON.stringify(currentDraft?.walls ?? []);
    const updated = await submitOperations([
      createOperation("window.type.change", "opening", {
        targetId: selectedOpening.openingId,
        payload: { windowKind: event.target.value }
      })
    ]);
    if (updated !== undefined && beforeWalls !== JSON.stringify(updated.walls)) {
      setApiError("Bay window changed wall geometry unexpectedly.");
    }
  }

  async function handleBalconyTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    if (selectedRoom?.roomType !== "balcony") {
      return;
    }
    await submitOperations([
      createOperation("balcony.type.change", "room", {
        targetId: selectedRoom.roomId,
        payload: { enclosureType: event.target.value }
      })
    ]);
  }

  async function handleRoomTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    if (selectedRoom === undefined || selectedRoom.roomType === "balcony" || event.target.value === "balcony") {
      return;
    }
    await submitOperations([
      createOperation("room.type.change", "room", {
        targetId: selectedRoom.roomId,
        payload: { roomType: event.target.value }
      })
    ]);
  }

  async function handleConfirm() {
    if (draftRevisionId === null) {
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const validation = await validateP1Draft(draftRevisionId);
      setValidationState(validation);
      if (!validation.canConfirm) {
        return;
      }
      const result = await confirmP1Draft(draftRevisionId);
      if (!result.ok) {
        setValidationState(result.validation);
        return;
      }
      const success = {
        canonicalRevisionId: result.canonicalRevisionId,
        geometryHash: result.geometryHash,
        sceneContractId: result.sceneContractId,
        nextStage: result.nextStage,
        invalidationSummary: result.invalidationSummary
      };
      setConfirmSuccess(success);
      setIsDirty(false);
      if (isAdvancedSettingsOpen) {
        void loadLayoutIntentSession(true);
      }
      window.history.replaceState(null, "", `/p1/${homeId}?nextStage=${result.nextStage}`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "确认户型失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmLayoutIntent() {
    if (layoutIntentRevisionId === null) {
      return;
    }
    setIsLayoutIntentSaving(true);
    setLayoutIntentError(null);
    try {
      const nextValidation = await validateLayoutIntent(layoutIntentRevisionId);
      setLayoutIntentValidation(nextValidation);
      if (!nextValidation.canConfirm) {
        return;
      }
      const result = await confirmLayoutIntent(layoutIntentRevisionId);
      if (!result.ok) {
        setLayoutIntentValidation(result.validation);
        return;
      }
      setLayoutIntentContractId(result.layoutIntentContractId);
      setLayoutIntentHash(result.layoutIntentHash);
      setLayoutConfirmSuccess({
        layoutIntentRevisionId: result.layoutIntentRevisionId,
        layoutIntentContractId: result.layoutIntentContractId,
        layoutIntentHash: result.layoutIntentHash,
        geometryHash: result.geometryHash,
        invalidationSummary: result.invalidationSummary
      });
    } catch (error) {
      setLayoutIntentError(error instanceof Error ? error.message : "确认家具摆放意图失败");
    } finally {
      setIsLayoutIntentSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main style={styles.centered}>
        <p>正在加载户型草稿...</p>
      </main>
    );
  }

  if (apiError !== null && currentDraft === null) {
    return (
      <main style={styles.centered}>
        <h1>P1 户型确认</h1>
        <p role="alert">{apiError}</p>
      </main>
    );
  }

  return (
    <main style={styles.shell}>
      <section style={styles.header}>
        <div>
          <p style={styles.eyebrow}>P1 Space Truth</p>
          <h1 style={styles.title}>户型调整</h1>
        </div>
        <div style={styles.headerActions}>
          {showDebugLink ? (
            <a href={debugPayloadUrl(homeId)} style={styles.debugLink} target="_blank" rel="noreferrer">
              Debug payload
            </a>
          ) : null}
          <button type="button" style={styles.confirmButton} disabled={isSaving} onClick={handleConfirm}>
            确认户型，开始设计
          </button>
        </div>
      </section>

      <section style={styles.workspace}>
        <aside style={styles.toolbar} aria-label="P1 toolbar">
          {(["select", "wall.add", "door.add", "window.add", "balcony.add"] as ToolMode[]).map((tool) => (
            <button
              key={tool}
              type="button"
              data-testid={`tool-${tool}`}
              aria-pressed={activeTool === tool}
              onClick={() => setActiveTool(tool)}
              style={activeTool === tool ? styles.toolButtonActive : styles.toolButton}
            >
              {toolLabel(tool)}
            </button>
          ))}
          {isAdvancedSettingsOpen ? (
            <button
              type="button"
              data-testid="tool-freeWall.draw"
              aria-pressed={activeTool === "freeWall.draw"}
              onClick={() => setActiveTool("freeWall.draw")}
              style={activeTool === "freeWall.draw" ? styles.toolButtonActive : styles.toolButton}
            >
              Free wall
            </button>
          ) : null}
          <button
            type="button"
            data-testid="advanced-settings-toggle"
            aria-pressed={isAdvancedSettingsOpen}
            style={isAdvancedSettingsOpen ? styles.toolButtonActive : styles.toolButton}
            onClick={handleAdvancedToggle}
          >
            Advanced
          </button>
          <button type="button" style={styles.toolButton} onClick={() => setViewTransform((value) => applyZoom(value, 1.2))}>
            放大
          </button>
          <button type="button" style={styles.toolButton} onClick={() => setViewTransform((value) => applyZoom(value, 1 / 1.2))}>
            缩小
          </button>
          <button type="button" style={styles.toolButton} onClick={() => setViewTransform((value) => applyPan(value, { x: -120, y: 0 }))}>
            左移
          </button>
          <button type="button" style={styles.toolButton} onClick={() => setViewTransform((value) => applyPan(value, { x: 120, y: 0 }))}>
            右移
          </button>
        </aside>

        <section style={styles.stageWrap}>
          {apiError !== null ? <div role="alert" style={styles.errorBanner}>{apiError}</div> : null}
          {reentryState !== null ? (
            <div data-testid="reentry-status" style={styles.statusBanner}>
              Re-entry draft from {reentryState.activeCanonicalRevisionId}
            </div>
          ) : null}
          {showReentryEditNotice ? (
            <div data-testid="reentry-edit-notice" style={styles.noticeBanner}>
              修改户型会导致已生成的方案和渲染重新生成
              <button
                type="button"
                data-testid="dismiss-reentry-notice"
                style={styles.inlineButton}
                onClick={() => {
                  setShowReentryEditNotice(false);
                  setReentryNoticeDismissed(true);
                }}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {confirmSuccess !== null ? (
            <div data-testid="confirm-success" style={styles.successBanner}>
              已确认：{confirmSuccess.geometryHash.slice(0, 18)}... / {confirmSuccess.sceneContractId}
              <span data-testid="confirm-invalidation-summary">
                {confirmSuccess.invalidationSummary.changed
                  ? " 户型已更新，需要重新生成后续方案"
                  : " 户型未变化，已保留当前方案"}
              </span>
            </div>
          ) : null}
          <svg
            ref={svgRef}
            data-testid="p1-canvas-stage"
            style={styles.stage}
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
          >
            <rect
              x={viewBox.minX}
              y={viewBox.minY}
              width={viewBox.width}
              height={viewBox.height}
              fill="#f7f6f2"
              data-testid="floorplan-background-layer"
            />
            <g data-testid="room-layer">
              {currentDraft?.rooms.map((room) => renderRoom(room, selectedElement, setSelectedElement))}
            </g>
            <g data-testid="balcony-layer">
              {currentDraft?.rooms.filter((room) => room.roomType === "balcony").map((room) =>
                renderBalcony(room, selectedElement, (selection, event) => {
                  setSelectedElement(selection);
                  const point = canvasPointFromEvent(event);
                  if (point !== null) {
                    setBalconyDragState({ roomId: room.roomId, startPoint: point });
                  }
                })
              )}
            </g>
            <g data-testid="wall-layer">
              {currentDraft?.walls.map((wall) => renderWall(wall, selectedElement, (selection, event) => {
                const point = canvasPointFromEvent(event);
                const positionOnWall = point === null ? 0.5 : positionOnWallFromPoint(wall, point);
                if (activeTool === "door.add") {
                  void addDoorToWall(wall, positionOnWall);
                  return;
                }
                if (activeTool === "window.add") {
                  void addWindowToWall(wall, positionOnWall);
                  return;
                }
                setSelectedElement(selection);
              }))}
            </g>
            <g data-testid="door-layer">
              {currentDraft?.openings.filter((opening): opening is DraftDoorOpening => opening.type === "door").map((opening) =>
                renderDoor(opening, currentDraft.walls, selectedElement, (selection, event) => {
                  setSelectedElement(selection);
                  const point = canvasPointFromEvent(event);
                  if (point !== null) {
                    setOpeningDragState({ openingId: opening.openingId, startPoint: point });
                  }
                })
              )}
            </g>
            <g data-testid="window-layer">
              {currentDraft?.openings.filter((opening): opening is DraftWindowOpening => opening.type === "window").map((opening) =>
                renderWindow(opening, currentDraft.walls, selectedElement, (selection, event) => {
                  setSelectedElement(selection);
                  const point = canvasPointFromEvent(event);
                  if (point !== null) {
                    setOpeningDragState({ openingId: opening.openingId, startPoint: point });
                  }
                })
              )}
            </g>
            <g data-testid="furniture-placeholder-layer">
              {layoutIntent?.placeholders.map((placeholder) =>
                renderFurniturePlaceholder(
                  placeholder,
                  selectedPlaceholderId,
                  activeLayoutTool,
                  (placeholderId) => {
                    setSelectedPlaceholderId(placeholderId);
                    setSelectedElement(null);
                  },
                  setPlaceholderDragState
                )
              )}
            </g>
            <g data-testid="validation-highlight-layer">
              {validationState?.issues.map((issue) => renderValidationHighlight(issue, currentDraft))}
              {layoutIntentValidation?.issues.map((issue) => renderLayoutValidationHighlight(issue, layoutIntent))}
            </g>
            <g data-testid="selection-handles-layer">
              {selectedWall === undefined ? null : (
                <>
                  {(["start", "end"] as const).map((endpoint) => (
                    <circle
                      key={endpoint}
                      data-testid={`endpoint-${endpoint}`}
                      cx={selectedWall[endpoint].x}
                      cy={selectedWall[endpoint].y}
                      r={80}
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth={24}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setDragState({ wallId: selectedWall.wallId, endpoint });
                      }}
                    />
                  ))}
                </>
              )}
              {pendingWallStart === null ? null : (
                <circle cx={pendingWallStart.x} cy={pendingWallStart.y} r={70} fill="#0f766e" />
              )}
            </g>
          </svg>
        </section>

        <aside style={styles.panel} aria-label="P1 properties panel">
          <div style={styles.panelSection}>
            <h2 style={styles.panelTitle}>属性</h2>
            <p data-testid="active-tool">工具：{toolLabel(activeTool)}</p>
            <p data-testid="dirty-state">状态：{isSaving ? "保存中" : isDirty ? "已修改" : "已同步"}</p>
            <p data-testid="advanced-state">Advanced: {isAdvancedSettingsOpen ? "open" : "closed"}</p>
            {reentryState !== null ? <p data-testid="reentry-panel-state">Re-entry hash: {reentryState.previousGeometryHash.slice(0, 18)}...</p> : null}
          </div>
          {isAdvancedSettingsOpen ? (
            <div style={styles.panelSection} data-testid="advanced-settings-panel">
              <h3 style={styles.sectionTitle}>Advanced settings</h3>
              <label style={styles.label}>
                Floor height (cm)
                <input
                  aria-label="Floor height cm"
                  value={floorHeightInputCm}
                  onChange={(event) => setFloorHeightInputCm(event.target.value)}
                  style={styles.input}
                />
              </label>
              <button type="button" style={styles.fullWidthButton} onClick={handleFloorHeightSubmit} disabled={isSaving}>
                Apply floor height
              </button>
              <label style={styles.label}>
                Free wall mode
                <select
                  aria-label="Free wall mode"
                  value={advancedWallMode}
                  onChange={(event) => setAdvancedWallMode(event.target.value as AdvancedWallMode)}
                  style={styles.input}
                >
                  <option value="free_straight">free_straight</option>
                  <option value="polyline">polyline</option>
                  <option value="arc_like">arc_like</option>
                </select>
              </label>
              <div style={styles.row}>
                <button type="button" onClick={handleAddPolylineWall} disabled={isSaving}>
                  Add polyline wall
                </button>
                <button type="button" onClick={handleAddArcLikeWall} disabled={isSaving}>
                  Add arc-like wall
                </button>
              </div>
              <div style={styles.layoutSection} data-testid="layout-intent-section">
                <h3 style={styles.sectionTitle}>家具摆放意图</h3>
                <p style={styles.helpText}>家具占位只表示摆放意图，不代表最终商品尺寸。</p>
                {!layoutSessionEnabled ? (
                  <p data-testid="layout-intent-disabled">请先确认户型后再设置家具摆放意图。</p>
                ) : null}
                {layoutIntentError !== null ? <p role="alert" style={styles.inlineError}>{layoutIntentError}</p> : null}
                <button
                  type="button"
                  data-testid="layout-session-start"
                  style={styles.fullWidthButton}
                  disabled={!layoutSessionEnabled || isLayoutIntentLoading}
                  onClick={() => void loadLayoutIntentSession()}
                >
                  {layoutIntentRevisionId === null ? "开始家具摆放意图" : "刷新家具摆放意图"}
                </button>
                {layoutIntentRevisionId !== null ? (
                  <div style={styles.compactGrid}>
                    <label style={styles.checkboxLabel}>
                      <input
                        aria-label="AI 补全未摆放家具"
                        type="checkbox"
                        checked={aiAutofillEnabled}
                        onChange={handleAiAutofillChange}
                        disabled={isLayoutIntentSaving}
                      />
                      AI 补全未摆放家具
                    </label>
                    <p style={styles.helpText}>关闭后，系统只围绕你已放置的家具占位生成布局意图。</p>
                    <label style={styles.label}>
                      添加家具类型
                      <select
                        aria-label="家具类型"
                        value={selectedFurnitureCategory}
                        onChange={(event) => setSelectedFurnitureCategory(event.target.value as FurnitureCategory)}
                        style={styles.input}
                      >
                        {FURNITURE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {FURNITURE_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div style={styles.row}>
                      {(["layout.select", "layout.placeholder.add", "layout.placeholder.move", "layout.placeholder.rotate"] as LayoutToolMode[]).map((tool) => (
                        <button
                          key={tool}
                          type="button"
                          data-testid={`layout-tool-${tool}`}
                          aria-pressed={activeLayoutTool === tool}
                          style={activeLayoutTool === tool ? styles.toolButtonActive : styles.toolButton}
                          onClick={() => setActiveLayoutTool(tool)}
                          disabled={isLayoutIntentSaving}
                        >
                          {layoutToolLabel(tool)}
                        </button>
                      ))}
                    </div>
                    <div data-testid="layout-placeholder-list">
                      <p>当前家具占位：{layoutIntent?.placeholders.length ?? 0}</p>
                      <ul style={styles.issueList}>
                        {layoutIntent?.placeholders.map((placeholder) => (
                          <li key={placeholder.placeholderId}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlaceholderId(placeholder.placeholderId);
                                setSelectedElement(null);
                              }}
                            >
                              {FURNITURE_CATEGORY_LABELS[placeholder.category]} · {placeholder.roomId}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p data-testid="layout-hash">layoutIntentHash={layoutIntentHash?.slice(0, 18) ?? "none"}...</p>
                    <button
                      type="button"
                      data-testid="confirm-layout-intent"
                      style={styles.fullWidthButton}
                      disabled={isLayoutIntentSaving}
                      onClick={handleConfirmLayoutIntent}
                    >
                      确认家具摆放意图
                    </button>
                    {layoutConfirmSuccess !== null ? (
                      <p data-testid="layout-confirm-success">
                        已确认：{layoutConfirmSuccess.layoutIntentContractId} / {layoutConfirmSuccess.layoutIntentHash.slice(0, 18)}...
                        {layoutConfirmSuccess.invalidationSummary.changed ? " 布局意图已更新" : " 布局意图未变化"}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {selectedElement === null ? (
            <div style={styles.panelSection}>
              <p>选择墙、门窗、阳台或房间后编辑属性。</p>
            </div>
          ) : null}
          {selectedWall !== undefined ? (
            <div style={styles.panelSection} data-testid="wall-properties">
              <h3 style={styles.sectionTitle}>墙体</h3>
              <p>{selectedWall.wallId}</p>
              <label style={styles.label}>
                长度（cm）
                <input
                  aria-label="墙体长度（cm）"
                  value={lengthInputCm}
                  onChange={(event) => setLengthInputCm(event.target.value)}
                  style={styles.input}
                />
              </label>
              {isAdvancedSettingsOpen ? (
                <label style={styles.label} data-testid="wall-thickness-control">
                  Wall thickness (cm)
                  <input
                    aria-label="Wall thickness cm"
                    value={wallThicknessInputCm}
                    onChange={(event) => setWallThicknessInputCm(event.target.value)}
                    style={styles.input}
                  />
                </label>
              ) : null}
              <div style={styles.row}>
                <button type="button" onClick={handleWallLengthSubmit} disabled={isSaving}>应用长度</button>
                {isAdvancedSettingsOpen ? (
                  <button type="button" onClick={handleWallThicknessSubmit} disabled={isSaving}>Apply thickness</button>
                ) : null}
                <button type="button" onClick={handleDeleteSelected} disabled={isSaving}>删除墙</button>
              </div>
              <div style={styles.row}>
                <button type="button" onClick={addDoorToSelectedWall} disabled={isSaving}>添加门</button>
                <button type="button" onClick={addWindowToSelectedWall} disabled={isSaving}>添加窗</button>
              </div>
            </div>
          ) : null}
          {selectedOpening?.type === "door" ? (
            <div style={styles.panelSection} data-testid="door-properties">
              <h3 style={styles.sectionTitle}>门</h3>
              <label style={styles.label}>
                开启方向
                <select aria-label="门开启方向" value={selectedOpening.swing} onChange={handleDoorSwingChange} style={styles.input}>
                  <option value="left_in">left_in</option>
                  <option value="right_in">right_in</option>
                  <option value="left_out">left_out</option>
                  <option value="right_out">right_out</option>
                </select>
              </label>
              {isAdvancedSettingsOpen ? (
                <div data-testid="door-dimensions-control" style={styles.compactGrid}>
                  <label style={styles.label}>
                    Door width (cm)
                    <input
                      aria-label="Door width cm"
                      value={doorWidthInputCm}
                      onChange={(event) => setDoorWidthInputCm(event.target.value)}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.label}>
                    Door height (cm)
                    <input
                      aria-label="Door height cm"
                      value={doorHeightInputCm}
                      onChange={(event) => setDoorHeightInputCm(event.target.value)}
                      style={styles.input}
                    />
                  </label>
                  <button type="button" onClick={handleDoorDimensionsSubmit} disabled={isSaving}>
                    Apply door dimensions
                  </button>
                </div>
              ) : null}
              <button type="button" onClick={handleDeleteSelected} disabled={isSaving}>删除门</button>
            </div>
          ) : null}
          {selectedOpening?.type === "window" ? (
            <div style={styles.panelSection} data-testid="window-properties">
              <h3 style={styles.sectionTitle}>窗</h3>
              <label style={styles.label}>
                窗类型
                <select aria-label="窗类型" value={selectedOpening.windowKind} onChange={handleWindowKindChange} style={styles.input}>
                  <option value="standard">standard</option>
                  <option value="bay">bay</option>
                  <option value="floor_to_ceiling">floor_to_ceiling</option>
                </select>
              </label>
              <button type="button" onClick={handleDeleteSelected} disabled={isSaving}>删除窗</button>
            </div>
          ) : null}
          {selectedRoom?.roomType === "balcony" ? (
            <div style={styles.panelSection} data-testid="balcony-properties">
              <h3 style={styles.sectionTitle}>阳台</h3>
              <label style={styles.label}>
                封闭状态
                <select aria-label="阳台封闭状态" value={selectedRoom.balconyMeta.enclosureType} onChange={handleBalconyTypeChange} style={styles.input}>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
              </label>
              <button type="button" onClick={handleDeleteSelected} disabled={isSaving}>删除阳台</button>
            </div>
          ) : null}
          {selectedRoom !== undefined && selectedRoom.roomType !== "balcony" ? (
            <div style={styles.panelSection} data-testid="room-properties">
              <h3 style={styles.sectionTitle}>房间</h3>
              <label style={styles.label}>
                房间类型
                <select aria-label="房间类型" value={selectedRoom.roomType} onChange={handleRoomTypeChange} style={styles.input}>
                  {ROOM_TYPES.map((roomType) => (
                    <option key={roomType} value={roomType} disabled={roomType === "balcony"}>
                      {roomType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          {selectedPlaceholder !== undefined ? (
            <div style={styles.panelSection} data-testid="placeholder-properties">
              <h3 style={styles.sectionTitle}>家具占位</h3>
              <p>{selectedPlaceholder.placeholderId}</p>
              <p style={styles.helpText}>显示尺寸只是摆放意图，不代表最终商品尺寸。</p>
              <label style={styles.label}>
                家具类型
                <select aria-label="占位家具类型" value={selectedPlaceholder.category} onChange={handlePlaceholderCategoryChange} style={styles.input}>
                  {FURNITURE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {FURNITURE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>
              <div style={styles.compactGrid}>
                <label style={styles.label}>
                  显示宽度 cm
                  <input
                    aria-label="占位显示宽度 cm"
                    value={placeholderWidthCm}
                    onChange={(event) => setPlaceholderWidthCm(event.target.value)}
                    style={styles.input}
                  />
                </label>
                <label style={styles.label}>
                  显示深度 cm
                  <input
                    aria-label="占位显示深度 cm"
                    value={placeholderDepthCm}
                    onChange={(event) => setPlaceholderDepthCm(event.target.value)}
                    style={styles.input}
                  />
                </label>
                <button type="button" onClick={handlePlaceholderDisplaySizeSubmit} disabled={isLayoutIntentSaving}>
                  应用显示尺寸
                </button>
              </div>
              <label style={styles.label}>
                旋转角度
                <input
                  aria-label="占位旋转角度"
                  value={placeholderRotationDeg}
                  onChange={(event) => setPlaceholderRotationDeg(event.target.value)}
                  style={styles.input}
                />
              </label>
              <div style={styles.row}>
                <button type="button" onClick={() => void rotateSelectedPlaceholder(-15)} disabled={isLayoutIntentSaving}>-15°</button>
                <button type="button" onClick={() => void rotateSelectedPlaceholder(15)} disabled={isLayoutIntentSaving}>+15°</button>
                <button type="button" onClick={handlePlaceholderRotationSubmit} disabled={isLayoutIntentSaving}>应用角度</button>
              </div>
              <button type="button" onClick={handleDeleteSelectedPlaceholder} disabled={isLayoutIntentSaving}>
                删除家具占位
              </button>
            </div>
          ) : null}
          <ValidationPanel validationState={validationState} />
          <LayoutValidationPanel validationState={layoutIntentValidation} />
          {showDebugLink ? (
            <div style={styles.panelSection} data-testid="p1-dev-debug-panel">
              <h3 style={styles.sectionTitle}>Debug state</h3>
              <p>advanced={isAdvancedSettingsOpen ? "open" : "closed"}</p>
              <p>floorHeightMm={currentDraft?.globalParams.floorHeightMm ?? "unset"}</p>
              <p>selected={selectedElement === null ? "none" : `${selectedElement.type}:${selectedElement.id}`}</p>
              <p>selectedPlaceholder={selectedPlaceholderId ?? "none"}</p>
              <p>reentry={reentryState === null ? "no" : reentryState.activeCanonicalRevisionId}</p>
              <p>lastConfirm={confirmSuccess?.canonicalRevisionId ?? "none"}</p>
              <p>invalidation={confirmSuccess?.invalidationSummary.changed === true ? "changed" : confirmSuccess === null ? "none" : "unchanged"}</p>
              <p>layoutIntentRevisionId={layoutIntentRevisionId ?? "none"}</p>
              <p>layoutIntentHash={layoutIntentHash ?? "none"}</p>
              <p>layoutIntentContractId={layoutIntentContractId ?? "none"}</p>
              <p>aiAutofillEnabled={aiAutofillEnabled ? "true" : "false"}</p>
              <p>placeholderCount={layoutIntent?.placeholders.length ?? 0}</p>
              <p>layoutValidation={layoutIntentValidation?.status ?? "not_loaded"}</p>
              <p>geometryHash={layoutIntent?.geometryHash ?? confirmSuccess?.geometryHash ?? reentryState?.previousGeometryHash ?? "none"}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function renderRoom(
  room: DraftRoom,
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement) => void
) {
  const center = room.labelPosition ?? roomCentroid(room);
  const selected = selectedElement?.id === room.roomId;
  return (
    <g key={room.roomId}>
      <polygon
        points={room.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={room.roomType === "balcony" ? "#dbeafe" : "#ffffff"}
        stroke={selected ? "#2563eb" : "#d6d3ca"}
        strokeWidth={selected ? 32 : 16}
        opacity={room.roomType === "balcony" ? 0.55 : 0.72}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedElement({ type: room.roomType === "balcony" ? "balcony" : "room", id: room.roomId });
        }}
      />
      <text
        x={center.x}
        y={center.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={180}
        fill="#334155"
        pointerEvents="none"
        data-testid={`room-label-${room.roomId}`}
      >
        {room.roomType}
      </text>
    </g>
  );
}

function renderBalcony(
  room: DraftRoom,
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement, event: PointerEvent<SVGPolygonElement>) => void
) {
  if (room.roomType !== "balcony") {
    return null;
  }
  const selected = selectedElement?.id === room.roomId;
  return (
    <polygon
      key={`balcony-${room.roomId}`}
      data-testid={`balcony-${room.roomId}`}
      points={room.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
      fill="#bfdbfe"
      stroke={selected ? "#1d4ed8" : "#60a5fa"}
      strokeDasharray={room.balconyMeta.enclosureType === "open" ? "120 80" : undefined}
      strokeWidth={selected ? 42 : 28}
      opacity={0.7}
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelectedElement({ type: "balcony", id: room.roomId }, event);
      }}
    />
  );
}

function renderWall(
  wall: DraftWallSegment,
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement, event: PointerEvent<SVGLineElement>) => void
) {
  const selected = selectedElement?.type === "wall" && selectedElement.id === wall.wallId;
  const center = pointOnWallAt(wall, 0.5);
  return (
    <g key={wall.wallId}>
      <line
        data-testid={`wall-${wall.wallId}`}
        x1={wall.start.x}
        y1={wall.start.y}
        x2={wall.end.x}
        y2={wall.end.y}
        stroke={selected ? "#2563eb" : "#111827"}
        strokeWidth={Math.max(wall.thicknessMm, selected ? 260 : 180)}
        strokeLinecap="round"
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedElement({ type: "wall", id: wall.wallId }, event);
        }}
      />
      <text x={center.x} y={center.y - 160} textAnchor="middle" fontSize={130} fill="#475569" pointerEvents="none">
        {formatMmAsCm(computeSegmentLengthMm(wall))}cm
      </text>
    </g>
  );
}

function renderDoor(
  opening: DraftDoorOpening,
  walls: DraftWallSegment[],
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement, event: PointerEvent<SVGGElement>) => void
) {
  const wall = walls.find((candidate) => candidate.wallId === opening.wallId);
  if (wall === undefined) {
    return null;
  }
  const point = pointOnWallAt(wall, opening.positionOnWall);
  const selected = selectedElement?.type === "door" && selectedElement.id === opening.openingId;
  return (
    <g
      key={opening.openingId}
      data-testid={`door-${opening.openingId}`}
      data-width-mm={opening.widthMm}
      data-height-mm={opening.heightMm}
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelectedElement({ type: "door", id: opening.openingId }, event);
      }}
    >
      <circle cx={point.x} cy={point.y} r={150} fill={selected ? "#f97316" : "#fb923c"} stroke="#ffffff" strokeWidth={28} />
      <path d={`M ${point.x} ${point.y} l ${Math.max(220, opening.widthMm / 2)} 0`} stroke="#7c2d12" strokeWidth={34} strokeLinecap="round" />
    </g>
  );
}

function renderWindow(
  opening: DraftWindowOpening,
  walls: DraftWallSegment[],
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement, event: PointerEvent<SVGGElement>) => void
) {
  const wall = walls.find((candidate) => candidate.wallId === opening.wallId);
  if (wall === undefined) {
    return null;
  }
  const point = pointOnWallAt(wall, opening.positionOnWall);
  const selected = selectedElement?.type === "window" && selectedElement.id === opening.openingId;
  const windowColor = opening.windowKind === "bay" ? "#0f766e" : opening.windowKind === "floor_to_ceiling" ? "#7c3aed" : "#0284c7";
  return (
    <g
      key={opening.openingId}
      data-testid={`window-${opening.openingId}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelectedElement({ type: "window", id: opening.openingId }, event);
      }}
    >
      <rect
        x={point.x - 210}
        y={point.y - 70}
        width={420}
        height={140}
        fill="#ffffff"
        stroke={selected ? "#2563eb" : windowColor}
        strokeWidth={44}
      />
      {opening.windowKind === "bay" ? (
        <path
          data-testid={`bay-projection-${opening.openingId}`}
          d={`M ${point.x - 210} ${point.y - 70} L ${point.x} ${point.y - (opening.projectionDepthMm ?? 500)} L ${point.x + 210} ${point.y - 70}`}
          fill="none"
          stroke="#0f766e"
          strokeWidth={34}
        />
      ) : null}
      {opening.windowKind === "floor_to_ceiling" ? (
        <line x1={point.x - 230} y1={point.y + 120} x2={point.x + 230} y2={point.y + 120} stroke="#7c3aed" strokeWidth={28} />
      ) : null}
    </g>
  );
}

function renderFurniturePlaceholder(
  placeholder: FurniturePlaceholder,
  selectedPlaceholderId: string | null,
  activeLayoutTool: LayoutToolMode,
  selectPlaceholder: (placeholderId: string) => void,
  setPlaceholderDragState: (state: PlaceholderDragState | null) => void
) {
  const selected = selectedPlaceholderId === placeholder.placeholderId;
  const width = placeholder.displaySizeMm.width;
  const depth = placeholder.displaySizeMm.depth;
  return (
    <g
      key={placeholder.placeholderId}
      data-testid={`furniture-placeholder-${placeholder.placeholderId}`}
      transform={`translate(${placeholder.center.x} ${placeholder.center.y}) rotate(${placeholder.rotationDeg})`}
      onPointerDown={(event) => {
        event.stopPropagation();
        selectPlaceholder(placeholder.placeholderId);
        if (activeLayoutTool === "layout.placeholder.move") {
          setPlaceholderDragState({ placeholderId: placeholder.placeholderId });
        }
      }}
    >
      <rect
        x={-width / 2}
        y={-depth / 2}
        width={width}
        height={depth}
        rx={60}
        fill="#fef9c3"
        stroke={selected ? "#ca8a04" : "#a16207"}
        strokeWidth={selected ? 46 : 28}
        data-testid={selected ? "selected-placeholder-outline" : undefined}
      />
      <line x1={-width / 2} y1={0} x2={width / 2} y2={0} stroke="#a16207" strokeWidth={16} opacity={0.45} />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={140}
        fill="#713f12"
        pointerEvents="none"
        data-testid={`furniture-placeholder-label-${placeholder.placeholderId}`}
      >
        {FURNITURE_CATEGORY_LABELS[placeholder.category]}
      </text>
    </g>
  );
}

function renderLayoutValidationHighlight(
  issue: LayoutIntentValidationIssue,
  layoutIntent: LayoutIntentRevision | null
) {
  if (layoutIntent === null || issue.placeholderId === undefined) {
    return null;
  }
  const placeholder = layoutIntent.placeholders.find((candidate) => candidate.placeholderId === issue.placeholderId);
  if (placeholder === undefined) {
    return null;
  }
  return (
    <rect
      key={issue.issueId}
      data-testid="invalid-placeholder-highlight"
      x={placeholder.center.x - placeholder.displaySizeMm.width / 2 - 120}
      y={placeholder.center.y - placeholder.displaySizeMm.depth / 2 - 120}
      width={placeholder.displaySizeMm.width + 240}
      height={placeholder.displaySizeMm.depth + 240}
      fill="none"
      stroke="#dc2626"
      strokeWidth={38}
      strokeDasharray="120 80"
      transform={`rotate(${placeholder.rotationDeg} ${placeholder.center.x} ${placeholder.center.y})`}
    />
  );
}

function renderValidationHighlight(issue: DraftValidationIssue, draft: FloorplanDraftRevision | null) {
  if (draft === null) {
    return null;
  }
  if (issue.code === "UNCLOSED_BOUNDARY" || issue.code === "ROOM_BOUNDARY_UNCLOSED") {
    const bbox = computeFloorplanBBox(draft);
    return (
      <rect
        key={issue.issueId}
        data-testid="invalid-boundary-highlight"
        x={bbox.minX - 260}
        y={bbox.minY - 260}
        width={bbox.widthMm + 520}
        height={bbox.heightMm + 520}
        fill="none"
        stroke="#dc2626"
        strokeWidth={40}
        strokeDasharray="140 90"
      />
    );
  }
  if (issue.targetType === "opening" && issue.targetId !== undefined) {
    const opening = draft.openings.find((candidate) => candidate.openingId === issue.targetId);
    const wall = opening === undefined ? undefined : draft.walls.find((candidate) => candidate.wallId === opening.wallId);
    if (opening !== undefined && wall !== undefined) {
      const point = pointOnWallAt(wall, opening.positionOnWall);
      return <circle key={issue.issueId} data-testid="invalid-opening-highlight" cx={point.x} cy={point.y} r={260} fill="none" stroke="#dc2626" strokeWidth={38} />;
    }
  }
  if (issue.targetType === "room" && issue.targetId !== undefined) {
    const room = draft.rooms.find((candidate) => candidate.roomId === issue.targetId);
    if (room !== undefined) {
      return (
        <polygon
          key={issue.issueId}
          data-testid="invalid-balcony-highlight"
          points={room.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#dc2626"
          strokeWidth={42}
          strokeDasharray="120 80"
        />
      );
    }
  }
  return null;
}

function ValidationPanel({ validationState }: { validationState: DraftValidationState | null }) {
  return (
    <div style={styles.panelSection} data-testid="validation-panel">
      <h2 style={styles.panelTitle}>户型校验</h2>
      <p>{validationState?.canConfirm ? "当前可确认" : "需要继续修正"}</p>
      {validationState?.issues.length === 0 ? <p>暂无问题</p> : null}
      <ul style={styles.issueList}>
        {validationState?.issues.map((issue) => (
          <li key={issue.issueId} data-testid={`validation-issue-${issue.code}`}>
            {neutralIssueCopy(issue)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayoutValidationPanel({ validationState }: { validationState: LayoutIntentValidationState | null }) {
  return (
    <div style={styles.panelSection} data-testid="layout-validation-panel">
      <h2 style={styles.panelTitle}>家具摆放意图校验</h2>
      <p>{validationState?.canConfirm ? "当前可确认" : "需要继续调整"}</p>
      {validationState?.issues.length === 0 ? <p>暂无问题</p> : null}
      <ul style={styles.issueList}>
        {validationState?.issues.map((issue) => (
          <li key={issue.issueId} data-testid={`layout-validation-issue-${issue.code}`}>
            {layoutNeutralIssueCopy(issue)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function neutralIssueCopy(issue: DraftValidationIssue): string {
  if (issue.code === "UNCLOSED_BOUNDARY" || issue.code === "ROOM_BOUNDARY_UNCLOSED") {
    return "该区域尚未闭合";
  }
  if (issue.code === "OPENING_ORPHANED") {
    return "该门窗未连接到有效墙体";
  }
  if (issue.code === "BALCONY_DETACHED" || issue.code === "BALCONY_ADJACENCY_MISSING") {
    return "该阳台未连接到主体户型";
  }
  if (issue.code.includes("OUT_OF_RANGE")) {
    return "该数值超出系统可处理范围";
  }
  return issue.message;
}

function layoutNeutralIssueCopy(issue: LayoutIntentValidationIssue): string {
  if (issue.code === "PLACEHOLDER_OUTSIDE_ROOM" || issue.code === "PLACEHOLDER_ROOM_MISSING") {
    return "该家具占位未放置在有效房间内";
  }
  if (issue.code === "PLACEHOLDER_BLOCKS_OPENING") {
    return "该家具占位可能影响门口通行";
  }
  if (issue.code.includes("SIZE") || issue.code.includes("OUT_OF_RANGE")) {
    return "该家具占位尺寸超出系统可处理范围";
  }
  return issue.message;
}

function isDraftNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Draft not found:");
}

function nearestExteriorWall(draft: FloorplanDraftRevision, point: Point2D): DraftWallSegment | undefined {
  return draft.walls
    .filter((wall) => wall.kind === "exterior")
    .map((wall) => ({ wall, distance: distancePointToSegment(point, wall.start, wall.end) }))
    .sort((a, b) => a.distance - b.distance)
    .find((candidate) => candidate.distance <= 800)?.wall;
}

function distancePointToSegment(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function distanceBetween(first: Point2D, second: Point2D): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function defaultWallThickness(draft: FloorplanDraftRevision): number {
  return draft.walls.find((wall) => wall.kind === "interior")?.thicknessMm ?? 120;
}

function shouldRecomputeBoundaries(operations: readonly FloorplanEditOperation[]): boolean {
  return operations.some((operation) =>
    operation.operationType === "wall.add" ||
    operation.operationType === "wall.delete" ||
    operation.operationType === "wall.resize" ||
    operation.operationType === "wall.moveEndpoint" ||
    operation.operationType === "freeWall.draw"
  );
}

function toolLabel(tool: ToolMode): string {
  switch (tool) {
    case "select":
      return "选择";
    case "wall.add":
      return "画墙";
    case "door.add":
      return "加门";
    case "window.add":
      return "加窗";
    case "balcony.add":
      return "画阳台";
    case "freeWall.draw":
      return "Free wall";
  }
}

function layoutToolLabel(tool: LayoutToolMode): string {
  switch (tool) {
    case "layout.select":
      return "选占位";
    case "layout.placeholder.add":
      return "加占位";
    case "layout.placeholder.move":
      return "移动";
    case "layout.placeholder.rotate":
      return "旋转";
  }
}

const styles = {
  shell: {
    minHeight: "100vh",
    background: "#eceae3",
    color: "#111827",
    fontFamily: "Arial, sans-serif"
  },
  centered: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#eceae3",
    color: "#111827",
    fontFamily: "Arial, sans-serif"
  },
  header: {
    height: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    borderBottom: "1px solid #d6d3ca"
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    color: "#64748b"
  },
  title: {
    margin: 0,
    fontSize: 24,
    letterSpacing: 0
  },
  headerActions: {
    display: "flex",
    gap: 12,
    alignItems: "center"
  },
  confirmButton: {
    height: 40,
    padding: "0 16px",
    borderRadius: 6,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff"
  },
  debugLink: {
    color: "#0f766e",
    fontSize: 13
  },
  workspace: {
    height: "calc(100vh - 72px)",
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr) 320px"
  },
  toolbar: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRight: "1px solid #d6d3ca",
    background: "#f7f6f2"
  },
  toolButton: {
    minHeight: 38,
    borderRadius: 6,
    border: "1px solid #d6d3ca",
    background: "#ffffff",
    color: "#111827"
  },
  toolButtonActive: {
    minHeight: 38,
    borderRadius: 6,
    border: "1px solid #0f766e",
    background: "#ccfbf1",
    color: "#134e4a"
  },
  stageWrap: {
    position: "relative",
    overflow: "hidden",
    background: "#dfddd4"
  },
  stage: {
    width: "100%",
    height: "100%",
    display: "block",
    touchAction: "none"
  },
  panel: {
    overflow: "auto",
    borderLeft: "1px solid #d6d3ca",
    background: "#f7f6f2"
  },
  panelSection: {
    padding: 16,
    borderBottom: "1px solid #d6d3ca"
  },
  panelTitle: {
    margin: "0 0 10px",
    fontSize: 16
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: 14
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 13
  },
  input: {
    height: 34,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    padding: "0 8px",
    background: "#ffffff"
  },
  row: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap"
  },
  compactGrid: {
    display: "grid",
    gap: 8,
    marginTop: 10
  },
  fullWidthButton: {
    marginTop: 8,
    width: "100%",
    minHeight: 34
  },
  issueList: {
    margin: 0,
    paddingLeft: 18
  },
  layoutSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #d6d3ca"
  },
  helpText: {
    margin: "6px 0",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.45
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13
  },
  inlineError: {
    color: "#991b1b",
    fontSize: 13
  },
  errorBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 2,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: "8px 10px",
    borderRadius: 6
  },
  successBanner: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 2,
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    padding: "8px 10px",
    borderRadius: 6
  },
  statusBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 1,
    background: "#e0f2fe",
    border: "1px solid #bae6fd",
    color: "#075985",
    padding: "8px 10px",
    borderRadius: 6
  },
  noticeBanner: {
    position: "absolute",
    top: 56,
    left: 12,
    zIndex: 2,
    background: "#fef3c7",
    border: "1px solid #fde68a",
    color: "#92400e",
    padding: "8px 10px",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  inlineButton: {
    border: "1px solid #d97706",
    background: "#ffffff",
    color: "#92400e",
    borderRadius: 4
  }
} satisfies Record<string, CSSProperties>;
