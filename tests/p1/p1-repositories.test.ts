import { describe, expect, it } from "vitest";
import type { FloorplanEditOperation } from "@homeai/contracts";
import {
  buildSceneContractFromCanonicalRevision,
  confirmFloorplanDraft,
  createDraftFromParsedFloorplan,
  createInMemoryP1Repositories,
  createReentryDraftForHome,
  persistSceneContract
} from "@homeai/floorplan-parser";
import { p1FixtureTimestamp, simpleRectangleHome } from "../fixtures/p1/index.js";

describe("P1 repository interfaces", () => {
  it("in-memory repositories implement the required interface methods", () => {
    const repositories = createInMemoryP1Repositories();

    expect(typeof repositories.drafts.createDraft).toBe("function");
    expect(typeof repositories.drafts.getDraftById).toBe("function");
    expect(typeof repositories.drafts.updateDraft).toBe("function");
    expect(typeof repositories.drafts.appendOperation).toBe("function");
    expect(typeof repositories.drafts.listOperations).toBe("function");
    expect(typeof repositories.drafts.createDraftFromCanonicalRevision).toBe("function");
    expect(typeof repositories.canonical.createCanonicalRevision).toBe("function");
    expect(typeof repositories.sceneContracts.archiveSceneContract).toBe("function");
    expect(typeof repositories.geometryDependencies.markInvalidated).toBe("function");
    expect(typeof repositories.events.appendEvent).toBe("function");
  });

  it("draft services persist through repository interfaces", () => {
    const repositories = createInMemoryP1Repositories();
    const draft = createDraftFromParsedFloorplan(simpleRectangleHome, {
      draftRevisionId: "draft-repo-ai",
      createdAt: p1FixtureTimestamp
    }, repositories);
    const operation = op("op-repo-floor-height", "floorHeight.change", "global_params", undefined, {
      floorHeightMm: 3000
    });
    repositories.drafts.appendOperation(draft.draftRevisionId, operation);

    expect(repositories.drafts.getDraftById("draft-repo-ai")?.source).toBe("ai_parse");
    expect(repositories.drafts.listOperations("draft-repo-ai").map((item) => item.operationId)).toContain(
      "op-repo-floor-height"
    );
  });

  it("canonical and SceneContract getters cannot mutate stored Space Truth data", () => {
    const repositories = createInMemoryP1Repositories();
    const confirmed = confirmFloorplanDraft(simpleRectangleHome, {
      canonicalRevisionId: "canonical-repo",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: true,
      store: repositories
    });
    if (!confirmed.ok) {
      throw new Error("Expected confirm to succeed.");
    }
    const scene = persistSceneContract(
      buildSceneContractFromCanonicalRevision(confirmed.canonicalRevision, {
        sceneContractId: "scene-repo",
        createdAt: p1FixtureTimestamp
      }),
      repositories
    );

    const canonicalFromRepo = repositories.canonical.getCanonicalRevision("canonical-repo");
    const sceneFromRepo = repositories.sceneContracts.getSceneContract(scene.sceneContractId);

    expect(Object.isFrozen(canonicalFromRepo)).toBe(true);
    expect(Object.isFrozen(sceneFromRepo)).toBe(true);
    expect(() => {
      (canonicalFromRepo as unknown as { unit: string }).unit = "cm";
    }).toThrow();
    expect(() => {
      (sceneFromRepo as unknown as { readonly: boolean }).readonly = false;
    }).toThrow();
    expect(repositories.canonical.getCanonicalRevision("canonical-repo")?.unit).toBe("mm");
    expect(repositories.sceneContracts.getSceneContract(scene.sceneContractId)?.readonly).toBe(true);
  });

  it("re-entry draft is created from active canonical revision", () => {
    const repositories = createInMemoryP1Repositories();
    const confirmed = confirmFloorplanDraft(simpleRectangleHome, {
      canonicalRevisionId: "canonical-repo-reentry",
      version: 1,
      confirmedAt: p1FixtureTimestamp,
      userConfirmed: true,
      store: repositories
    });
    expect(confirmed.ok).toBe(true);

    const reentry = createReentryDraftForHome("home-simple-rectangle", {
      draftRevisionId: "draft-repo-reentry",
      createdAt: p1FixtureTimestamp
    }, repositories);

    expect(reentry.source).toBe("reentry_edit");
    expect(reentry.baseCanonicalRevisionId).toBe("canonical-repo-reentry");
  });
});

function op(
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
