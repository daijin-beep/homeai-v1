import { describe, expect, it } from "vitest";
import {
  SchemePageRenderRoomStatusSchema,
  SchemePageRenderStatusShellSchema,
  SchemePageRoomCardSchema,
  SchemePageViewModelSchema
} from "@homeai/contracts";
import {
  buildSchemePageRenderStatusShell,
  buildSchemePageViewModelFromSchemeLite,
  verifySchemePageViewModel
} from "@homeai/scheme-page";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";
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

  it("validates the Scheme Page render status shell from deterministic view models", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const viewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);
    const shell = buildSchemePageRenderStatusShell({
      viewModel,
      renderGalleryViewModel: debug.galleryViewModel
    });

    expect(SchemePageRenderStatusShellSchema.safeParse(shell).success).toBe(true);
    expect(shell.source).toBe("deterministic_fixture");
    expect(shell.summary.status).toBe("ready");
    expect(shell.summary.roomsWithEligibleRender).toBe(viewModel.rooms.length);
    expect(shell.rooms.every((room) => room.renderStatus === "has_eligible_render")).toBe(true);
  });

  it("rejects inconsistent render status shell counts", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const viewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);
    const shell = buildSchemePageRenderStatusShell({
      viewModel,
      renderGalleryViewModel: debug.galleryViewModel
    });
    const firstRoom = shell.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected render status room.");
    }

    expect(SchemePageRenderStatusShellSchema.safeParse({
      ...shell,
      summary: {
        ...shell.summary,
        roomsWithEligibleRender: 0
      }
    }).success).toBe(false);
    expect(SchemePageRenderRoomStatusSchema.safeParse({
      ...firstRoom,
      eligibleCandidateCount: 0
    }).success).toBe(false);
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
