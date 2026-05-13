import { describe, expect, it } from "vitest";
import {
  buildDesignKernelInputFromP1Artifacts,
  compileMockSchemeLite
} from "@homeai/design-kernel";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";

describe("Design Kernel input assembly", () => {
  it("assembles aligned P1 artifacts into an immutable input", () => {
    const bundle = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const sceneSnapshot = JSON.stringify(bundle.sceneContract);
    const graphSnapshot = JSON.stringify(bundle.roomAffordanceGraph);

    expect(bundle.input.homeId).toBe(bundle.sceneContract.homeId);
    expect(bundle.input.floorplanRevisionId).toBe(bundle.sceneContract.canonicalRevisionId);
    expect(bundle.input.sceneContractId).toBe(bundle.sceneContract.sceneContractId);
    expect(bundle.input.geometryHash).toBe(bundle.sceneContract.geometryHash);
    expect(bundle.input.layoutIntentHash).toBe(bundle.layoutIntentContract?.layoutIntentHash);
    expect(Object.isFrozen(bundle.input)).toBe(true);
    expect(() => {
      (bundle.input.anchorPlans as unknown as unknown[]).push({});
    }).toThrow();

    compileMockSchemeLite(bundle.input);
    expect(JSON.stringify(bundle.sceneContract)).toBe(sceneSnapshot);
    expect(JSON.stringify(bundle.roomAffordanceGraph)).toBe(graphSnapshot);
  });

  it("fails closed on homeId, floorplanRevisionId, sceneContractId, and geometryHash mismatches", () => {
    const bundle = createDesignKernelFixtureBundle();
    const base = {
      inputId: "input-mismatch",
      homeId: bundle.sceneContract.homeId,
      floorplanRevisionId: bundle.sceneContract.canonicalRevisionId,
      sceneContractId: bundle.sceneContract.sceneContractId,
      geometryHash: bundle.sceneContract.geometryHash,
      sceneContract: bundle.sceneContract,
      roomAffordanceGraph: bundle.roomAffordanceGraph,
      anchorPlans: [bundle.anchorPlan],
      cameraPlan: bundle.cameraPlan,
      userBriefInput: bundle.userBriefInput,
      source: "fixture" as const
    };

    expect(() => buildDesignKernelInputFromP1Artifacts(base)).not.toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({ ...base, homeId: "home-mismatch" })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({ ...base, floorplanRevisionId: "canonical-mismatch" })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({ ...base, sceneContractId: "scene-mismatch" })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({ ...base, geometryHash: `sha256:${"7".repeat(64)}` })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({
      ...base,
      roomAffordanceGraph: {
        ...bundle.roomAffordanceGraph,
        geometryHash: `sha256:${"8".repeat(64)}`
      }
    })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({
      ...base,
      anchorPlans: [
        {
          ...bundle.anchorPlan,
          sceneContractId: "scene-mismatch"
        }
      ]
    })).toThrow();
    expect(() => buildDesignKernelInputFromP1Artifacts({
      ...base,
      cameraPlan: {
        ...bundle.cameraPlan,
        canonicalRevisionId: "canonical-mismatch"
      }
    })).toThrow();
  });

  it("rejects layout intent trace drift", () => {
    const bundle = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const layoutIntentContract = bundle.layoutIntentContract;
    if (layoutIntentContract === undefined) {
      throw new Error("Expected layout intent contract.");
    }

    expect(() => buildDesignKernelInputFromP1Artifacts({
      inputId: "input-layout-mismatch",
      homeId: bundle.sceneContract.homeId,
      floorplanRevisionId: bundle.sceneContract.canonicalRevisionId,
      sceneContractId: bundle.sceneContract.sceneContractId,
      geometryHash: bundle.sceneContract.geometryHash,
      sceneContract: bundle.sceneContract,
      roomAffordanceGraph: bundle.roomAffordanceGraph,
      anchorPlans: [bundle.anchorPlan],
      layoutIntentContract: {
        ...layoutIntentContract,
        geometryHash: `sha256:${"9".repeat(64)}`
      },
      userBriefInput: bundle.userBriefInput,
      source: "fixture"
    })).toThrow();
  });
});
