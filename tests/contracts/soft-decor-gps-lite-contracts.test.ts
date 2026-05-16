import { describe, expect, it } from "vitest";
import { SoftDecorGpsLiteMatchSchema, SoftDecorGpsLitePlanSchema } from "@homeai/contracts";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import {
  buildSoftDecorGpsLitePlan,
  importVerifiedSkuCatalog,
  localRawSkuFixtures
} from "@homeai/soft-decor-gps";

describe("Soft Decor GPS Lite contracts", () => {
  it("validates a Lite plan built from admitted SKUs", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const catalog = importVerifiedSkuCatalog(localRawSkuFixtures);
    const plan = buildSoftDecorGpsLitePlan({ scheme, catalog });

    expect(SoftDecorGpsLitePlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.geometryHash).toBe(scheme.geometryHash);
    expect(plan.totalVerifiedSkuCount).toBe(catalog.verifiedSkus.length);
  });

  it("rejects match room trace drift", () => {
    const scheme = createSchemePageFixtureContract();
    const plan = buildSoftDecorGpsLitePlan({ scheme });
    const firstRoom = plan.rooms.find((room) => room.matches.length > 0);
    const firstMatch = firstRoom?.matches[0];
    if (firstRoom === undefined || firstMatch === undefined) {
      throw new Error("Expected a Lite match.");
    }

    expect(SoftDecorGpsLitePlanSchema.safeParse({
      ...plan,
      rooms: plan.rooms.map((room) =>
        room.roomId === firstRoom.roomId
          ? {
              ...room,
              matches: [
                {
                  ...firstMatch,
                  roomId: "other-room"
                },
                ...room.matches.slice(1)
              ]
            }
          : room
      )
    }).success).toBe(false);
  });

  it("rejects invalid Lite match scores", () => {
    const scheme = createSchemePageFixtureContract();
    const plan = buildSoftDecorGpsLitePlan({ scheme });
    const firstMatch = plan.rooms.flatMap((room) => room.matches)[0];
    if (firstMatch === undefined) {
      throw new Error("Expected a Lite match.");
    }

    expect(SoftDecorGpsLiteMatchSchema.safeParse({
      ...firstMatch,
      score: 1.2
    }).success).toBe(false);
  });
});
