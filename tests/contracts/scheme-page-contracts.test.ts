import { describe, expect, it } from "vitest";
import {
  SchemePageRoomCardSchema,
  SchemePageViewModelSchema
} from "@homeai/contracts";
import {
  buildSchemePageViewModelFromSchemeLite,
  verifySchemePageViewModel
} from "@homeai/scheme-page";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import type { SchemePageRoomCard, SchemePageViewModel } from "@homeai/contracts";

describe("Scheme Page contracts", () => {
  it("validates a SchemePageViewModel and preserves layoutIntentHash", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);

    expect(SchemePageViewModelSchema.safeParse(viewModel).success).toBe(true);
    expect(viewModel.trace.geometryHash).toBe(scheme.geometryHash);
    expect(viewModel.trace.layoutIntentHash).toBe(scheme.layoutIntentHash);
    expect(viewModel.rooms.every((room) => room.trace.layoutIntentHash === scheme.layoutIntentHash)).toBe(true);
  });

  it("rejects missing geometryHash, trace mismatch, and invalid presentationDepth", () => {
    const scheme = createSchemePageFixtureContract();
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const firstRoom = viewModel.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected room card.");
    }

    expect(SchemePageViewModelSchema.safeParse({
      ...viewModel,
      trace: { ...viewModel.trace, geometryHash: undefined }
    }).success).toBe(false);
    expect(SchemePageViewModelSchema.safeParse({
      ...viewModel,
      rooms: [
        {
          ...firstRoom,
          trace: {
            ...firstRoom.trace,
            geometryHash: `sha256:${"f".repeat(64)}`
          }
        },
        ...viewModel.rooms.slice(1)
      ]
    }).success).toBe(false);
    expect(SchemePageRoomCardSchema.safeParse({
      ...firstRoom,
      presentationDepth: "hero"
    }).success).toBe(false);
  });

  it("flags missing and duplicate room cards through the verifier", () => {
    const scheme = createSchemePageFixtureContract();
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const firstRoom = viewModel.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected room card.");
    }
    const missing = withRooms(viewModel, viewModel.rooms.slice(1));
    const duplicate = withRooms(viewModel, [firstRoom, firstRoom, ...viewModel.rooms.slice(2)]);

    expect(verifySchemePageViewModel(missing, scheme).status).toBe("fail");
    expect(verifySchemePageViewModel(duplicate, scheme).status).toBe("fail");
  });

  it("rejects forbidden product and image-like fields through strict schemas", () => {
    const scheme = createSchemePageFixtureContract();
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const firstRoom = viewModel.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected room card.");
    }

    expect(SchemePageRoomCardSchema.safeParse({ ...firstRoom, productUrl: "https://example.invalid" }).success).toBe(false);
    expect(SchemePageRoomCardSchema.safeParse({ ...firstRoom, skuId: "sku-test" }).success).toBe(false);
    expect(SchemePageRoomCardSchema.safeParse({ ...firstRoom, renderUrl: "https://example.invalid/image.png" }).success).toBe(false);
  });
});

function withRooms(viewModel: SchemePageViewModel, rooms: SchemePageRoomCard[]): SchemePageViewModel {
  return SchemePageViewModelSchema.parse({
    ...viewModel,
    coverage: {
      ...viewModel.coverage,
      totalRooms: rooms.length,
      primaryRooms: rooms.filter((room) => room.presentationDepth === "primary").length,
      standardRooms: rooms.filter((room) => room.presentationDepth === "standard").length,
      lightRooms: rooms.filter((room) => room.presentationDepth === "light").length
    },
    rooms
  });
}
