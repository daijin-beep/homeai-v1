import { afterEach, describe, expect, it } from "vitest";
import {
  GET,
  POST,
  resetV1BetaEventDevRepositoryForTests
} from "../../apps/web/app/api/dev/v1-beta-events/route.js";
import { createV1BetaEventFixture } from "@homeai/analytics";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("V1 Beta event dev route", () => {
  afterEach(() => {
    resetV1BetaEventDevRepositoryForTests();
    restoreEnv();
  });

  it("returns deterministic debug events outside production", async () => {
    process.env.NODE_ENV = "test";
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary.totalEvents).toBe(4);
  });

  it("accepts local intake events and updates repository summary", async () => {
    process.env.NODE_ENV = "test";
    const response = await POST(request({
      events: [
        createV1BetaEventFixture({
          eventId: "event-route-stage-viewed",
          eventType: "beta_stage_viewed",
          stageId: "render_review",
          source: "dev_intake"
        })
      ]
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.acceptedCount).toBe(1);
    expect(body.totalStored).toBe(5);
    expect(body.summary.eventTypes.beta_stage_viewed).toBe(2);
  });

  it("rejects invalid intake payloads", async () => {
    process.env.NODE_ENV = "test";
    const response = await POST(request({ invalid: true }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("returns 404 in production without ENABLE_DEV_ROUTES before parsing the body", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await POST(invalidJsonRequest());

    expect(response.status).toBe(404);
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/dev/v1-beta-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/dev/v1-beta-events", {
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
