import { afterEach, describe, expect, it } from "vitest";
import { POST as postPreview } from "../../apps/web/app/api/dev/design-kernel/preview/route.js";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("Design Kernel dev preview route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns 404 in production when ENABLE_DEV_ROUTES is unset before parsing JSON", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await postPreview(invalidJsonRequest());

    expect(response.status).toBe(404);
  });

  it("allows preview in production when ENABLE_DEV_ROUTES is true", async () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_DEV_ROUTES = "true";
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const response = await postPreview(request({ input }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.debug.scheme.geometryHash).toBe(input.geometryHash);
  });

  it("allows preview in non-production environments", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ENABLE_DEV_ROUTES;
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const response = await postPreview(request({ input }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.debug.scheme.sceneContractId).toBe(input.sceneContractId);
  });

  it("returns deterministic debug payload for valid input", async () => {
    const { input } = createDesignKernelFixtureBundle({ withLayoutIntent: true });
    const left = await postPreview(request({ input }));
    const right = await postPreview(request({ input }));
    const leftBody = await left.json();
    const rightBody = await right.json();

    expect(left.status).toBe(200);
    expect(leftBody.ok).toBe(true);
    expect(leftBody.debug.scheme).toEqual(rightBody.debug.scheme);
    expect(leftBody.debug.scheme.geometryHash).toBe(input.geometryHash);
    expect(leftBody.debug.scheme.sceneContractId).toBe(input.sceneContractId);
    expect(leftBody.debug.scheme.layoutIntentHash).toBe(input.layoutIntentHash);
    expect(leftBody.debug.trace.networkCalls).toBe(false);
  });

  it("returns 400 for invalid payloads when the route is enabled", async () => {
    process.env.NODE_ENV = "test";
    const response = await postPreview(request({ invalid: true }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("fails closed for mismatched trace input", async () => {
    const { input } = createDesignKernelFixtureBundle();
    const response = await postPreview(request({
      input: {
        ...input,
        geometryHash: `sha256:${"a".repeat(64)}`
      }
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/geometryHash|sceneContract/i);
  });

  it("does not import P1 runtime stores", () => {
    const routeText = readFileSync(
      join(process.cwd(), "apps", "web", "app", "api", "dev", "design-kernel", "preview", "route.ts"),
      "utf8"
    );

    expect(routeText).not.toMatch(/createInMemoryP1Repositories|_runtime|@homeai\/floorplan-parser|Repository/);
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/dev/design-kernel/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/dev/design-kernel/preview", {
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
