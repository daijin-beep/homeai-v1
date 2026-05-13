import { describe, expect, it } from "vitest";
import { POST as postSession } from "../../apps/web/app/api/p1/[homeId]/session/route.js";
import { GET as getDraft } from "../../apps/web/app/api/p1/drafts/[draftRevisionId]/route.js";
import { PATCH as patchOperations } from "../../apps/web/app/api/p1/drafts/[draftRevisionId]/operations/route.js";

describe("P1 Next route runtime", () => {
  it("shares the in-memory draft repository across session, draft, and operations routes", async () => {
    const sessionResponse = await postSession(new Request("http://localhost/api/p1/route-runtime-home/session"), {
      params: { homeId: "route-runtime-home" }
    });
    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json() as { draftRevisionId: string };

    const draftResponse = await getDraft(
      new Request(`http://localhost/api/p1/drafts/${session.draftRevisionId}`),
      { params: { draftRevisionId: session.draftRevisionId } }
    );
    expect(draftResponse.status).toBe(200);

    const patchResponse = await patchOperations(
      new Request(`http://localhost/api/p1/drafts/${session.draftRevisionId}/operations`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operations: [
            {
              operationId: "op-route-runtime-thickness",
              operationType: "wall.thickness.change",
              targetType: "wall",
              targetId: "wall-demo-east",
              actor: "user",
              payload: { thicknessMm: 220 },
              createdAt: "2026-05-13T00:00:00.000Z"
            }
          ]
        })
      }),
      { params: { draftRevisionId: session.draftRevisionId } }
    );
    expect(patchResponse.status).toBe(200);
    const patched = await patchResponse.json() as {
      draft: { walls: Array<{ wallId: string; thicknessMm: number }> };
    };
    expect(patched.draft.walls.find((wall) => wall.wallId === "wall-demo-east")?.thicknessMm).toBe(220);
  });
});
