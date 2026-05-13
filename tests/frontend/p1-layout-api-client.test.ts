// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutIntentOperation } from "@homeai/contracts";
import {
  applyLayoutIntentOperations,
  confirmLayoutIntent,
  getLayoutIntent,
  getLayoutIntentContract,
  startLayoutIntentSession,
  validateLayoutIntent
} from "../../apps/web/app/p1/_lib/p1-api-client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("P1 layout intent API client", () => {
  it("requests layout intent session, revision, validation, confirmation, and contract endpoints", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/layout-intent/session")) {
        return jsonResponse({
          layoutIntentRevisionId: "layout-1",
          canonicalRevisionId: "canonical-1",
          sceneContractId: "scene-1",
          geometryHash: hash("a"),
          layoutIntentHash: hash("b"),
          validation: validLayoutValidation(),
          placeholderCount: 0,
          aiAutofillEnabled: true
        });
      }
      if (url.endsWith("/operations")) {
        return jsonResponse({
          layoutIntent: mockLayoutIntent(),
          validation: validLayoutValidation(),
          layoutIntentHash: hash("b"),
          operationLogSummary: { count: 1, lastOperationId: "layout-op-1" }
        });
      }
      if (url.endsWith("/validate")) {
        return jsonResponse(validLayoutValidation());
      }
      if (url.endsWith("/confirm")) {
        return jsonResponse({
          ok: true,
          layoutIntentRevisionId: "layout-1",
          layoutIntentContractId: "layout-contract-1",
          layoutIntentHash: hash("b"),
          geometryHash: hash("a"),
          invalidationSummary: {
            changed: false,
            invalidatedDependencyIds: [],
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
      if (url.endsWith("/contract")) {
        return jsonResponse({
          layoutIntentContractId: "layout-contract-1",
          ...mockLayoutIntent(),
          readonly: true,
          constraints: {
            mayMutateGeometry: false,
            mayMutateSceneContract: false,
            placeholderCoordinatesAreFinalFurnitureCoordinates: false,
            placeholderSizesAreSkuSizes: false
          }
        });
      }
      return jsonResponse(mockLayoutIntent());
    });

    await startLayoutIntentSession("home-1");
    await getLayoutIntent("layout-1");
    const operation: LayoutIntentOperation = {
      operationId: "layout-op-1",
      operationType: "layout.aiAutofill.toggle",
      actor: "user",
      payload: { aiAutofillEnabled: false },
      createdAt: "2026-05-13T00:00:00.000Z"
    };
    await applyLayoutIntentOperations("layout-1", [operation]);
    await validateLayoutIntent("layout-1");
    await confirmLayoutIntent("layout-1");
    await getLayoutIntentContract("layout-1");

    expect(calls).toEqual([
      "POST /api/p1/home-1/layout-intent/session",
      "GET /api/p1/layout-intents/layout-1",
      "PATCH /api/p1/layout-intents/layout-1/operations",
      "POST /api/p1/layout-intents/layout-1/validate",
      "POST /api/p1/layout-intents/layout-1/confirm",
      "GET /api/p1/layout-intents/layout-1/contract"
    ]);
  });

  it("surfaces layout intent API error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "layout unavailable" }, 409));

    await expect(startLayoutIntentSession("home-1")).rejects.toThrow("layout unavailable");
  });
});

function mockLayoutIntent() {
  return {
    layoutIntentRevisionId: "layout-1",
    homeId: "home-1",
    canonicalRevisionId: "canonical-1",
    sceneContractId: "scene-1",
    geometryHash: hash("a"),
    layoutIntentHash: hash("b"),
    revision: 1,
    source: "p1_advanced",
    aiAutofillEnabled: true,
    placeholders: [],
    validation: validLayoutValidation(),
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:00:00.000Z"
  };
}

function validLayoutValidation() {
  return {
    status: "valid",
    canConfirm: true,
    issues: [],
    validatedAt: "2026-05-13T00:00:00.000Z"
  };
}

function hash(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
