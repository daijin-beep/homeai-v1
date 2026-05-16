import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/dev/v1-beta-fixture-harness/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("V1 Beta fixture harness dev route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns the deterministic beta fixture harness", async () => {
    process.env.NODE_ENV = "test";
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("deterministic_beta_fixture_harness");
    expect(body.summary.readyForBetaHarness).toBe(true);
    expect(body.guardrails.realProviderEnabled).toBe(false);
  });

  it("returns 404 in production without ENABLE_DEV_ROUTES", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await GET();

    expect(response.status).toBe(404);
  });
});

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
