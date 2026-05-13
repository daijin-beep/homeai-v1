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
  P1RoomType,
  Point2D
} from "@homeai/contracts";
import {
  applyPan,
  applyZoom,
  computeFloorplanBBox,
  computeSegmentLengthMm,
  computeViewBoxFromFloorplanBBox,
  constrainToOrthogonal,
  DEFAULT_VIEW_TRANSFORM,
  formatMmAsCm,
  parseCmToMm,
  pointInPolygon,
  pointOnWallAt,
  resizeWallToLengthMm,
  roomCentroid,
  snapPoint,
  svgClientPointToWorldMm,
  type ViewTransform
} from "../_lib/geometry-view.js";
import {
  applyP1Operations,
  confirmP1Draft,
  debugPayloadUrl,
  fetchP1Draft,
  startP1Session,
  validateP1Draft
} from "../_lib/p1-api-client.js";

type ToolMode = "select" | "wall.add" | "door.add" | "window.add" | "balcony.add";

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

type ConfirmSuccess = {
  canonicalRevisionId: string;
  geometryHash: string;
  sceneContractId: string;
  nextStage: string;
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
  const [lengthInputCm, setLengthInputCm] = useState("");
  const [confirmSuccess, setConfirmSuccess] = useState<ConfirmSuccess | null>(null);
  const devHostname = typeof window === "undefined" ? "" : window.location.hostname;
  const showDebugLink = devHostname === "localhost" || devHostname === "127.0.0.1";

  useEffect(() => {
    let cancelled = false;
    async function loadDraft() {
      setIsLoading(true);
      setApiError(null);
      try {
        const session = await startP1Session(homeId);
        if (cancelled) {
          return;
        }
        setDraftRevisionId(session.draftRevisionId);
        const response = await fetchP1Draft(session.draftRevisionId);
        if (cancelled) {
          return;
        }
        setCurrentDraft(response.draft);
        setValidationState(response.validation);
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : "无法加载户型草稿");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void loadDraft();
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

  useEffect(() => {
    setLengthInputCm(selectedWall === undefined ? "" : formatMmAsCm(computeSegmentLengthMm(selectedWall)));
  }, [selectedWall]);

  async function submitOperations(operations: FloorplanEditOperation[]) {
    if (draftRevisionId === null) {
      return;
    }
    setIsSaving(true);
    setApiError(null);
    try {
      const response = await applyP1Operations(draftRevisionId, operations);
      setCurrentDraft(response.draft);
      const validation = await validateP1Draft(draftRevisionId);
      setValidationState(validation);
      setIsDirty(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "操作未保存，已保留服务器草稿");
    } finally {
      setIsSaving(false);
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

  function handleSvgPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (currentDraft === null) {
      return;
    }
    const point = canvasPointFromEvent(event);
    if (point === null) {
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
        thicknessMm: defaultWallThickness(currentDraft),
        kind: "interior",
        source: "user_created"
      };
      setPendingWallStart(null);
      void submitOperations([createOperation("wall.add", "wall", { payload: { wall } })]);
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
    if (dragState === null || currentDraft === null) {
      return;
    }
    event.preventDefault();
  }

  function handleSvgPointerUp(event: PointerEvent<SVGSVGElement>) {
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

  function canvasPointFromEvent(event: PointerEvent<SVGSVGElement>): Point2D | null {
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

  async function addDoorToWall(wall: DraftWallSegment) {
    const opening: DraftDoorOpening = {
      openingId: `door-user-${Date.now()}`,
      type: "door",
      wallId: wall.wallId,
      positionOnWall: 0.5,
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

  async function addWindowToWall(wall: DraftWallSegment) {
    const opening: DraftWindowOpening = {
      openingId: `window-user-${Date.now()}`,
      type: "window",
      windowKind: "standard",
      wallId: wall.wallId,
      positionOnWall: 0.5,
      widthMm: 1200,
      heightMm: 1300,
      sillHeightMm: 900,
      source: "user_created"
    };
    await submitOperations([createOperation("window.add", "opening", { payload: { opening } })]);
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

  async function handleDeleteSelected() {
    if (selectedElement === null) {
      return;
    }
    if (selectedElement.type === "wall") {
      await submitOperations([createOperation("wall.delete", "wall", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "door") {
      await submitOperations([createOperation("door.delete", "opening", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "window") {
      await submitOperations([createOperation("window.delete", "opening", { targetId: selectedElement.id })]);
    }
    if (selectedElement.type === "balcony") {
      await submitOperations([createOperation("balcony.delete", "room", { targetId: selectedElement.id })]);
    }
    setSelectedElement(null);
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
    await submitOperations([
      createOperation("window.type.change", "opening", {
        targetId: selectedOpening.openingId,
        payload: { windowKind: event.target.value }
      })
    ]);
    if (currentDraft !== null && beforeWalls !== JSON.stringify(currentDraft.walls)) {
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
        nextStage: result.nextStage
      };
      setConfirmSuccess(success);
      setIsDirty(false);
      window.history.replaceState(null, "", `/p1/${homeId}?nextStage=${result.nextStage}`);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "确认户型失败");
    } finally {
      setIsSaving(false);
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
          {confirmSuccess !== null ? (
            <div data-testid="confirm-success" style={styles.successBanner}>
              已确认：{confirmSuccess.geometryHash.slice(0, 18)}... / {confirmSuccess.sceneContractId}
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
              {currentDraft?.rooms.filter((room) => room.roomType === "balcony").map((room) => renderBalcony(room, selectedElement, setSelectedElement))}
            </g>
            <g data-testid="wall-layer">
              {currentDraft?.walls.map((wall) => renderWall(wall, selectedElement, (selection) => {
                if (activeTool === "door.add") {
                  void addDoorToWall(wall);
                  return;
                }
                if (activeTool === "window.add") {
                  void addWindowToWall(wall);
                  return;
                }
                setSelectedElement(selection);
              }))}
            </g>
            <g data-testid="door-layer">
              {currentDraft?.openings.filter((opening): opening is DraftDoorOpening => opening.type === "door").map((opening) => renderDoor(opening, currentDraft.walls, selectedElement, setSelectedElement))}
            </g>
            <g data-testid="window-layer">
              {currentDraft?.openings.filter((opening): opening is DraftWindowOpening => opening.type === "window").map((opening) => renderWindow(opening, currentDraft.walls, selectedElement, setSelectedElement))}
            </g>
            <g data-testid="validation-highlight-layer">
              {validationState?.issues.map((issue) => renderValidationHighlight(issue, currentDraft))}
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
          </div>
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
              <div style={styles.row}>
                <button type="button" onClick={handleWallLengthSubmit} disabled={isSaving}>应用长度</button>
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
          <ValidationPanel validationState={validationState} />
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
  setSelectedElement: (selection: SelectedElement) => void
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
        setSelectedElement({ type: "balcony", id: room.roomId });
      }}
    />
  );
}

function renderWall(
  wall: DraftWallSegment,
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement) => void
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
          setSelectedElement({ type: "wall", id: wall.wallId });
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
  setSelectedElement: (selection: SelectedElement) => void
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
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelectedElement({ type: "door", id: opening.openingId });
      }}
    >
      <circle cx={point.x} cy={point.y} r={150} fill={selected ? "#f97316" : "#fb923c"} stroke="#ffffff" strokeWidth={28} />
      <path d={`M ${point.x} ${point.y} l 280 0`} stroke="#7c2d12" strokeWidth={34} strokeLinecap="round" />
    </g>
  );
}

function renderWindow(
  opening: DraftWindowOpening,
  walls: DraftWallSegment[],
  selectedElement: SelectedElement,
  setSelectedElement: (selection: SelectedElement) => void
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
        setSelectedElement({ type: "window", id: opening.openingId });
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
      <h2 style={styles.panelTitle}>校验</h2>
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

function defaultWallThickness(draft: FloorplanDraftRevision): number {
  return draft.walls.find((wall) => wall.kind === "interior")?.thicknessMm ?? 120;
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
    marginTop: 10
  },
  issueList: {
    margin: 0,
    paddingLeft: 18
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
  }
} satisfies Record<string, CSSProperties>;
