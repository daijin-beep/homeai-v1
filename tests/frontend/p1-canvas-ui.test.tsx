// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DraftValidationState, FloorplanDraftRevision, FloorplanEditOperation } from "@homeai/contracts";
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

  it("UI source does not import repositories or canonical/scene builders", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("apps/web/app/p1/_components/P1FloorplanEditor.tsx", "utf8");

    expect(source).not.toContain("@homeai/floorplan-parser");
    expect(source).not.toContain("createInMemoryP1Repositories");
    expect(source).not.toContain("createCanonicalFloorplanRevision");
    expect(source).not.toContain("buildSceneContract");
  });
});

function mockP1Fetch(
  fixture: FloorplanDraftRevision,
  options: { validation?: DraftValidationState; failNextPatch?: boolean } = {}
) {
  const scenario = {
    draft: structuredClone(fixture),
    validationOverride: options.validation,
    calls: [] as FetchCall[],
    confirmCalls: 0,
    failNextPatch: options.failNextPatch ?? false
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/session")) {
      return jsonResponse({
        draftRevisionId: scenario.draft.draftRevisionId,
        source: scenario.draft.source,
        validationSummary: { status: "valid", canConfirm: true, issueCount: 0, blockingIssueCount: 0 }
      });
    }
    if (url.includes("/operations")) {
      const body = JSON.parse(init?.body?.toString() ?? "{}") as { operations: FloorplanEditOperation[] };
      scenario.calls.push({ url, init, operations: body.operations });
      if (scenario.failNextPatch) {
        scenario.failNextPatch = false;
        return jsonResponse({ error: "patch failed" }, 400);
      }
      scenario.draft = applyFloorplanOperations(scenario.draft, body.operations);
      return jsonResponse({
        draft: scenario.draft,
        validationSummary: { status: "valid", canConfirm: true, issueCount: 0, blockingIssueCount: 0 },
        operationLogSummary: { count: scenario.draft.operationLog.length, lastOperationId: body.operations.at(-1)?.operationId }
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
          changed: false,
          invalidatedDependencyIds: [],
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
