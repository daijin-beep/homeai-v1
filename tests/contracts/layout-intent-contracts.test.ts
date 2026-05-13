import { describe, expect, it } from "vitest";
import {
  AnchorPlannerInputContractSchema,
  FurniturePlaceholderSchema,
  LayoutIntentContractSchema,
  LayoutIntentRevisionSchema
} from "@homeai/contracts";
import {
  bedroomUserBedPlaceholder,
  layoutBedroomUserBed,
  layoutFixtureGeometryHash,
  layoutFixtureSceneContractId
} from "../fixtures/p1/layout-intent.js";

describe("Layout Intent contracts", () => {
  it("validates LayoutIntentRevision and rejects missing geometry trace fields", () => {
    expect(LayoutIntentRevisionSchema.safeParse(layoutBedroomUserBed).success).toBe(true);
    expect(LayoutIntentRevisionSchema.safeParse({ ...layoutBedroomUserBed, geometryHash: undefined }).success).toBe(false);
    expect(LayoutIntentRevisionSchema.safeParse({ ...layoutBedroomUserBed, sceneContractId: undefined }).success).toBe(false);
  });

  it("validates FurniturePlaceholder and rejects missing room/category drift", () => {
    expect(FurniturePlaceholderSchema.safeParse(bedroomUserBedPlaceholder).success).toBe(true);
    expect(FurniturePlaceholderSchema.safeParse({ ...bedroomUserBedPlaceholder, roomId: undefined }).success).toBe(false);
    expect(FurniturePlaceholderSchema.safeParse({ ...bedroomUserBedPlaceholder, category: "unsupported" }).success).toBe(false);
  });

  it("validates readonly LayoutIntentContract constraints", () => {
    const contract = {
      layoutIntentContractId: "layout-contract-test",
      homeId: layoutBedroomUserBed.homeId,
      canonicalRevisionId: layoutBedroomUserBed.canonicalRevisionId,
      sceneContractId: layoutBedroomUserBed.sceneContractId,
      geometryHash: layoutBedroomUserBed.geometryHash,
      layoutIntentRevisionId: layoutBedroomUserBed.layoutIntentRevisionId,
      layoutIntentHash: layoutBedroomUserBed.layoutIntentHash,
      aiAutofillEnabled: layoutBedroomUserBed.aiAutofillEnabled,
      readonly: true,
      placeholders: layoutBedroomUserBed.placeholders,
      constraints: {
        mayMutateGeometry: false,
        mayMutateSceneContract: false,
        placeholderCoordinatesAreFinalFurnitureCoordinates: false,
        placeholderSizesAreSkuSizes: false
      },
      createdAt: layoutBedroomUserBed.createdAt
    };

    expect(LayoutIntentContractSchema.safeParse(contract).success).toBe(true);
    expect(LayoutIntentContractSchema.safeParse({
      ...contract,
      constraints: { ...contract.constraints, mayMutateGeometry: true }
    }).success).toBe(false);
  });

  it("validates AnchorPlannerInputContract guardrails", () => {
    const graph = {
      affordanceGraphId: "affordance-layout-test",
      sceneContractId: layoutFixtureSceneContractId,
      homeId: layoutBedroomUserBed.homeId,
      canonicalRevisionId: layoutBedroomUserBed.canonicalRevisionId,
      geometryHash: layoutFixtureGeometryHash,
      source: "p1_confirmed_scene_contract",
      status: "pass",
      issues: [],
      createdAt: layoutBedroomUserBed.createdAt,
      rooms: [
        {
          roomId: bedroomUserBedPlaceholder.roomId,
          roomType: "living_room",
          status: "pass",
          issues: [],
          usableAreaMm2: 1000000,
          usableWallSegmentIds: [],
          usableWallSegments: [],
          blockedWallSegments: [],
          blockedOpeningIds: [],
          forbiddenZoneIds: [],
          forbiddenZones: [],
          circulationHints: [],
          circulationZones: [],
          candidateAnchorIds: ["anchor-layout-test"],
          anchorSurfaces: [
            {
              surfaceId: "surface-layout-test",
              type: "room_center",
              position: bedroomUserBedPlaceholder.center
            }
          ],
          candidateAnchors: [
            {
              anchorId: "anchor-layout-test",
              type: "room_center",
              position: bedroomUserBedPlaceholder.center,
              blocksDoorOrWindow: false
            }
          ]
        }
      ]
    };

    expect(AnchorPlannerInputContractSchema.safeParse({
      homeId: layoutBedroomUserBed.homeId,
      canonicalRevisionId: layoutBedroomUserBed.canonicalRevisionId,
      sceneContractId: layoutBedroomUserBed.sceneContractId,
      geometryHash: layoutBedroomUserBed.geometryHash,
      layoutIntentRevisionId: layoutBedroomUserBed.layoutIntentRevisionId,
      layoutIntentHash: layoutBedroomUserBed.layoutIntentHash,
      aiAutofillEnabled: true,
      roomAffordanceGraphs: [graph],
      userPlaceholders: layoutBedroomUserBed.placeholders,
      rules: {
        respectUserPlaceholders: true,
        verifyUserPlaceholders: true,
        mayAutofillMissingAnchors: true,
        mayMoveUserPlaceholders: false,
        mayMutateGeometry: false
      }
    }).success).toBe(true);
  });
});
