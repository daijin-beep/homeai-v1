import type {
  FurniturePlaceholder,
  LayoutIntentRevision,
  LayoutIntentValidationState
} from "@homeai/contracts";
import { computeLayoutIntentHash } from "@homeai/floorplan-parser";
import { p1FixtureTimestamp } from "./index.js";

export const layoutFixtureGeometryHash = `sha256:${"1".repeat(64)}` as const;
export const layoutFixtureHomeId = "home-layout-fixture";
export const layoutFixtureCanonicalRevisionId = "canonical-layout-fixture";
export const layoutFixtureSceneContractId = "scene-layout-fixture";
export const layoutFixtureRoomId = "room-simple-living";

export const layoutValidValidation: LayoutIntentValidationState = {
  status: "valid",
  canConfirm: true,
  issues: [],
  validatedAt: p1FixtureTimestamp
};

export const bedroomUserBedPlaceholder = placeholder("placeholder-bedroom-bed", "room-simple-living", "bed", 1500, 1800);
export const livingRoomSofaPlaceholder = placeholder("placeholder-living-sofa", "room-simple-living", "sofa", 2200, 2500);
export const livingRoomTvPlaceholder = placeholder("placeholder-living-tv", "room-simple-living", "tv_console", 4200, 2500);
export const diningRoomTablePlaceholder = placeholder("placeholder-dining-table", "room-simple-living", "dining_table", 2600, 1800);
export const invalidMissingRoomPlaceholder = placeholder("placeholder-missing-room", "room-missing", "bed", 1500, 1800);
export const invalidOutsideRoomPlaceholder = placeholder("placeholder-outside-room", "room-simple-living", "sofa", 9000, 9000);
export const conflictDoorClearancePlaceholder = placeholder("placeholder-door-clearance", "room-simple-living", "shoe_cabinet", 2500, 3800);

export const layoutEmptyAutofillOn = layoutRevision("layout-empty-autofill-on", true, []);
export const layoutEmptyAutofillOff = layoutRevision("layout-empty-autofill-off", false, []);
export const layoutBedroomUserBed = layoutRevision("layout-bedroom-user-bed", true, [bedroomUserBedPlaceholder]);
export const layoutLivingRoomSofaTv = layoutRevision("layout-living-room-sofa-tv", true, [
  livingRoomSofaPlaceholder,
  livingRoomTvPlaceholder
]);
export const layoutDiningRoomTable = layoutRevision("layout-dining-room-table", true, [diningRoomTablePlaceholder]);
export const layoutInvalidMissingRoom = layoutRevision("layout-invalid-missing-room", true, [invalidMissingRoomPlaceholder]);
export const layoutInvalidOutsideRoom = layoutRevision("layout-invalid-outside-room", true, [invalidOutsideRoomPlaceholder]);
export const layoutConflictDoorClearance = layoutRevision("layout-conflict-door-clearance", true, [conflictDoorClearancePlaceholder]);
export const layoutHashStabilityFixture = layoutRevision("layout-hash-stability", true, [
  livingRoomTvPlaceholder,
  livingRoomSofaPlaceholder
]);

export const validLayoutIntentFixtures = {
  layout_empty_autofill_on: layoutEmptyAutofillOn,
  layout_empty_autofill_off: layoutEmptyAutofillOff,
  layout_bedroom_user_bed: layoutBedroomUserBed,
  layout_living_room_sofa_tv: layoutLivingRoomSofaTv,
  layout_dining_room_table: layoutDiningRoomTable,
  layout_hash_stability_fixture: layoutHashStabilityFixture
} as const;

export const invalidLayoutIntentFixtures = {
  layout_invalid_missing_room: layoutInvalidMissingRoom,
  layout_invalid_outside_room: layoutInvalidOutsideRoom,
  layout_conflict_door_clearance: layoutConflictDoorClearance
} as const;

function layoutRevision(
  layoutIntentRevisionId: string,
  aiAutofillEnabled: boolean,
  placeholders: FurniturePlaceholder[]
): LayoutIntentRevision {
  return {
    layoutIntentRevisionId,
    homeId: layoutFixtureHomeId,
    canonicalRevisionId: layoutFixtureCanonicalRevisionId,
    sceneContractId: layoutFixtureSceneContractId,
    geometryHash: layoutFixtureGeometryHash,
    layoutIntentHash: computeLayoutIntentHash({
      aiAutofillEnabled,
      placeholders
    }),
    revision: 1,
    source: "fixture",
    aiAutofillEnabled,
    placeholders,
    validation: layoutValidValidation,
    createdAt: p1FixtureTimestamp,
    updatedAt: p1FixtureTimestamp
  };
}

function placeholder(
  placeholderId: string,
  roomId: string,
  category: FurniturePlaceholder["category"],
  x: number,
  y: number
): FurniturePlaceholder {
  return {
    placeholderId,
    roomId,
    category,
    center: { x, y },
    rotationDeg: 0,
    displaySizeMm: category === "bed"
      ? { width: 1800, depth: 2000 }
      : category === "sofa"
        ? { width: 2200, depth: 900 }
        : { width: 1200, depth: 600 },
    sizeSource: "category_default",
    userResizable: true,
    source: "fixture",
    createdAt: p1FixtureTimestamp,
    updatedAt: p1FixtureTimestamp
  };
}
