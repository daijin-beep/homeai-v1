// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DraftValidationState,
  FloorplanDraftRevision,
  FloorplanEditOperation,
  FurnitureCategory,
  FurniturePlaceholder,
  LayoutIntentOperation,
  LayoutIntentRevision,
  LayoutIntentValidationState
} from "@homeai/contracts";
import { applyFloorplanOperations, buildDraftValidationState } from "@homeai/floorplan-parser";
import { P1FloorplanEditor } from "../../apps/web/app/p1/_components/P1FloorplanEditor.js";
import {
  homeWithBalcony,
  homeWithBayWindow,
  invalidUnclosedRoom,
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
  operations: FloorplanEditOperation[];
};

type LayoutFetchCall = {
  url: string;
  init?: RequestInit;
  operations: LayoutIntentOperation[];
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("P1 Canvas normal mode UI", () => {
  it("loads a draft from API and renders walls, doors, windows, balconies, labels, and validation", async () => {
    mockP1Fetch(homeWithBalcony);
    render(<P1FloorplanEditor homeId={homeWithBalcony.homeId} />);

    expect(await screen.findByTestId("p1-canvas-stage")).toBeInTheDocument();
    expect(screen.getByTestId("wall-wall-bal-main-north")).toBeInTheDocument();
    expect(screen.getByTestId("window-window-balcony-connection")).toBeInTheDocument();
    expect(screen.getByTestId("balcony-room-bal-balcony")).toBeInTheDocument();
    expect(screen.getByTestId("room-label-room-bal-living")).toHaveTextContent("living_room");
    expect(screen.getByTestId("validation-panel")).toHaveTextContent("当前可确认");
  });

  it("changes active tools and exposes non-destructive API errors", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, { failNextPatch: true });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("tool-wall.add"));
    expect(screen.getByTestId("active-tool")).toHaveTextContent("画墙");
    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.click(screen.getByText("删除墙"));

    expect(await screen.findByRole("alert")).toHaveTextContent("patch failed");
    expect(scenario.calls.at(-1)?.operations[0]?.operationType).toBe("wall.delete");
  });

  it("hardens selection, failed saves, keyboard shortcuts, and wall boundary recompute", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, { failNextPatch: true });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    expect(screen.getByTestId("wall-properties")).toHaveTextContent("wall-simple-east");
    fireEvent.click(screen.getByText("删除墙"));
    expect(await screen.findByRole("alert")).toHaveTextContent("patch failed");
    expect(screen.getByTestId("wall-wall-simple-east")).toBeInTheDocument();
    expect(screen.getByTestId("wall-properties")).toHaveTextContent("wall-simple-east");

    fireEvent.change(screen.getByLabelText("墙体长度（cm）"), { target: { value: "450" } });
    fireEvent.click(screen.getByText("应用长度"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.resize"));
    expect(screen.getByTestId("wall-properties")).toHaveTextContent("wall-simple-east");
    expect(scenario.recomputeCalls).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("wall-properties")).not.toBeInTheDocument());
    const callCount = scenario.calls.length;
    fireEvent.keyDown(window, { key: "Delete" });
    expect(scenario.calls).toHaveLength(callCount);

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.delete"));
    expect(screen.queryByTestId("wall-properties")).not.toBeInTheDocument();
  });

  it("wall add, delete, resize, numeric cm input, endpoint drag, and invalid boundary display use API operations", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("tool-wall.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.add"));

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.change(screen.getByLabelText("墙体长度（cm）"), { target: { value: "450" } });
    fireEvent.click(screen.getByText("应用长度"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.resize"));
    expect(lastOperation(scenario)?.payload).toMatchObject({ end: { x: 5000, y: 4500 } });

    fireEvent.pointerDown(screen.getByTestId("endpoint-end"));
    fireEvent.pointerUp(screen.getByTestId("p1-canvas-stage"), { clientX: 100, clientY: 100 });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.moveEndpoint"));

    fireEvent.click(screen.getByText("删除墙"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.delete"));
    expect((await screen.findAllByTestId("invalid-boundary-highlight")).length).toBeGreaterThan(0);
  });

  it("door add, delete, direction change, render, and invalid door issue display work through API", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("door-door-simple-entry");

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.click(screen.getByText("添加门"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("door.add"));

    fireEvent.pointerDown(screen.getByTestId("door-door-simple-entry"));
    fireEvent.change(screen.getByLabelText("门开启方向"), { target: { value: "right_out" } });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("door.direction.change"));

    fireEvent.click(screen.getByText("删除门"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("door.delete"));

    scenario.validationOverride = invalidValidation("OPENING_ORPHANED", "Opening must be attached to an existing wall.", "opening", "door-missing");
    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.click(screen.getByText("添加门"));
    expect(await screen.findByTestId("validation-issue-OPENING_ORPHANED")).toHaveTextContent("该门窗未连接到有效墙体");
  });

  it("window add, delete, bay projection, bay topology preservation, and floor-to-ceiling switch work through API", async () => {
    const scenario = mockP1Fetch(homeWithBayWindow);
    const initialWalls = JSON.stringify(homeWithBayWindow.walls);
    render(<P1FloorplanEditor homeId={homeWithBayWindow.homeId} />);
    await screen.findByTestId("bay-projection-window-bay-1");

    fireEvent.pointerDown(screen.getByTestId("wall-wall-bay-east"));
    fireEvent.click(screen.getByText("添加窗"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("window.add"));

    fireEvent.pointerDown(screen.getByTestId("window-window-bay-1"));
    fireEvent.change(screen.getByLabelText("窗类型"), { target: { value: "standard" } });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("window.type.change"));

    fireEvent.change(screen.getByLabelText("窗类型"), { target: { value: "bay" } });
    await waitFor(() => expect(lastOperation(scenario)?.payload).toMatchObject({ windowKind: "bay" }));
    expect(JSON.stringify(scenario.draft.walls)).toBe(initialWalls);

    fireEvent.change(screen.getByLabelText("窗类型"), { target: { value: "floor_to_ceiling" } });
    await waitFor(() => expect(lastOperation(scenario)?.payload).toMatchObject({ windowKind: "floor_to_ceiling" }));

    fireEvent.click(screen.getByText("删除窗"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("window.delete"));
  });

  it("balcony drawing, detached validation, open/closed toggle, deletion, and labels work through API", async () => {
    const scenario = mockP1Fetch(homeWithBalcony);
    mockSvgRect();
    render(<P1FloorplanEditor homeId={homeWithBalcony.homeId} />);
    await screen.findByTestId("balcony-room-bal-balcony");

    fireEvent.click(screen.getByTestId("tool-balcony.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 125, clientY: 115 });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("balcony.add"));
    expect(lastOperation(scenario)?.payload).toMatchObject({ room: { roomType: "balcony" } });

    fireEvent.pointerDown(screen.getByTestId("balcony-room-bal-balcony"));
    fireEvent.change(screen.getByLabelText("阳台封闭状态"), { target: { value: "open" } });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("balcony.type.change"));

    fireEvent.click(screen.getByText("删除阳台"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("balcony.delete"));

    scenario.validationOverride = invalidValidation("BALCONY_DETACHED", "Balcony must connect to an exterior wall.", "room", "room-bal-balcony");
    fireEvent.click(screen.getByTestId("tool-balcony.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 500, clientY: 400 });
    expect(await screen.findByTestId("validation-issue-BALCONY_DETACHED")).toHaveTextContent("该阳台未连接到主体户型");
    expect(screen.getByTestId("room-label-room-bal-living")).toBeInTheDocument();
  });

  it("room selection and type editing update labels without changing geometry", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    const beforeRooms = JSON.stringify(simpleRectangleHome.rooms.map((room) => room.polygon));
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("room-label-room-simple-living");

    fireEvent.pointerDown(screen.getByTestId("room-label-room-simple-living").previousSibling as Element);
    fireEvent.change(screen.getByLabelText("房间类型"), { target: { value: "study" } });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("room.type.change"));

    expect(screen.getByTestId("room-label-room-simple-living")).toHaveTextContent("study");
    expect(JSON.stringify(scenario.draft.rooms.map((room) => room.polygon))).toBe(beforeRooms);
  });

  it("invalid confirm shows issues and valid confirm returns geometryHash plus sceneContractId", async () => {
    const invalidScenario = mockP1Fetch(invalidUnclosedRoom, {
      validation: invalidValidation("UNCLOSED_BOUNDARY", "Room boundary is missing a closing wall.", "draft")
    });
    render(<P1FloorplanEditor homeId={invalidUnclosedRoom.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    fireEvent.click(screen.getByText("确认户型，开始设计"));
    expect(await screen.findByTestId("validation-issue-UNCLOSED_BOUNDARY")).toHaveTextContent("该区域尚未闭合");
    expect(invalidScenario.confirmCalls).toBe(0);
    cleanup();

    const validScenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    fireEvent.click(screen.getByText("确认户型，开始设计"));

    expect(await screen.findByTestId("confirm-success")).toHaveTextContent("scene-test");
    expect(validScenario.confirmCalls).toBe(1);
  });

  it("advanced settings toggle is API-backed, hidden by default, and resets after remount", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    const { unmount } = render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    expect(screen.getByTestId("advanced-state")).toHaveTextContent("closed");
    expect(screen.queryByTestId("advanced-settings-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("advanced.settings.toggle"));
    expect(screen.getByTestId("advanced-settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("tool-freeWall.draw")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(screen.queryByTestId("advanced-settings-panel")).not.toBeInTheDocument());

    unmount();
    mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    expect(screen.getByTestId("advanced-state")).toHaveTextContent("closed");
  });

  it("wall thickness and floor height advanced controls send cm-converted operations without geometry warnings", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("advanced.settings.toggle"));
    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    expect(await screen.findByTestId("wall-thickness-control")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Wall thickness cm"), { target: { value: "24" } });
    fireEvent.click(screen.getByText("Apply thickness"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.thickness.change"));
    expect(lastOperation(scenario)?.payload).toMatchObject({ thicknessMm: 240 });

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(screen.queryByTestId("advanced-settings-panel")).not.toBeInTheDocument());
    expect(screen.queryByTestId("wall-thickness-control")).not.toBeInTheDocument();
    expect(scenario.draft.walls.find((wall) => wall.wallId === "wall-simple-east")?.thicknessMm).toBe(240);

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(screen.getByTestId("advanced-settings-panel")).toBeInTheDocument());
    const geometryBeforeFloorHeight = JSON.stringify({
      walls: scenario.draft.walls,
      rooms: scenario.draft.rooms,
      openings: scenario.draft.openings
    });
    fireEvent.change(screen.getByLabelText("Floor height cm"), { target: { value: "310" } });
    fireEvent.click(screen.getByText("Apply floor height"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("floorHeight.change"));
    expect(lastOperation(scenario)?.payload).toMatchObject({ floorHeightMm: 3100 });
    expect(scenario.draft.globalParams.floorHeightMm).toBe(3100);
    expect(JSON.stringify({
      walls: scenario.draft.walls,
      rooms: scenario.draft.rooms,
      openings: scenario.draft.openings
    })).toBe(geometryBeforeFloorHeight);
  });

  it("advanced validation issues use neutral copy for out-of-range values", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    scenario.validationOverride = invalidValidation("WALL_THICKNESS_OUT_OF_RANGE", "Wall thickness is outside range.", "wall", "wall-simple-east");
    fireEvent.change(screen.getByLabelText("Wall thickness cm"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("Apply thickness"));

    expect(await screen.findByTestId("validation-issue-WALL_THICKNESS_OUT_OF_RANGE")).toHaveTextContent("该数值超出系统可处理范围");
    scenario.validationOverride = invalidValidation("FLOOR_HEIGHT_OUT_OF_RANGE", "Floor height is outside range.", "global_params");
    fireEvent.change(screen.getByLabelText("Floor height cm"), { target: { value: "100" } });
    fireEvent.click(screen.getByText("Apply floor height"));
    expect(await screen.findByTestId("validation-issue-FLOOR_HEIGHT_OUT_OF_RANGE")).toHaveTextContent("该数值超出系统可处理范围");

    scenario.validationOverride = undefined;
    fireEvent.pointerDown(screen.getByTestId("door-door-simple-entry"));
    expect(await screen.findByTestId("door-dimensions-control")).toBeInTheDocument();
    scenario.validationOverride = invalidValidation("DOOR_WIDTH_OUT_OF_RANGE", "Door width is outside range.", "opening", "door-simple-entry");
    fireEvent.change(screen.getByLabelText("Door width cm"), { target: { value: "300" } });
    fireEvent.click(screen.getByText("Apply door dimensions"));
    expect(await screen.findByTestId("validation-issue-DOOR_WIDTH_OUT_OF_RANGE")).toHaveTextContent("该数值超出系统可处理范围");
    expect(screen.queryByText("不符合规范")).not.toBeInTheDocument();
    expect(screen.queryByText("存在施工风险")).not.toBeInTheDocument();
  });

  it("free wall drawing supports non-axis, polyline, and arc-like segment-only operations", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    mockSvgRect();
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    fireEvent.click(screen.getByTestId("tool-freeWall.draw"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 120, clientY: 140 });
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 540, clientY: 310 });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("freeWall.draw"));
    const freePayload = lastOperation(scenario)?.payload as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(freePayload.start.x).not.toBe(freePayload.end.x);
    expect(freePayload.start.y).not.toBe(freePayload.end.y);

    fireEvent.click(screen.getByText("Add polyline wall"));
    await waitFor(() => expect(scenario.calls.at(-1)?.operations).toHaveLength(2));
    expect(scenario.calls.at(-1)?.operations.every((operation) => operation.operationType === "freeWall.draw")).toBe(true);

    fireEvent.click(screen.getByText("Add arc-like wall"));
    await waitFor(() => expect(scenario.calls.at(-1)?.operations).toHaveLength(2));
    expect(JSON.stringify(scenario.calls.at(-1)?.operations)).not.toContain("curve");
    expect(JSON.stringify(scenario.calls.at(-1)?.operations)).not.toContain("Bezier");
    expect(JSON.stringify(scenario.calls.at(-1)?.operations)).not.toContain("NURBS");

    fireEvent.click(screen.getByTestId("tool-wall.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 100, clientY: 100 });
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 500, clientY: 240 });
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.add"));
    const normalWall = (lastOperation(scenario)?.payload as { wall: { start: { x: number; y: number }; end: { x: number; y: number } } }).wall;
    expect(normalWall.start.x === normalWall.end.x || normalWall.start.y === normalWall.end.y).toBe(true);
  });

  it("door dimensions are advanced-only, update through API, and change rendered door attributes", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("door-door-simple-entry");

    fireEvent.pointerDown(screen.getByTestId("door-door-simple-entry"));
    expect(screen.queryByTestId("door-dimensions-control")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("advanced.settings.toggle"));
    expect(await screen.findByTestId("door-dimensions-control")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Door width cm"), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText("Door height cm"), { target: { value: "220" } });
    fireEvent.click(screen.getByText("Apply door dimensions"));

    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("door.dimension.change"));
    expect(lastOperation(scenario)?.payload).toMatchObject({ widthMm: 950, heightMm: 2200 });
    expect(screen.getByTestId("door-door-simple-entry")).toHaveAttribute("data-width-mm", "950");
  });

  it("re-entry shows status, first-edit notice once, and non-blocking operation still saves", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"b".repeat(64)}`
      }
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    expect(screen.getByTestId("reentry-status")).toHaveTextContent("canonical-existing");
    expect(screen.getByTestId("advanced-state")).toHaveTextContent("closed");

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.click(screen.getByText("删除墙"));
    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("wall.delete"));
    expect(await screen.findByTestId("reentry-edit-notice")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("dismiss-reentry-notice"));
    expect(screen.queryByTestId("reentry-edit-notice")).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-north"));
    fireEvent.click(screen.getByText("删除墙"));
    await waitFor(() => expect(lastOperation(scenario)?.targetId).toBe("wall-simple-north"));
    expect(screen.queryByTestId("reentry-edit-notice")).not.toBeInTheDocument();
  });

  it("recovers from stale in-memory draft sessions after dev-server reload", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      failNextPatch: true,
      failNextPatchMessage: "Draft not found: draft-session-demo-home-stale"
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    expect(scenario.sessionCalls).toBe(1);

    fireEvent.pointerDown(screen.getByTestId("wall-wall-simple-east"));
    fireEvent.click(screen.getByText("删除墙"));

    expect(await screen.findByRole("alert")).toHaveTextContent("草稿会话已刷新，请重试刚才的操作。");
    expect(scenario.sessionCalls).toBe(2);
    expect(screen.getByTestId("wall-wall-simple-east")).toBeInTheDocument();
  });

  it("confirm displays unchanged and changed geometryHash invalidation summaries from API", async () => {
    const unchanged = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"c".repeat(64)}`
      },
      confirmChanged: false
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    fireEvent.click(screen.getByText("确认户型，开始设计"));
    expect(await screen.findByTestId("confirm-invalidation-summary")).toHaveTextContent("户型未变化");
    expect(unchanged.confirmCalls).toBe(1);
    cleanup();

    mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"d".repeat(64)}`
      },
      confirmChanged: true
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");
    fireEvent.click(screen.getByText("确认户型，开始设计"));
    expect(await screen.findByTestId("confirm-invalidation-summary")).toHaveTextContent("户型已更新");
  });

  it("layout intent panel stays disabled before floorplan confirmation and starts after confirm", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome);
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    expect(screen.getByTestId("layout-intent-section")).toBeInTheDocument();
    expect(screen.getByTestId("layout-intent-disabled")).toHaveTextContent("请先确认户型后再设置家具摆放意图");
    expect(scenario.layoutCalls).toHaveLength(0);

    await waitFor(() => expect(lastOperation(scenario)?.operationType).toBe("advanced.settings.toggle"));
    fireEvent.click(screen.getByText("确认户型，开始设计"));
    expect(await screen.findByTestId("layout-hash")).toHaveTextContent("layoutIntentHash=");
    expect(screen.getByLabelText("AI 补全未摆放家具")).toBeChecked();
  });

  it("adds furniture placeholders through layout API without changing geometryHash", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    });
    const geometryHashBefore = scenario.layoutIntent.geometryHash;
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    expect(await screen.findByTestId("layout-hash")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("家具类型"), { target: { value: "sofa" } });
    fireEvent.click(screen.getByTestId("layout-tool-layout.placeholder.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"));

    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.add"));
    expect(lastLayoutOperation(scenario)?.payload).toMatchObject({
      placeholder: {
        roomId: "room-simple-living",
        category: "sofa"
      }
    });
    expect(await screen.findByTestId(`furniture-placeholder-${scenario.layoutIntent.placeholders[0]?.placeholderId}`)).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-properties")).toHaveTextContent("家具占位");
    expect(scenario.layoutIntent.geometryHash).toBe(geometryHashBefore);
  });

  it("moves, rotates, resizes, recategorizes, toggles autofill, and deletes placeholders through layout API", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    });
    mockSvgRect();
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await screen.findByTestId("layout-hash");
    fireEvent.click(screen.getByTestId("layout-tool-layout.placeholder.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"), { clientX: 500, clientY: 400 });
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.add"));
    const placeholderId = scenario.layoutIntent.placeholders[0]?.placeholderId;
    expect(placeholderId).toBeDefined();
    const geometryHashBefore = scenario.layoutIntent.geometryHash;

    fireEvent.click(screen.getByTestId("layout-tool-layout.placeholder.move"));
    fireEvent.pointerDown(screen.getByTestId(`furniture-placeholder-${placeholderId}`));
    fireEvent.pointerUp(screen.getByTestId("p1-canvas-stage"), { clientX: 620, clientY: 430 });
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.move"));

    fireEvent.click(screen.getByText("+15°"));
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.rotate"));
    expect(screen.getByTestId(`furniture-placeholder-${placeholderId}`)).toHaveAttribute("transform", expect.stringContaining("rotate(15)"));

    fireEvent.change(screen.getByLabelText("占位家具类型"), { target: { value: "desk" } });
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.category.change"));
    await waitFor(() => expect(screen.getByTestId(`furniture-placeholder-label-${placeholderId}`)).toHaveTextContent("书桌"));

    const widthInput = screen.getByLabelText("占位显示宽度 cm");
    const depthInput = screen.getByLabelText("占位显示深度 cm");
    fireEvent.change(widthInput, { target: { value: "120" } });
    fireEvent.change(depthInput, { target: { value: "60" } });
    await waitFor(() => expect(widthInput).toHaveValue("120"));
    await waitFor(() => expect(depthInput).toHaveValue("60"));
    fireEvent.click(screen.getByText("应用显示尺寸"));
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.displaySize.change"));
    expect(lastLayoutOperation(scenario)?.payload).toMatchObject({ displaySizeMm: { width: 1200, depth: 600 } });

    fireEvent.click(screen.getByLabelText("AI 补全未摆放家具"));
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.aiAutofill.toggle"));
    expect(screen.getByLabelText("AI 补全未摆放家具")).not.toBeChecked();

    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.delete"));
    expect(scenario.layoutIntent.geometryHash).toBe(geometryHashBefore);
  });

  it("layout validation is separate, highlights placeholders, and layout confirm returns contract data", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await screen.findByTestId("layout-hash");
    fireEvent.click(screen.getByTestId("layout-tool-layout.placeholder.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"));
    await waitFor(() => expect(lastLayoutOperation(scenario)?.operationType).toBe("layout.placeholder.add"));
    const placeholderId = scenario.layoutIntent.placeholders[0]?.placeholderId;

    scenario.layoutValidationOverride = invalidLayoutValidation(
      "PLACEHOLDER_OUTSIDE_ROOM",
      "Placeholder is outside a valid room.",
      placeholderId
    );
    fireEvent.click(screen.getByTestId("confirm-layout-intent"));
    expect(await screen.findByTestId("layout-validation-issue-PLACEHOLDER_OUTSIDE_ROOM")).toHaveTextContent("该家具占位未放置在有效房间内");
    expect(screen.getByTestId("invalid-placeholder-highlight")).toBeInTheDocument();
    expect(screen.getByTestId("validation-panel")).toHaveTextContent("户型校验");
    expect(screen.getByTestId("layout-validation-panel")).toHaveTextContent("家具摆放意图校验");
    expect(scenario.layoutConfirmCalls).toBe(0);

    scenario.layoutValidationOverride = undefined;
    fireEvent.click(screen.getByTestId("confirm-layout-intent"));
    expect(await screen.findByTestId("layout-confirm-success")).toHaveTextContent("layout-contract-test");
    expect(screen.getByTestId("layout-confirm-success")).toHaveTextContent(scenario.layoutIntent.layoutIntentHash.slice(0, 18));
    expect(screen.getByTestId("p1-dev-debug-panel")).toHaveTextContent("layoutIntentHash=");
  });

  it("layout API failure preserves current placeholder state and avoids forbidden product copy", async () => {
    const scenario = mockP1Fetch(simpleRectangleHome, {
      session: {
        activeCanonicalRevisionId: "canonical-existing",
        geometryHash: `sha256:${"a".repeat(64)}`
      },
      failNextLayoutPatch: true
    });
    render(<P1FloorplanEditor homeId={simpleRectangleHome.homeId} />);
    await screen.findByTestId("p1-canvas-stage");

    fireEvent.click(screen.getByTestId("advanced-settings-toggle"));
    await screen.findByTestId("layout-hash");
    fireEvent.click(screen.getByTestId("layout-tool-layout.placeholder.add"));
    fireEvent.pointerDown(screen.getByTestId("p1-canvas-stage"));

    expect(await screen.findByRole("alert")).toHaveTextContent("layout patch failed");
    expect(scenario.layoutIntent.placeholders).toHaveLength(0);
    expect(screen.queryByText("最终 SKU")).not.toBeInTheDocument();
    expect(screen.queryByText("精确尺寸")).not.toBeInTheDocument();
    expect(screen.queryByText("施工尺寸")).not.toBeInTheDocument();
    expect(screen.queryByText("规范合规")).not.toBeInTheDocument();
    expect(screen.queryByText("承重")).not.toBeInTheDocument();
    expect(screen.queryByText("报价")).not.toBeInTheDocument();
  });

  it("UI source does not import repositories or canonical/scene builders", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("apps/web/app/p1/_components/P1FloorplanEditor.tsx", "utf8");

    expect(source).not.toContain("@homeai/floorplan-parser");
    expect(source).not.toContain("createInMemoryP1Repositories");
    expect(source).not.toContain("createCanonicalFloorplanRevision");
    expect(source).not.toContain("buildSceneContract");
    expect(source).not.toContain("LayoutIntentRepository");
    expect(source).not.toContain("createInitialLayoutIntent");
    expect(source).not.toContain("buildLayoutIntentContract");
  });
});

function mockP1Fetch(
  fixture: FloorplanDraftRevision,
  options: {
    validation?: DraftValidationState;
    layoutValidation?: LayoutIntentValidationState;
    failNextPatch?: boolean;
    failNextPatchMessage?: string;
    failNextLayoutPatch?: boolean;
    session?: { activeCanonicalRevisionId: string; geometryHash: string };
    confirmChanged?: boolean;
  } = {}
) {
  const scenario = {
    draft: structuredClone(fixture),
    layoutIntent: createMockLayoutIntent(fixture),
    validationOverride: options.validation,
    layoutValidationOverride: options.layoutValidation,
    calls: [] as FetchCall[],
    layoutCalls: [] as LayoutFetchCall[],
    sessionCalls: 0,
    confirmCalls: 0,
    layoutConfirmCalls: 0,
    failNextPatch: options.failNextPatch ?? false,
    failNextLayoutPatch: options.failNextLayoutPatch ?? false,
    recomputeCalls: 0
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/layout-intent/session")) {
      return jsonResponse({
        layoutIntentRevisionId: scenario.layoutIntent.layoutIntentRevisionId,
        canonicalRevisionId: scenario.layoutIntent.canonicalRevisionId,
        sceneContractId: scenario.layoutIntent.sceneContractId,
        geometryHash: scenario.layoutIntent.geometryHash,
        layoutIntentHash: scenario.layoutIntent.layoutIntentHash,
        validation: scenario.layoutIntent.validation,
        placeholderCount: scenario.layoutIntent.placeholders.length,
        aiAutofillEnabled: scenario.layoutIntent.aiAutofillEnabled
      });
    }
    if (url.includes("/layout-intents/") && url.includes("/operations")) {
      const body = JSON.parse(init?.body?.toString() ?? "{}") as { operations: LayoutIntentOperation[] };
      scenario.layoutCalls.push({ url, init, operations: body.operations });
      if (scenario.failNextLayoutPatch) {
        scenario.failNextLayoutPatch = false;
        return jsonResponse({ error: "layout patch failed" }, 400);
      }
      scenario.layoutIntent = applyLayoutOperationsForMock(scenario.layoutIntent, body.operations, scenario.layoutValidationOverride);
      return jsonResponse({
        layoutIntent: scenario.layoutIntent,
        validation: scenario.layoutIntent.validation,
        layoutIntentHash: scenario.layoutIntent.layoutIntentHash,
        operationLogSummary: { count: scenario.layoutCalls.length, lastOperationId: body.operations.at(-1)?.operationId }
      });
    }
    if (url.includes("/layout-intents/") && url.includes("/validate")) {
      scenario.layoutIntent = {
        ...scenario.layoutIntent,
        validation: scenario.layoutValidationOverride ?? validLayoutValidation()
      };
      return jsonResponse(scenario.layoutIntent.validation);
    }
    if (url.includes("/layout-intents/") && url.includes("/confirm")) {
      scenario.layoutConfirmCalls += 1;
      const validation = scenario.layoutValidationOverride ?? scenario.layoutIntent.validation;
      if (!validation.canConfirm) {
        return jsonResponse({ ok: false, validation }, 400);
      }
      return jsonResponse({
        ok: true,
        layoutIntentRevisionId: scenario.layoutIntent.layoutIntentRevisionId,
        layoutIntentContractId: "layout-contract-test",
        layoutIntentHash: scenario.layoutIntent.layoutIntentHash,
        geometryHash: scenario.layoutIntent.geometryHash,
        invalidationSummary: {
          changed: scenario.layoutIntent.placeholders.length > 0,
          invalidatedDependencyIds: scenario.layoutIntent.placeholders.length > 0 ? ["layout-dependent-anchor"] : [],
          archivedLayoutIntentRevisionIds: [],
          preservedGeometryArtifacts: {
            canonicalFloorplan: true,
            sceneContract: true,
            whiteModel: true,
            cameraPlan: true,
            baseAffordanceGraph: true
          }
        },
        nextStage: "p3_layout_intent"
      });
    }
    if (url.includes("/layout-intents/") && url.includes("/contract")) {
      return jsonResponse({
        layoutIntentContractId: "layout-contract-test",
        homeId: scenario.layoutIntent.homeId,
        canonicalRevisionId: scenario.layoutIntent.canonicalRevisionId,
        sceneContractId: scenario.layoutIntent.sceneContractId,
        geometryHash: scenario.layoutIntent.geometryHash,
        layoutIntentRevisionId: scenario.layoutIntent.layoutIntentRevisionId,
        layoutIntentHash: scenario.layoutIntent.layoutIntentHash,
        aiAutofillEnabled: scenario.layoutIntent.aiAutofillEnabled,
        readonly: true,
        placeholders: scenario.layoutIntent.placeholders,
        constraints: {
          mayMutateGeometry: false,
          mayMutateSceneContract: false,
          placeholderCoordinatesAreFinalFurnitureCoordinates: false,
          placeholderSizesAreSkuSizes: false
        },
        createdAt: p1FixtureTimestamp
      });
    }
    if (url.includes("/layout-intents/")) {
      return jsonResponse(scenario.layoutIntent);
    }
    if (url.includes("/session")) {
      scenario.sessionCalls += 1;
      return jsonResponse({
        draftRevisionId: scenario.draft.draftRevisionId,
        source: scenario.draft.source,
        validationSummary: { status: "valid", canConfirm: true, issueCount: 0, blockingIssueCount: 0 },
        ...(options.session ?? {})
      });
    }
    if (url.includes("/operations")) {
      const body = JSON.parse(init?.body?.toString() ?? "{}") as { operations: FloorplanEditOperation[] };
      scenario.calls.push({ url, init, operations: body.operations });
      if (scenario.failNextPatch) {
        scenario.failNextPatch = false;
        return jsonResponse({ error: options.failNextPatchMessage ?? "patch failed" }, 400);
      }
      scenario.draft = applyFloorplanOperations(scenario.draft, body.operations);
      return jsonResponse({
        draft: scenario.draft,
        validationSummary: { status: "valid", canConfirm: true, issueCount: 0, blockingIssueCount: 0 },
        operationLogSummary: { count: scenario.draft.operationLog.length, lastOperationId: body.operations.at(-1)?.operationId }
      });
    }
    if (url.includes("/recompute-boundaries")) {
      scenario.recomputeCalls += 1;
      return jsonResponse({
        rooms: scenario.draft.rooms,
        boundaryIssues: [],
        validationSummary: { status: "valid", canConfirm: true, issueCount: 0, blockingIssueCount: 0 }
      });
    }
    if (url.includes("/validate")) {
      const validation = scenario.validationOverride ?? buildDraftValidationState(scenario.draft, { validatedAt: p1FixtureTimestamp });
      return jsonResponse(validation);
    }
    if (url.includes("/confirm")) {
      scenario.confirmCalls += 1;
      return jsonResponse({
        ok: true,
        canonicalRevisionId: "canonical-test",
        geometryHash: `sha256:${"a".repeat(64)}`,
        sceneContractId: "scene-test",
        invalidationSummary: {
          changed: options.confirmChanged ?? false,
          invalidatedDependencyIds: options.confirmChanged ? ["dependency-camera"] : [],
          archivedDependencyIds: [],
          preserved: {
            uploadedSourceAsset: true,
            parseJobHistory: true,
            userAccount: true,
            designBriefText: true,
            stylePreference: true,
            budgetPreference: true,
            eventAuditLog: true,
            paymentRecords: true,
            previousPaidDeliverableAccess: true
          }
        },
        nextStage: "p2_scene_setup"
      });
    }
    return jsonResponse({
      draft: scenario.draft,
      validation: scenario.validationOverride ?? buildDraftValidationState(scenario.draft, { validatedAt: p1FixtureTimestamp })
    });
  });

  return scenario;
}

function lastOperation(scenario: ReturnType<typeof mockP1Fetch>): FloorplanEditOperation | undefined {
  return scenario.calls.at(-1)?.operations.at(-1);
}

function lastLayoutOperation(scenario: ReturnType<typeof mockP1Fetch>): LayoutIntentOperation | undefined {
  return scenario.layoutCalls.at(-1)?.operations.at(-1);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function invalidValidation(
  code: string,
  message: string,
  targetType: DraftValidationState["issues"][number]["targetType"],
  targetId?: string
): DraftValidationState {
  return {
    status: "invalid",
    topologyValid: false,
    scaleValid: true,
    canConfirm: false,
    issues: [
      {
        issueId: `issue-${code.toLowerCase()}`,
        severity: "blocking",
        code,
        message,
        targetType,
        ...(targetId === undefined ? {} : { targetId }),
        blocksConfirmation: true
      }
    ],
    validatedAt: p1FixtureTimestamp
  };
}

function createMockLayoutIntent(fixture: FloorplanDraftRevision): LayoutIntentRevision {
  return {
    layoutIntentRevisionId: `layout-${fixture.homeId}`,
    homeId: fixture.homeId,
    canonicalRevisionId: "canonical-test",
    sceneContractId: "scene-test",
    geometryHash: `sha256:${"a".repeat(64)}`,
    layoutIntentHash: `sha256:${"b".repeat(64)}`,
    revision: 1,
    source: "p1_advanced",
    aiAutofillEnabled: true,
    placeholders: [],
    validation: validLayoutValidation(),
    createdAt: p1FixtureTimestamp,
    updatedAt: p1FixtureTimestamp
  };
}

function applyLayoutOperationsForMock(
  layoutIntent: LayoutIntentRevision,
  operations: LayoutIntentOperation[],
  validationOverride?: LayoutIntentValidationState
): LayoutIntentRevision {
  let next = structuredClone(layoutIntent);
  for (const operation of operations) {
    if (operation.operationType === "layout.placeholder.add") {
      const placeholder = (operation.payload as { placeholder?: FurniturePlaceholder } | undefined)?.placeholder;
      if (placeholder !== undefined) {
        next.placeholders = [...next.placeholders, placeholder];
      }
    }
    if (operation.operationType === "layout.placeholder.delete" && operation.placeholderId !== undefined) {
      next.placeholders = next.placeholders.filter((placeholder) => placeholder.placeholderId !== operation.placeholderId);
    }
    if (operation.operationType === "layout.placeholder.move" && operation.placeholderId !== undefined) {
      const center = (operation.payload as { center?: { x: number; y: number } } | undefined)?.center;
      if (center !== undefined) {
        next.placeholders = next.placeholders.map((placeholder) =>
          placeholder.placeholderId === operation.placeholderId ? { ...placeholder, center } : placeholder
        );
      }
    }
    if (operation.operationType === "layout.placeholder.rotate" && operation.placeholderId !== undefined) {
      const rotationDeg = (operation.payload as { rotationDeg?: number } | undefined)?.rotationDeg;
      if (rotationDeg !== undefined) {
        next.placeholders = next.placeholders.map((placeholder) =>
          placeholder.placeholderId === operation.placeholderId ? { ...placeholder, rotationDeg } : placeholder
        );
      }
    }
    if (operation.operationType === "layout.placeholder.category.change" && operation.placeholderId !== undefined) {
      const category = (operation.payload as { category?: FurnitureCategory } | undefined)?.category;
      if (category !== undefined) {
        next.placeholders = next.placeholders.map((placeholder) =>
          placeholder.placeholderId === operation.placeholderId
            ? { ...placeholder, category, label: category }
            : placeholder
        );
      }
    }
    if (operation.operationType === "layout.placeholder.displaySize.change" && operation.placeholderId !== undefined) {
      const displaySizeMm = (operation.payload as { displaySizeMm?: { width: number; depth: number } } | undefined)?.displaySizeMm;
      if (displaySizeMm !== undefined) {
        next.placeholders = next.placeholders.map((placeholder) =>
          placeholder.placeholderId === operation.placeholderId
            ? { ...placeholder, displaySizeMm, sizeSource: "user_adjusted_display_only" }
            : placeholder
        );
      }
    }
    if (operation.operationType === "layout.aiAutofill.toggle") {
      const enabled = (operation.payload as { aiAutofillEnabled?: boolean } | undefined)?.aiAutofillEnabled;
      if (enabled !== undefined) {
        next = { ...next, aiAutofillEnabled: enabled };
      }
    }
  }
  return {
    ...next,
    layoutIntentHash: fakeLayoutHash(next.placeholders.length + (next.aiAutofillEnabled ? 1 : 2) + operations.length),
    validation: validationOverride ?? validLayoutValidation(),
    updatedAt: p1FixtureTimestamp
  };
}

function validLayoutValidation(): LayoutIntentValidationState {
  return {
    status: "valid",
    canConfirm: true,
    issues: [],
    validatedAt: p1FixtureTimestamp
  };
}

function invalidLayoutValidation(
  code: string,
  message: string,
  placeholderId?: string
): LayoutIntentValidationState {
  return {
    status: "invalid",
    canConfirm: false,
    issues: [
      {
        issueId: `layout-issue-${code.toLowerCase()}`,
        severity: "error",
        code,
        message,
        ...(placeholderId === undefined ? {} : { placeholderId }),
        blocksConfirmation: true
      }
    ],
    validatedAt: p1FixtureTimestamp
  };
}

function fakeLayoutHash(seed: number): string {
  const hex = seed.toString(16).padStart(2, "0");
  return `sha256:${hex.repeat(32)}`;
}

function mockSvgRect() {
  vi.spyOn(SVGSVGElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    toJSON: () => ({})
  });
}
