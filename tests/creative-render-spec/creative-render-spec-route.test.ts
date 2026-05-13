import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCreativeRenderSpecFixtureInput } from "@homeai/creative-render-spec";
import { POST as postPreview } from "../../apps/web/app/api/dev/creative-render-spec/preview/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("CreativeRenderSpec dev preview route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns 404 in production without ENABLE_DEV_ROUTES before parsing body", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await postPreview(invalidJsonRequest());

    expect(response.status).toBe(404);
  });

  it("allows preview in production when ENABLE_DEV_ROUTES is true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";
    const input = createCreativeRenderSpecFixtureInput();
    const response = await postPreview(request({ input }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.debug.batch.specs).toHaveLength(input.scheme.rooms.length);
  });

  it("allows preview outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ENABLE_DEV_ROUTES;
    const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: true });
    const response = await postPreview(request({ input }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.debug.batch.layoutIntentHash).toBe(input.scheme.layoutIntentHash);
  });

  it("returns 400 for invalid request payloads", async () => {
    process.env.NODE_ENV = "test";

    const response = await postPreview(request({ invalid: true }));

    expect(response.status).toBe(400);
  });

  it("does not import P1 stores, ADS stores, persistence, or providers", () => {
    const routeText = readFileSync(
      join(process.cwd(), "apps", "web", "app", "api", "dev", "creative-render-spec", "preview", "route.ts"),
      "utf8"
    );

    expect(routeText).not.toMatch(/createInMemoryP1Repositories|Repository|persist|ads|provider|fetch\s*\(|axios/i);
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/dev/creative-render-spec/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/dev/creative-render-spec/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
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
