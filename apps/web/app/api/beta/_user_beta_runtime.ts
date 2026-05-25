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
      p1DraftViewModel: `/api/p1/drafts/${flow.trace.draftRevisionId}/view-model`,
      p1Confirm: `/api/p1/drafts/${flow.trace.draftRevisionId}/confirm`,
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
  const draftRevisionId = `draft-user-beta-${homeId}`;
  return P1UserFlowViewModelSchema.parse({
    version: "0.1",
    source: "mock_contract_shell",
    trace: {
      homeId,
      assetId: `asset-user-beta-${homeId}`,
      parseJobId: `parse-user-beta-${homeId}`,
      draftRevisionId,
    },
    currentState: "draft_ready",
    userVisibleStage: "space_confirmation",
    validation: {
      status: "valid",
      canConfirm: true,
      issueCount: 0,
      blockingIssueCount: 0,
    },
    nextActions: [
      {
        actionId: "open_p1_session",
        label: "Review floorplan",
        method: "POST",
        href: `/api/p1/${homeId}/session`,
        enabled: true,
      },
      {
        actionId: "confirm_space_truth",
        label: "Confirm Space Truth",
        method: "POST",
        href: `/api/p1/drafts/${draftRevisionId}/confirm`,
        enabled: true,
      },
    ],
    blockers: [
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
  const draftRevisionId = `draft-user-beta-${homeId}`;
  return UploadFloorplanResponseSchema.parse({
    ok: true,
    version: "0.1",
    source: "mock_contract_shell",
    homeId,
    assetId,
    parseJobId,
    draftRevisionId,
    currentState:
      uploadMode === "fixture_asset" ? "draft_ready" : "parse_pending",
    userMessage:
      uploadMode === "fixture_asset"
        ? "Fixture floorplan accepted and converted to an untrusted draft."
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
