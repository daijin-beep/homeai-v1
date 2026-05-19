import { describe, expect, it } from "vitest";
import {
  V1BetaFlowStageSchema,
  V1BetaFlowViewModelSchema,
  type V1BetaFlowViewModel
} from "@homeai/contracts";

const timestamp = "2026-05-16T00:00:00.000Z";
const geometryHash = `sha256:${"7".repeat(64)}`;

describe("V1 Beta flow contracts", () => {
  it("validates a deterministic user flow shell", () => {
    const flow = createFlow();

    expect(V1BetaFlowViewModelSchema.safeParse(flow).success).toBe(true);
    expect(flow.guardrails.adsRuntimeConsumed).toBe(false);
    expect(flow.guardrails.realProviderEnabled).toBe(false);
    expect(flow.guardrails.networkCallsEnabled).toBe(false);
    expect(flow.guardrails.confirmedGeometryMutable).toBe(false);
  });

  it("rejects summary counts that drift from stages", () => {
    const flow = createFlow();

    expect(
      V1BetaFlowViewModelSchema.safeParse({
        ...flow,
        summary: {
          ...flow.summary,
          lockedStages: 0
        }
      }).success
    ).toBe(false);
  });

  it("rejects flows without exactly one current stage", () => {
    const flow = createFlow();

    expect(
      V1BetaFlowViewModelSchema.safeParse({
        ...flow,
        stages: flow.stages.map((stage) =>
          stage.stageId === "render_review" ? { ...stage, status: "complete" as const } : stage
        )
      }).success
    ).toBe(false);
  });

  it("rejects unknown beta flow stages", () => {
    expect(
      V1BetaFlowStageSchema.safeParse({
        stageId: "contractor_handoff",
        status: "locked",
        label: "Unsupported stage",
        summary: "Unsupported stage."
      }).success
    ).toBe(false);
  });
});

function createFlow(): V1BetaFlowViewModel {
  return V1BetaFlowViewModelSchema.parse({
    version: "0.1",
    source: "deterministic_fixture",
    homeId: "home-beta-flow-fixture",
    schemeId: "scheme-beta-flow-fixture",
    floorplanRevisionId: "canonical-beta-flow-fixture",
    sceneContractId: "scene-beta-flow-fixture",
    geometryHash,
    title: "homeAI V1 Beta flow",
    summary: {
      totalStages: 6,
      completeStages: 3,
      readyStages: 0,
      lockedStages: 2,
      needsReviewStages: 0,
      currentStageId: "render_review",
      status: "needs_review"
    },
    stages: [
      {
        stageId: "floorplan_upload",
        status: "complete",
        label: "Floorplan upload",
        summary: "Fixture floorplan is available.",
        itemCount: 1,
        issueCount: 0
      },
      {
        stageId: "space_confirmation",
        status: "complete",
        label: "Space confirmation",
        summary: "Confirmed geometry trace is read-only downstream.",
        itemCount: 7,
        issueCount: 0
      },
      {
        stageId: "scheme_review",
        status: "complete",
        label: "Scheme review",
        summary: "Full-space SchemeLite preview is ready.",
        itemCount: 7,
        issueCount: 0
      },
      {
        stageId: "render_review",
        status: "current",
        label: "Room visual review",
        summary: "Render status is available from deterministic view models.",
        itemCount: 6,
        issueCount: 1
      },
      {
        stageId: "decor_matching",
        status: "locked",
        label: "Decor matching",
        summary: "Locked until local catalog admission is implemented.",
        itemCount: 0,
        issueCount: 0
      },
      {
        stageId: "conversion_intent",
        status: "locked",
        label: "Conversion intent",
        summary: "Locked until mock conversion actions are implemented.",
        itemCount: 0,
        issueCount: 0
      }
    ],
    guardrails: {
      deterministicFixturesOnly: true,
      adsRuntimeConsumed: false,
      realProviderEnabled: false,
      networkCallsEnabled: false,
      confirmedGeometryMutable: false,
      downstreamCommerceEnabled: false
    },
    generatedAt: timestamp
  });
}
