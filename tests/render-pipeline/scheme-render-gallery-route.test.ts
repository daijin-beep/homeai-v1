import { afterEach, describe, expect, it } from "vitest";
import { GET as getPreview } from "../../apps/web/app/api/dev/scheme-render-gallery/preview/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("Scheme render gallery dev preview route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns gallery preview payload for valid scenarios", async () => {
    process.env.NODE_ENV = "test";
    const response = await getPreview(request("all_pass"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.galleryViewModel.summary.status).toBe("pass");
    expect(body.galleryViewModel.rooms).toHaveLength(body.inputSummary.validRoomCount);
    expect(body.scopeGuard.networkCalls).toBe(false);
  });

  it("returns failure state for missing room coverage", async () => {
    process.env.NODE_ENV = "test";
    const response = await getPreview(request("missing_room_coverage"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.galleryViewModel.summary.status).toBe("fail");
    expect(
      body.galleryViewModel.rooms.some((room: { renderStatus: string }) => room.renderStatus === "missing_coverage")
    ).toBe(true);
  });

  it("gates production unless dev routes are enabled", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    expect((await getPreview(request("all_pass"))).status).toBe(404);
  });

  it("allows production only when dev routes are explicitly enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";

    expect((await getPreview(request("all_pass"))).status).toBe(200);
  });

  it("rejects invalid scenarios", async () => {
    process.env.NODE_ENV = "test";

    expect((await getPreview(new Request("http://localhost/api/dev/scheme-render-gallery/preview?scenario=bad"))).status)
      .toBe(400);
  });
});

function request(scenario: string): Request {
  return new Request(`http://localhost/api/dev/scheme-render-gallery/preview?scenario=${scenario}`);
}

function restoreEnv(): void {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalEnableDevRoutes === undefined) {
    delete process.env.ENABLE_DEV_ROUTES;
  } else {
    process.env.ENABLE_DEV_ROUTES = originalEnableDevRoutes;
  }
}
