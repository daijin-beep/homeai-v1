import type {
  DraftValidationState,
  FloorplanDraftRevision,
  FloorplanEditOperation,
  LayoutIntentContract,
  LayoutIntentInvalidationSummary,
  LayoutIntentOperation,
  LayoutIntentRevision,
  LayoutIntentValidationState,
  P1InvalidationSummary,
  P1ValidationSummary
} from "@homeai/contracts";

export type P1SessionResponse = {
  draftRevisionId: string;
  source: FloorplanDraftRevision["source"];
  validationSummary: P1ValidationSummary;
  activeCanonicalRevisionId?: string;
  geometryHash?: string;
};

export type P1DraftResponse = {
  draft: FloorplanDraftRevision;
  validation: DraftValidationState;
};

export type P1OperationResponse = {
  draft: FloorplanDraftRevision;
  validationSummary: P1ValidationSummary;
  operationLogSummary: {
    count: number;
    lastOperationId?: string;
  };
};

export type P1ConfirmResponse =
  | {
      ok: true;
      canonicalRevisionId: string;
      geometryHash: string;
      sceneContractId: string;
      invalidationSummary: P1InvalidationSummary;
      nextStage: "p2_scene_setup";
    }
  | {
      ok: false;
      validation: DraftValidationState;
    };

export type LayoutIntentSessionResponse = {
  layoutIntentRevisionId: string;
  canonicalRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  layoutIntentHash: string;
  validation: LayoutIntentValidationState;
  placeholderCount: number;
  aiAutofillEnabled: boolean;
};

export type LayoutIntentOperationResponse = {
  layoutIntent: LayoutIntentRevision;
  validation: LayoutIntentValidationState;
  layoutIntentHash: string;
  operationLogSummary: {
    count: number;
    lastOperationId?: string;
  };
};

export type LayoutIntentConfirmResponse =
  | {
      ok: true;
      layoutIntentRevisionId: string;
      layoutIntentContractId: string;
      layoutIntentHash: string;
      geometryHash: string;
      invalidationSummary: LayoutIntentInvalidationSummary;
      nextStage: "p3_layout_intent";
    }
  | {
      ok: false;
      validation: LayoutIntentValidationState;
    };

export async function startP1Session(homeId: string): Promise<P1SessionResponse> {
  return requestJson(`/api/p1/${encodeURIComponent(homeId)}/session`, {
    method: "POST"
  });
}

export async function fetchP1Draft(draftRevisionId: string): Promise<P1DraftResponse> {
  return requestJson(`/api/p1/drafts/${encodeURIComponent(draftRevisionId)}`);
}

export async function applyP1Operations(
  draftRevisionId: string,
  operations: FloorplanEditOperation[]
): Promise<P1OperationResponse> {
  return requestJson(`/api/p1/drafts/${encodeURIComponent(draftRevisionId)}/operations`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operations })
  });
}

export async function recomputeP1Boundaries(draftRevisionId: string): Promise<unknown> {
  return requestJson(`/api/p1/drafts/${encodeURIComponent(draftRevisionId)}/recompute-boundaries`, {
    method: "POST"
  });
}

export async function validateP1Draft(draftRevisionId: string): Promise<DraftValidationState> {
  return requestJson(`/api/p1/drafts/${encodeURIComponent(draftRevisionId)}/validate`, {
    method: "POST"
  });
}

export async function confirmP1Draft(draftRevisionId: string): Promise<P1ConfirmResponse> {
  const response = await fetch(`/api/p1/drafts/${encodeURIComponent(draftRevisionId)}/confirm`, {
    method: "POST"
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok && isObject(payload) && "ok" in payload) {
    return payload as P1ConfirmResponse;
  }
  if (!response.ok) {
    throw new Error(hasError(payload) ? payload.error : "P1 confirm failed.");
  }
  return payload as P1ConfirmResponse;
}

export function debugPayloadUrl(homeId: string): string {
  return `/api/p1/debug/${encodeURIComponent(homeId)}`;
}

export async function startLayoutIntentSession(homeId: string): Promise<LayoutIntentSessionResponse> {
  return requestJson(`/api/p1/${encodeURIComponent(homeId)}/layout-intent/session`, {
    method: "POST"
  });
}

export async function getLayoutIntent(layoutIntentRevisionId: string): Promise<LayoutIntentRevision> {
  return requestJson(`/api/p1/layout-intents/${encodeURIComponent(layoutIntentRevisionId)}`);
}

export async function applyLayoutIntentOperations(
  layoutIntentRevisionId: string,
  operations: LayoutIntentOperation[]
): Promise<LayoutIntentOperationResponse> {
  return requestJson(`/api/p1/layout-intents/${encodeURIComponent(layoutIntentRevisionId)}/operations`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ operations })
  });
}

export async function validateLayoutIntent(layoutIntentRevisionId: string): Promise<LayoutIntentValidationState> {
  return requestJson(`/api/p1/layout-intents/${encodeURIComponent(layoutIntentRevisionId)}/validate`, {
    method: "POST"
  });
}

export async function confirmLayoutIntent(
  layoutIntentRevisionId: string
): Promise<LayoutIntentConfirmResponse> {
  const response = await fetch(`/api/p1/layout-intents/${encodeURIComponent(layoutIntentRevisionId)}/confirm`, {
    method: "POST"
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok && isObject(payload) && "ok" in payload) {
    return payload as LayoutIntentConfirmResponse;
  }
  if (!response.ok) {
    throw new Error(hasError(payload) ? payload.error : "Layout intent confirm failed.");
  }
  return payload as LayoutIntentConfirmResponse;
}

export async function getLayoutIntentContract(layoutIntentRevisionId: string): Promise<LayoutIntentContract> {
  return requestJson(`/api/p1/layout-intents/${encodeURIComponent(layoutIntentRevisionId)}/contract`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(hasError(payload) ? payload.error : "P1 API request failed.");
  }
  return payload as T;
}

function hasError(payload: unknown): payload is { error: string } {
  return isObject(payload) && typeof payload.error === "string";
}

function isObject(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}
