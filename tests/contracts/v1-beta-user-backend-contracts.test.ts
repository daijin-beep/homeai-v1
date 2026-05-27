import { describe, expect, it } from "vitest";
import {
  P1UserFlowViewModelSchema,
  UploadFloorplanRequestSchema,
  UploadFloorplanResponseSchema,
  V1BetaHomeBootstrapSchema,
  type P1UserFlowViewModel,
  type UploadFloorplanResponse,
  type V1BetaHomeBootstrap,
} from "@homeai/contracts";

const timestamp = "2026-05-20T00:00:00.000Z";
const geometryHash = `sha256:${"8".repeat(64)}`;

const guardrails = {
  mockOnly: true,
  dbPersistenceEnabled: false,
  realProviderEnabled: false,
  networkCallsEnabled: false,
  authEnforced: false,
  confirmedGeometryMutable: false,
} as const;

describe("V1 Beta user backend contracts", () => {
  it("validates a P1 user flow view model for frontend bootstrap", () => {
    const flow = createFlow();

    expect(P1UserFlowViewModelSchema.safeParse(flow).success).toBe(true);
    expect(flow.guardrails.mockOnly).toBe(true);
    expect(flow.guardrails.dbPersistenceEnabled).toBe(false);
    expect(flow.guardrails.realProviderEnabled).toBe(false);
    expect(flow.guardrails.networkCallsEnabled).toBe(false);
    expect(flow.guardrails.confirmedGeometryMutable).toBe(false);
  });

  it("requires a geometry hash when canonical revision trace is present", () => {
    const flow = createFlow();

    expect(
      P1UserFlowViewModelSchema.safeParse({
        ...flow,
        trace: {
          ...flow.trace,
          canonicalRevisionId: "canonical-user-beta",
          geometryHash: undefined,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects disabled actions without a visible reason", () => {
    const flow = createFlow();

    expect(
      P1UserFlowViewModelSchema.safeParse({
        ...flow,
        nextActions: [
          {
            actionId: "wait_for_parse",
            label: "Wait for parse",
            method: "GET",
            href: "/api/beta/home-user-beta/bootstrap",
            enabled: false,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("validates a home bootstrap shell with API endpoints", () => {
    const bootstrap = createBootstrap();

    expect(V1BetaHomeBootstrapSchema.safeParse(bootstrap).success).toBe(true);
    expect(bootstrap.endpoints.uploadFloorplan).toBe(
      "/api/beta/home-user-beta/floorplan/upload",
    );
  });

  it("rejects bootstrap payloads whose homeId drifts from flow trace", () => {
    const bootstrap = createBootstrap();

    expect(
      V1BetaHomeBootstrapSchema.safeParse({
        ...bootstrap,
        flow: {
          ...bootstrap.flow,
          trace: { ...bootstrap.flow.trace, homeId: "other-home" },
        },
      }).success,
    ).toBe(false);
  });

  it("validates mock upload responses without trusting parser output", () => {
    const response = createUploadResponse();

    expect(UploadFloorplanResponseSchema.safeParse(response).success).toBe(true);
    expect(response.currentState).toBe("p1_session_required");
    expect(response.trace.canonicalRevisionId).toBeUndefined();
    expect(response.trace.geometryHash).toBeUndefined();
    expect(response.guardrails.mockOnly).toBe(true);
  });

  it("rejects beta bootstrap flows that mark no-session state as confirmable", () => {
    const flow = createPreSessionFlow();

    expect(P1UserFlowViewModelSchema.safeParse(flow).success).toBe(true);
    expect(
      P1UserFlowViewModelSchema.safeParse({
        ...flow,
        currentState: "draft_ready",
        validation: {
          status: "valid",
          canConfirm: true,
          issueCount: 0,
          blockingIssueCount: 0,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects pending or not evaluable validation when canConfirm is true", () => {
    const flow = createPreSessionFlow();

    expect(
      P1UserFlowViewModelSchema.safeParse({
        ...flow,
        validation: {
          status: "not_evaluable",
          canConfirm: true,
          issueCount: 0,
          blockingIssueCount: 0,
        },
      }).success,
    ).toBe(false);
  });

  it("requires fixture key or file name according to upload mode", () => {
    expect(
      UploadFloorplanRequestSchema.safeParse({
        uploadMode: "fixture_asset",
        fixtureKey: "one-bedroom",
      }).success,
    ).toBe(true);
    expect(
      UploadFloorplanRequestSchema.safeParse({
        uploadMode: "fixture_asset",
      }).success,
    ).toBe(false);
    expect(
      UploadFloorplanRequestSchema.safeParse({
        uploadMode: "file_asset_placeholder",
        fileName: "floorplan.png",
      }).success,
    ).toBe(true);
  });
});

function createBootstrap(): V1BetaHomeBootstrap {
  const flow = createFlow();
  return V1BetaHomeBootstrapSchema.parse({
    ok: true,
    version: "0.1",
    source: "mock_contract_shell",
    homeId: "home-user-beta",
    title: "homeAI user beta backend shell",
    flow,
    endpoints: {
      bootstrap: "/api/beta/home-user-beta/bootstrap",
      uploadFloorplan: "/api/beta/home-user-beta/floorplan/upload",
      p1Session: "/api/p1/home-user-beta/session",
      p1DraftViewModel: "/api/p1/drafts/{draftRevisionId}",
      p1Confirm: "/api/p1/drafts/{draftRevisionId}/confirm",
    },
    generatedAt: timestamp,
  });
}

function createPreSessionFlow(): P1UserFlowViewModel {
  return P1UserFlowViewModelSchema.parse({
    version: "0.1",
    source: "mock_contract_shell",
    trace: {
      homeId: "home-user-beta",
    },
    currentState: "p1_session_required",
    userVisibleStage: "space_confirmation",
    validation: {
      status: "not_evaluable",
      canConfirm: false,
      issueCount: 0,
      blockingIssueCount: 1,
    },
    nextActions: [
      {
        actionId: "open_p1_session",
        label: "Start P1 review session",
        method: "POST",
        href: "/api/p1/home-user-beta/session",
        enabled: true,
      },
    ],
    blockers: [
      {
        code: "P1_SESSION_REQUIRED",
        message: "Start or load a real P1 session before confirmation.",
        severity: "blocker",
        target: "p1Session",
      },
    ],
    guardrails,
    updatedAt: timestamp,
  });
}

function createFlow(): P1UserFlowViewModel {
  return P1UserFlowViewModelSchema.parse({
    version: "0.1",
    source: "mock_contract_shell",
    trace: {
      homeId: "home-user-beta",
      draftRevisionId: "draft-user-beta",
      canonicalRevisionId: "canonical-user-beta",
      geometryHash,
      sceneContractId: "scene-user-beta",
      schemeId: "scheme-user-beta",
    },
    currentState: "p1_confirmed",
    userVisibleStage: "scheme_review",
    validation: {
      status: "valid",
      canConfirm: true,
      issueCount: 0,
      blockingIssueCount: 0,
    },
    nextActions: [
      {
        actionId: "open_scheme_page",
        label: "Open scheme page",
        method: "GET",
        href: "/api/beta/home-user-beta/bootstrap",
        enabled: true,
      },
    ],
    blockers: [],
    guardrails,
    updatedAt: timestamp,
  });
}

function createUploadResponse(): UploadFloorplanResponse {
  return UploadFloorplanResponseSchema.parse({
    ok: true,
    version: "0.1",
    source: "mock_contract_shell",
    homeId: "home-user-beta",
    assetId: "asset-user-beta",
    parseJobId: "parse-user-beta",
    draftRevisionId: "draft-user-beta",
    currentState: "p1_session_required",
    userMessage:
      "Fixture floorplan accepted as an untrusted draft; start P1 review before confirmation.",
    nextAction: {
      actionId: "open_p1_session",
      label: "Start P1 review session",
      method: "POST",
      href: "/api/p1/home-user-beta/session",
      enabled: true,
    },
    trace: {
      homeId: "home-user-beta",
      assetId: "asset-user-beta",
      parseJobId: "parse-user-beta",
      draftRevisionId: "draft-user-beta",
    },
    guardrails,
    generatedAt: timestamp,
  });
}
