import {
  createInMemoryP1Repositories,
  getP1Canonical,
  getP1DebugPayload,
  getP1Draft,
  getP1SceneContract,
  getLayoutIntentContract,
  getLayoutIntentRevision,
  patchLayoutIntentOperations,
  patchP1DraftOperations,
  postLayoutIntentConfirm,
  postLayoutIntentSession,
  postLayoutIntentValidate,
  postP1ConfirmDraft,
  postP1RecomputeBoundaries,
  postP1Session,
  postP1ValidateDraft,
  type P1ApiContext
} from "@homeai/floorplan-parser";
import type { FloorplanDraftRevision } from "@homeai/contracts";

type P1RuntimeGlobal = typeof globalThis & {
  __homeaiP1Repositories?: ReturnType<typeof createInMemoryP1Repositories>;
};

const p1RuntimeGlobal = globalThis as P1RuntimeGlobal;
const repositories = p1RuntimeGlobal.__homeaiP1Repositories ??= createInMemoryP1Repositories();

const demoTimestamp = "2026-05-13T00:00:00.000Z";
const demoDraft: FloorplanDraftRevision = {
  draftRevisionId: "draft-api-demo-home",
  homeId: "demo-home",
  source: "fixture",
  unit: "mm",
  walls: [
    wall("wall-demo-north", 0, 0, 5000, 0),
    wall("wall-demo-east", 5000, 0, 5000, 4000),
    wall("wall-demo-south", 5000, 4000, 0, 4000),
    wall("wall-demo-west", 0, 4000, 0, 0)
  ],
  openings: [
    {
      openingId: "door-demo-entry",
      type: "door",
      wallId: "wall-demo-south",
      positionOnWall: 0.5,
      widthMm: 900,
      heightMm: 2100,
      swing: "left_in",
      source: "fixture"
    }
  ],
  rooms: [
    {
      roomId: "room-demo-living",
      roomType: "living_room",
      polygon: [
        { x: 0, y: 0 },
        { x: 5000, y: 0 },
        { x: 5000, y: 4000 },
        { x: 0, y: 4000 },
        { x: 0, y: 0 }
      ],
      labelPosition: { x: 2500, y: 2000 },
      source: "fixture"
    }
  ],
  globalParams: {
    unit: "mm",
    displayUnit: "cm",
    scale: {
      source: "user_confirmed",
      mmPerPixel: 20,
      confirmed: true
    },
    gridSizeMm: 100,
    snapToleranceMm: 100,
    wallJoinToleranceMm: 100,
    openingSnapToleranceMm: 80
  },
  operationLog: [],
  validation: {
    status: "valid",
    topologyValid: true,
    scaleValid: true,
    canConfirm: true,
    issues: [],
    validatedAt: demoTimestamp
  },
  createdAt: demoTimestamp,
  updatedAt: demoTimestamp
};

const apiContext: P1ApiContext = {
  repositories,
  fixtureDrafts: {
    "demo-home": demoDraft
  },
  actor: {
    anonymousSessionId: "api-debug-session"
  }
};

export async function handlePostSession(request: Request, homeId: string): Promise<Response> {
  return toResponse(async () => {
    const input = await readOptionalDraft(request);
    const fallbackDraft = apiContext.fixtureDrafts?.[homeId] === undefined ? draftForHome(homeId) : undefined;
    return postP1Session(
      apiContext,
      homeId,
      input.draft !== undefined ? { draft: input.draft } : fallbackDraft !== undefined ? { draft: fallbackDraft } : {}
    );
  });
}

export function handleGetDraft(draftRevisionId: string): Promise<Response> {
  return toResponse(() => getP1Draft(apiContext, draftRevisionId));
}

export async function handlePatchOperations(request: Request, draftRevisionId: string): Promise<Response> {
  return toResponse(async () => patchP1DraftOperations(apiContext, draftRevisionId, await request.json()));
}

