import { describe, expect, it } from "vitest";
import type { FloorplanDraftRevision, FloorplanEditOperation } from "@homeai/contracts";
import {
  createInMemoryP1Repositories,
  getP1Canonical,
  getP1Draft,
  getP1SceneContract,
  patchP1DraftOperations,
  postP1ConfirmDraft,
  postP1Session,
  postP1ValidateDraft,
  type P1ApiContext
} from "@homeai/floorplan-parser";
import {
  invalidUnclosedRoom,
  p1FixtureTimestamp,
  simpleRectangleHome
} from "../fixtures/p1/index.js";

describe("P1 API boundary handlers", () => {
  it("creates a session from fixture draft, fetches draft, applies operations, and validates", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const session = postP1Session(context, simpleRectangleHome.homeId);
    const fetched = getP1Draft(context, session.draftRevisionId);
    const patched = patchP1DraftOperations(context, session.draftRevisionId, {
      operations: [
        op("op-api-thickness", "wall.thickness.change", "wall", "wall-simple-east", {
          thicknessMm: 220
        })
      ]
    });
    const validation = postP1ValidateDraft(context, session.draftRevisionId);

    expect(session.source).toBe("ai_parse");
    expect(fetched.draft.draftRevisionId).toBe(session.draftRevisionId);
    expect(patched.operationLogSummary.lastOperationId).toBe("op-api-thickness");
    expect(validation.canConfirm).toBe(true);
  });

  it("confirms a valid draft and exposes canonical revision plus SceneContract", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const session = postP1Session(context, simpleRectangleHome.homeId);
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
    if (!confirmed.ok) {
      throw new Error("Expected confirm to succeed.");
    }

    const canonical = getP1Canonical(context, confirmed.canonicalRevisionId);
    const scene = getP1SceneContract(context, confirmed.sceneContractId);

    expect(confirmed.geometryHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(scene.readonly).toBe(true);
    expect(scene.geometryHash).toBe(canonical.geometryHash);
    expect(() => getP1SceneContract(context, session.draftRevisionId)).toThrow();
  });

  it("rejects invalid confirm closed", () => {
    const context = apiContext({ [invalidUnclosedRoom.homeId]: invalidUnclosedRoom });
    const session = postP1Session(context, invalidUnclosedRoom.homeId);
    const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);

    expect(confirmed.ok).toBe(false);
    if (!confirmed.ok) {
      expect(confirmed.validation.canConfirm).toBe(false);
    }
  });

  it("re-entry no-op preserves hash and changed geometry returns invalidation summary", () => {
    const context = apiContext({ [simpleRectangleHome.homeId]: simpleRectangleHome });
    const firstSession = postP1Session(context, simpleRectangleHome.homeId);
    const firstConfirm = postP1ConfirmDraft(context, firstSession.draftRevisionId);
    if (!firstConfirm.ok) {
      throw new Error("Expected first confirm to succeed.");
    }

    const reentry = postP1Session(context, simpleRectangleHome.homeId);
    const secondConfirm = postP1ConfirmDraft(context, reentry.draftRevisionId);
    if (!secondConfirm.ok) {
      throw new Error("Expected re-entry confirm to succeed.");
    }
    expect(secondConfirm.geometryHash).toBe(firstConfirm.geometryHash);
    expect(secondConfirm.invalidationSummary.changed).toBe(false);

    const changedReentry = postP1Session(context, simpleRectangleHome.homeId);
    patchP1DraftOperations(context, changedReentry.draftRevisionId, {
      operations: [
        op("op-api-reentry-change", "wall.thickness.change", "wall", "wall-simple-east", {
          thicknessMm: 260
        })
      ]
    });
    const changedConfirm = postP1ConfirmDraft(context, changedReentry.draftRevisionId);
    if (!changedConfirm.ok) {
      throw new Error("Expected changed re-entry confirm to succeed.");
    }

    expect(changedConfirm.geometryHash).not.toBe(secondConfirm.geometryHash);
    expect(changedConfirm.invalidationSummary.changed).toBe(true);
    expect(changedConfirm.invalidationSummary.invalidatedDependencyIds.length).toBeGreaterThan(0);
  });
});

export function apiContext(fixtures: Record<string, FloorplanDraftRevision>): P1ApiContext {
  let counter = 0;
  return {
    repositories: createInMemoryP1Repositories(),
    fixtureDrafts: fixtures,
    actor: {
      anonymousSessionId: "anonymous-api-test"
    },
    now: () => p1FixtureTimestamp,
    idFactory: (prefix: string) => `${prefix}-${counter += 1}`
  };
}

export function op(
  operationId: string,
  operationType: FloorplanEditOperation["operationType"],
  targetType: FloorplanEditOperation["targetType"],
  targetId?: string,
  payload?: Record<string, unknown>
): FloorplanEditOperation {
  return {
    operationId,
    operationType,
    targetType,
    ...(targetId === undefined ? {} : { targetId }),
    actor: "user",
    ...(payload === undefined ? {} : { payload }),
    createdAt: p1FixtureTimestamp
  };
}
