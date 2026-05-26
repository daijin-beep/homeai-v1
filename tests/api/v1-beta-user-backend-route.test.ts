import { describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/beta/[homeId]/bootstrap/route.js";
import { POST } from "../../apps/web/app/api/beta/[homeId]/floorplan/upload/route.js";
import { POST as POST_P1_SESSION } from "../../apps/web/app/api/p1/[homeId]/session/route.js";
import { GET as GET_P1_DRAFT } from "../../apps/web/app/api/p1/drafts/[draftRevisionId]/route.js";
import { POST as POST_P1_CONFIRM } from "../../apps/web/app/api/p1/drafts/[draftRevisionId]/confirm/route.js";

describe("V1 Beta user backend route shell", () => {
  it("returns a mock bootstrap view model for a home", async () => {
    const response = await GET(request("/bootstrap"), {
      params: { homeId: "home-route-beta" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.homeId).toBe("home-route-beta");
    expect(body.flow.trace.homeId).toBe("home-route-beta");
    expect(body.flow.guardrails.mockOnly).toBe(true);
    expect(body.flow.guardrails.dbPersistenceEnabled).toBe(false);
    expect(body.flow.guardrails.authEnforced).toBe(false);
    expect(body.flow.guardrails.confirmedGeometryMutable).toBe(false);
    expect(body.flow.currentState).toBe("p1_session_required");
    expect(body.flow.validation).toEqual({
      status: "not_evaluable",
      canConfirm: false,
      issueCount: 0,
      blockingIssueCount: 1,
    });
    expect(body.flow.trace.draftRevisionId).toBeUndefined();
    expect(body.flow.trace.canonicalRevisionId).toBeUndefined();
    expect(body.flow.trace.geometryHash).toBeUndefined();
  });

  it("beta bootstrap cannot advertise a confirmable draft before P1 session", async () => {
    const response = await GET(request("/bootstrap"), {
      params: { homeId: "home-route-beta" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.flow.currentState).not.toBe("draft_ready");
    expect(body.flow.validation.status).toBe("not_evaluable");
    expect(body.flow.validation.canConfirm).toBe(false);
    expect(body.flow.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "P1_SESSION_REQUIRED",
          severity: "blocker",
        }),
      ]),
    );
    expect(body.flow.trace.draftRevisionId).toBeUndefined();
    expect(body.flow.trace.canonicalRevisionId).toBeUndefined();
    expect(body.flow.trace.geometryHash).toBeUndefined();
  });

  it("accepts fixture upload shell requests and returns draft trace only", async () => {
    const response = await POST(
      request("/floorplan/upload", {
        uploadMode: "fixture_asset",
        fixtureKey: "one-bedroom",
      }),
      { params: { homeId: "home-route-beta" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.currentState).toBe("p1_session_required");
    expect(body.trace.homeId).toBe("home-route-beta");
    expect(body.trace.canonicalRevisionId).toBeUndefined();
    expect(body.trace.geometryHash).toBeUndefined();
    expect(body.nextAction.enabled).toBe(true);
    expect(body.userMessage).toContain("untrusted draft");
  });

  it("upload response remains an untrusted draft next-action, not a valid canonical draft", async () => {
    const response = await POST(
      request("/floorplan/upload", {
        uploadMode: "fixture_asset",
        fixtureKey: "one-bedroom",
      }),
      { params: { homeId: "home-route-beta" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.currentState).toBe("p1_session_required");
    expect(body.validation).toBeUndefined();
    expect(body.trace.draftRevisionId).toBeDefined();
    expect(body.trace.canonicalRevisionId).toBeUndefined();
    expect(body.trace.geometryHash).toBeUndefined();
    expect(body.nextAction).toEqual(
      expect.objectContaining({
        actionId: "open_p1_session",
        enabled: true,
      }),
    );
  });

  it("keeps file placeholder uploads pending until mocked parse output exists", async () => {
    const response = await POST(
      request("/floorplan/upload", {
        uploadMode: "file_asset_placeholder",
        fileName: "floorplan.png",
      }),
      { params: { homeId: "home-route-beta" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.currentState).toBe("parse_pending");
    expect(body.nextAction.enabled).toBe(false);
    expect(body.nextAction.disabledReason).toContain("Mock parser");
  });

  it("advertises P1 endpoints that resolve through the mock route chain", async () => {
    const homeId = "home-route-chain";
    const bootstrapResponse = await GET(request("/bootstrap"), {
      params: { homeId },
    });
    const bootstrap = await bootstrapResponse.json();

    expect(bootstrap.flow.trace.draftRevisionId).toBeUndefined();
    expect(bootstrap.flow.nextActions).toEqual([
      expect.objectContaining({
        actionId: "open_p1_session",
        href: `/api/p1/${homeId}/session`,
        enabled: true,
      }),
    ]);
    expect(bootstrap.endpoints.p1Session).toBe(`/api/p1/${homeId}/session`);
    expect(bootstrap.endpoints.p1DraftViewModel).toBe(
      "/api/p1/drafts/{draftRevisionId}",
    );
    expect(bootstrap.endpoints.p1Confirm).toBe(
      "/api/p1/drafts/{draftRevisionId}/confirm",
    );

    const sessionResponse = await POST_P1_SESSION(request("/p1/session"), {
      params: { homeId },
    });
    const session = await sessionResponse.json();
    const draftRevisionId = session.draftRevisionId;
    expect(sessionResponse.status).toBe(200);
    expect(draftRevisionId).toContain(`draft-session-${homeId}`);

    const draftResponse = await GET_P1_DRAFT(request("/p1/draft"), {
      params: { draftRevisionId },
    });
    const draft = await draftResponse.json();
    expect(draftResponse.status).toBe(200);
    expect(draft.draft.draftRevisionId).toBe(draftRevisionId);

    const confirmResponse = await POST_P1_CONFIRM(request("/p1/confirm"), {
      params: { draftRevisionId },
    });
    const confirmed = await confirmResponse.json();
    expect(confirmResponse.status).toBe(200);
    expect(confirmed.ok).toBe(true);
    expect(confirmed.canonicalRevisionId).toBeDefined();
    expect(confirmed.geometryHash).toBeDefined();
    expect(confirmed.sceneContractId).toBeDefined();
  });

  it("rejects malformed upload shell requests", async () => {
    const response = await POST(
      request("/floorplan/upload", { uploadMode: "fixture_asset" }),
      { params: { homeId: "home-route-beta" } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});

function request(path: string, body?: unknown): Request {
  return new Request(`http://localhost/api/beta/home-route-beta${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
