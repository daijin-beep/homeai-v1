import {
  P1UserFlowViewModelSchema,
  UploadFloorplanRequestSchema,
  UploadFloorplanResponseSchema,
  V1BetaHomeBootstrapSchema,
  type P1UserFlowViewModel,
  type UploadFloorplanResponse,
  type V1BetaHomeBootstrap,
  type V1BetaUserBackendGuardrails,
} from "@homeai/contracts";

const generatedAt = "2026-05-20T00:00:00.000Z";

function draftRevisionIdForHome(homeId: string): string {
  return `draft-api-${homeId}`;
}

const guardrails: V1BetaUserBackendGuardrails = {
  mockOnly: true,
  dbPersistenceEnabled: false,
  realProviderEnabled: false,
  networkCallsEnabled: false,
  authEnforced: false,
  confirmedGeometryMutable: false,
};

export function buildUserBetaBootstrap(
  homeId: string,
): V1BetaHomeBootstrap {
  const flow = buildP1UserFlowViewModel(homeId);
  return V1BetaHomeBootstrapSchema.parse({
    ok: true,
    version: "0.1",
    source: "mock_contract_shell",
    homeId,
    title: "homeAI user beta backend shell",
    flow,
    endpoints: {
      bootstrap: `/api/beta/${homeId}/bootstrap`,
      uploadFloorplan: `/api/beta/${homeId}/floorplan/upload`,
      p1Session: `/api/p1/${homeId}/session`,
      p1DraftViewModel: "/api/p1/drafts/{draftRevisionId}",
      p1Confirm: "/api/p1/drafts/{draftRevisionId}/confirm",
    },
    generatedAt,
  });
}

export async function handleUserBetaUpload(
  request: Request,
  homeId: string,
): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = UploadFloorplanRequestSchema.parse(body);
    return Response.json(buildUploadFloorplanResponse(homeId, parsed.uploadMode));
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown user beta upload shell error",
      },
      { status: 400 },
    );
  }
}

export function buildP1UserFlowViewModel(
  homeId: string,
): P1UserFlowViewModel {
  return P1UserFlowViewModelSchema.parse({
    version: "0.1",
    source: "mock_contract_shell",
    trace: {
      homeId,
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
        href: `/api/p1/${homeId}/session`,
        enabled: true,
      },
    ],
    blockers: [
      {
        code: "P1_SESSION_REQUIRED",
        message:
          "Start or load a real P1 session before evaluating or confirming a floorplan draft.",
        severity: "blocker",
        target: "p1Session",
      },
      {
        code: "AUTH_NOT_ENFORCED",
        message:
          "This shell is not production-ready because ownership checks are not enforced yet.",
        severity: "warning",
        target: "auth",
      },
    ],
    guardrails,
    updatedAt: generatedAt,
  });
}

export function buildUploadFloorplanResponse(
  homeId: string,
  uploadMode: "fixture_asset" | "file_asset_placeholder",
): UploadFloorplanResponse {
  const assetId = `asset-user-beta-${homeId}`;
  const parseJobId = `parse-user-beta-${homeId}`;
  const draftRevisionId = draftRevisionIdForHome(homeId);
  return UploadFloorplanResponseSchema.parse({
    ok: true,
    version: "0.1",
    source: "mock_contract_shell",
    homeId,
    assetId,
    parseJobId,
    draftRevisionId,
    currentState:
      uploadMode === "fixture_asset" ? "p1_session_required" : "parse_pending",
    userMessage:
      uploadMode === "fixture_asset"
        ? "Fixture floorplan accepted as an untrusted draft; start P1 review before confirmation."
        : "File placeholder accepted; parse job remains mocked and pending.",
    nextAction: {
      actionId: "open_p1_session",
      label: "Review floorplan",
      method: "POST",
      href: `/api/p1/${homeId}/session`,
      enabled: uploadMode === "fixture_asset",
      disabledReason:
        uploadMode === "fixture_asset"
          ? undefined
          : "Mock parser has not produced a draft yet.",
    },
    trace: {
      homeId,
      assetId,
      parseJobId,
      draftRevisionId,
    },
    guardrails,
    generatedAt,
  });
}
