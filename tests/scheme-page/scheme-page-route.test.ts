import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST as postPreview } from "../../apps/web/app/api/dev/scheme-page/preview/route.js";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("Scheme Page dev preview route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns 404 in production without ENABLE_DEV_ROUTES before parsing the body", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await postPreview(invalidJsonRequest());

    expect(response.status).toBe(404);
  });

  it("allows preview in production when ENABLE_DEV_ROUTES is true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";
    const scheme = createSchemePageFixtureContract();
    const response = await postPreview(request({ scheme }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.debug.viewModel.rooms).toHaveLength(scheme.rooms.length);
  });

  it("allows preview outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ENABLE_DEV_ROUTES;
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const response = await postPreview(request({ scheme }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.debug.trace.layoutIntentHash).toBe(scheme.layoutIntentHash);
  });

  it("returns 400 for invalid request payloads and trace mismatches", async () => {
    process.env.NODE_ENV = "test";
    const scheme = createSchemePageFixtureContract();
    const invalidPayload = await postPreview(request({ invalid: true }));
    const mismatch = await postPreview(request({
      scheme: {
        ...scheme,
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    }));

    expect(invalidPayload.status).toBe(400);
    expect(mismatch.status).toBe(400);
  });

  it("does not import P1 stores or persistence", () => {
    const routeText = readFileSync(
      join(process.cwd(), "apps", "web", "app", "api", "dev", "scheme-page", "preview", "route.ts"),
      "utf8"
    );

    expect(routeText).not.toMatch(/createInMemoryP1Repositories|_runtime|@homeai\/floorplan-parser|Repository|persist/i);
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/dev/scheme-page/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/dev/scheme-page/preview", {
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
