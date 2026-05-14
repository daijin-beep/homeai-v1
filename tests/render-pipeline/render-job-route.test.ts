import { afterEach, describe, expect, it } from "vitest";
import { GET as getPreview } from "../../apps/web/app/api/dev/render-job/preview/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("RenderJob dev preview route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns preview payload for all-pass scenario", async () => {
    process.env.NODE_ENV = "test";
    const response = await getPreview(request("all_pass"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.renderJob.coverage.validRoomCount).toBe(body.inputSummary.validRoomCount);
    expect(body.galleryEligibility.every((decision: { status: string }) => decision.status === "eligible")).toBe(true);
    expect(body.scopeGuard.networkCalls).toBe(false);
  });

  it("returns failure scenario payloads", async () => {
    process.env.NODE_ENV = "test";
    const response = await getPreview(request("one_window_missing_fail"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verificationReports.some((report: { status: string }) => report.status === "fail")).toBe(true);
    expect(body.galleryEligibility.some((decision: { status: string }) => decision.status === "blocked_failed_verification")).toBe(true);
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

  it("rejects unknown scenarios", async () => {
    process.env.NODE_ENV = "test";

    expect((await getPreview(new Request("http://localhost/api/dev/render-job/preview?scenario=bad"))).status).toBe(400);
  });
});

function request(scenario: string): Request {
  return new Request(`http://localhost/api/dev/render-job/preview?scenario=${scenario}`);
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
