import { describe, expect, it } from "vitest";
import { POST as postPreview } from "../../apps/web/app/api/dev/design-kernel/preview/route.js";
import { createDesignKernelFixtureBundle } from "../fixtures/design-kernel.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Design Kernel dev preview route", () => {
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
