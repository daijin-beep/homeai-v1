import { describe, expect, it } from "vitest";
import { SchemeRenderGalleryViewModelSchema } from "@homeai/contracts";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";

describe("Scheme render gallery contracts", () => {
  it("accepts a valid gallery view model", () => {
    const fixture = buildSchemeRenderGalleryDebugFixture("all_pass");

    expect(SchemeRenderGalleryViewModelSchema.safeParse(fixture.galleryViewModel).success).toBe(true);
  });

  it("rejects invalid room render statuses", () => {
    const fixture = buildSchemeRenderGalleryDebugFixture("all_pass");
    const invalid = {
      ...fixture.galleryViewModel,
      rooms: [
        {
          ...fixture.galleryViewModel.rooms[0],
          renderStatus: "verified"
        },
        ...fixture.galleryViewModel.rooms.slice(1)
      ]
    };

    expect(SchemeRenderGalleryViewModelSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires geometryHash", () => {
    const fixture = buildSchemeRenderGalleryDebugFixture("all_pass");
    const { geometryHash: _geometryHash, ...invalid } = fixture.galleryViewModel;

    expect(SchemeRenderGalleryViewModelSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects forbidden final coordinate fields on candidate cards", () => {
    const fixture = buildSchemeRenderGalleryDebugFixture("all_pass");
    const firstRoom = fixture.galleryViewModel.rooms[0];
    const firstCandidate = firstRoom?.eligibleCandidates[0];
    if (firstRoom === undefined || firstCandidate === undefined) {
      throw new Error("Expected an eligible candidate fixture.");
    }
    const invalid = {
      ...fixture.galleryViewModel,
      rooms: [
        {
          ...firstRoom,
          eligibleCandidates: [
            {
              ...firstCandidate,
              finalFurnitureCoordinates: [{ x: 100, y: 200 }]
            },
            ...firstRoom.eligibleCandidates.slice(1)
          ]
        },
        ...fixture.galleryViewModel.rooms.slice(1)
      ]
    };

    expect(SchemeRenderGalleryViewModelSchema.safeParse(invalid).success).toBe(false);
  });
});
