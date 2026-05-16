import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/dev/verified-skus/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes =
  process.env.ENABLE_DEV_ROUTES;

describe("Verified SKU dev route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns local fixture catalog outside production", async () => {
    process.env.NODE_ENV = "test";
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.catalog.admittedCount).toBe(2);
    expect(body.catalog.rejectedCount).toBe(3);
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