export function handlePostRecomputeBoundaries(draftRevisionId: string): Promise<Response> {
  return toResponse(() => postP1RecomputeBoundaries(apiContext, draftRevisionId));
}

export function handlePostValidate(draftRevisionId: string): Promise<Response> {
  return toResponse(() => postP1ValidateDraft(apiContext, draftRevisionId));
}

export function handlePostConfirm(draftRevisionId: string): Promise<Response> {
  return toResponse(() => {
    const result = postP1ConfirmDraft(apiContext, draftRevisionId);
    if (!result.ok) {
      return Response.json(result, { status: 422 });
    }
    return result;
  });
}

export function handleGetCanonical(canonicalRevisionId: string): Promise<Response> {
  return toResponse(() => getP1Canonical(apiContext, canonicalRevisionId));
}

export function handleGetSceneContract(sceneContractId: string): Promise<Response> {
  return toResponse(() => getP1SceneContract(apiContext, sceneContractId));
}

export function handleGetDebug(homeId: string): Promise<Response> {
  return toResponse(() => getP1DebugPayload(apiContext, homeId));
}

export function handlePostLayoutIntentSession(homeId: string): Promise<Response> {
  return toResponse(() => postLayoutIntentSession(apiContext, homeId));
}

export function handleGetLayoutIntent(layoutIntentRevisionId: string): Promise<Response> {
  return toResponse(() => getLayoutIntentRevision(apiContext, layoutIntentRevisionId));
}

export async function handlePatchLayoutIntentOperations(
  request: Request,
  layoutIntentRevisionId: string
): Promise<Response> {
  return toResponse(async () => patchLayoutIntentOperations(apiContext, layoutIntentRevisionId, await request.json()));
}

export function handlePostLayoutIntentValidate(layoutIntentRevisionId: string): Promise<Response> {
  return toResponse(() => postLayoutIntentValidate(apiContext, layoutIntentRevisionId));
}

export function handlePostLayoutIntentConfirm(layoutIntentRevisionId: string): Promise<Response> {
  return toResponse(() => {
    const result = postLayoutIntentConfirm(apiContext, layoutIntentRevisionId);
    if (!result.ok) {
      return Response.json(result, { status: 422 });
    }
    return result;
  });
}

export function handleGetLayoutIntentContract(layoutIntentRevisionId: string): Promise<Response> {
  return toResponse(() => getLayoutIntentContract(apiContext, layoutIntentRevisionId));
}

async function readOptionalDraft(request: Request): Promise<{ draft?: FloorplanDraftRevision }> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return {};
  }
  return JSON.parse(text) as { draft?: FloorplanDraftRevision };
}

async function toResponse<T>(handler: () => T | Promise<T | Response>): Promise<Response> {
  try {
    const result = await handler();
    if (result instanceof Response) {
      return result;
    }
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown P1 API error" },
      { status: 400 }
    );
  }
}

function wall(wallId: string, x1: number, y1: number, x2: number, y2: number) {
  return {
    wallId,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thicknessMm: 200,
    kind: "exterior" as const,
    source: "fixture" as const
  };
}

function draftForHome(homeId: string): FloorplanDraftRevision {
  const draft = {
    ...demoDraft,
    draftRevisionId: `draft-api-${homeId}`,
    homeId,
    walls: demoDraft.walls.map((wall) => ({ ...wall, start: { ...wall.start }, end: { ...wall.end } })),
    openings: demoDraft.openings.map((opening) => ({ ...opening })),
    rooms: demoDraft.rooms.map((room) => ({
      ...room,
      polygon: room.polygon.map((point) => ({ ...point })),
      ...(room.labelPosition === undefined ? {} : { labelPosition: { ...room.labelPosition } })
    })),
    operationLog: [],
  };
  return demoDraft.validation === undefined
    ? draft
    : {
        ...draft,
        validation: {
          ...demoDraft.validation,
          issues: demoDraft.validation.issues.map((issue) => ({ ...issue }))
        }
      };
}
