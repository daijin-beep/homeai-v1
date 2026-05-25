import { describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/beta/[homeId]/bootstrap/route.js";
import { POST } from "../../apps/web/app/api/beta/[homeId]/floorplan/upload/route.js";

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
    expect(body.currentState).toBe("draft_ready");
    expect(body.trace.homeId).toBe("home-route-beta");
    expect(body.trace.canonicalRevisionId).toBeUndefined();
    expect(body.trace.geometryHash).toBeUndefined();
    expect(body.nextAction.enabled).toBe(true);
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
