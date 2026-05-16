import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "../../apps/web/app/api/dev/v1-beta-conversions/route.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalEnableDevRoutes = process.env.ENABLE_DEV_ROUTES;

describe("V1 Beta conversion dev route", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns mock-only conversion actions", async () => {
    process.env.NODE_ENV = "test";
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.paymentStartedMockEvent.eventType).toBe("payment_started_mock");
  });

  it("creates payment_started_mock events without real provider session", async () => {
    process.env.NODE_ENV = "test";
    const response = await POST(request({
      eventId: "event-payment-started-route",
      anonymousSessionId: "session-route"
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.event.eventType).toBe("payment_started_mock");
    expect(body.event.metadata.mode).toBe("mock");
  });

  it("returns 404 in production without ENABLE_DEV_ROUTES before parsing the body", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_DEV_ROUTES;

    const response = await POST(invalidJsonRequest());

    expect(response.status).toBe(404);
  });
});

function request(body: unknown): Request {
  return new Request("http://localhost/api/dev/v1-beta-conversions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function invalidJsonRequest(): Request {
  return new Request("http://localhost/api/dev/v1-beta-conversions", {
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
