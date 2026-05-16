import { describe, expect, it } from "vitest";
import {
  assertSchemePageFullSpaceCoverage,
  buildSchemePageDebugPayload,
  buildSchemePageRenderStatusShell,
  buildSchemePageViewModelFromSchemeLite,
  verifySchemePageViewModel
} from "@homeai/scheme-page";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";

describe("Scheme Page view model builder", () => {
  it("builds an immutable full-space view model from SchemeLiteContract", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const snapshot = JSON.stringify(scheme);
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);

    expect(viewModel.rooms).toHaveLength(scheme.rooms.length);
    expect(viewModel.rooms.some((room) => room.roomType === "balcony")).toBe(true);
    expect(viewModel.trace.homeId).toBe(scheme.homeId);
    expect(viewModel.trace.floorplanRevisionId).toBe(scheme.floorplanRevisionId);
    expect(viewModel.trace.sceneContractId).toBe(scheme.sceneContractId);
    expect(viewModel.trace.geometryHash).toBe(scheme.geometryHash);
    expect(viewModel.trace.layoutIntentHash).toBe(scheme.layoutIntentHash);
    expect(Object.isFrozen(viewModel)).toBe(true);
    expect(() => {
      (viewModel.rooms as unknown as unknown[]).push({});
    }).toThrow();
    expect(JSON.stringify(scheme)).toBe(snapshot);
  });

  it("orders rooms deterministically and derives presentation depth", () => {
    const scheme = createSchemePageFixtureContract();
    const viewModel = buildSchemePageViewModelFromSchemeLite({
      ...scheme,
      rooms: [...scheme.rooms].reverse()
    });

    expect(viewModel.rooms.map((room) => room.roomId)).toEqual([
      "room-living",
      "room-kitchen",
      "room-primary",
      "room-study",
      "room-bath",
      "room-balcony",
      "room-corridor"
    ]);
    expect(viewModel.rooms.find((room) => room.roomId === "room-living")?.presentationDepth).toBe("primary");
    expect(viewModel.rooms.find((room) => room.roomId === "room-kitchen")?.presentationDepth).toBe("standard");
    expect(viewModel.rooms.find((room) => room.roomId === "room-balcony")?.presentationDepth).toBe("light");
  });

  it("preserves absence of layoutIntentHash", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: false });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);

    expect(viewModel.trace.layoutIntentHash).toBeUndefined();
    expect(viewModel.rooms.every((room) => room.trace.layoutIntentHash === undefined)).toBe(true);
  });

  it("surfaces deterministic warnings and actions without forbidden claims", () => {
    const scheme = createSchemePageFixtureContract({ withWarnings: true });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const serialized = JSON.stringify(viewModel);

    expect(viewModel.warnings.length).toBeGreaterThan(0);
    expect(viewModel.actions.map((action) => action.kind)).toEqual(expect.arrayContaining([
      "ready_for_render_spec_later",
      "needs_human_review"
    ]));
    expect(serialized).not.toMatch(/productUrl|checkout|payment|load-bearing|structural/i);
  });

  it("fails closed on coverage gaps and duplicate room cards", () => {
    const scheme = createSchemePageFixtureContract();
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const missing = {
      ...viewModel,
      coverage: {
        ...viewModel.coverage,
        totalRooms: viewModel.rooms.length - 1,
        primaryRooms: viewModel.rooms.slice(1).filter((room) => room.presentationDepth === "primary").length,
        standardRooms: viewModel.rooms.slice(1).filter((room) => room.presentationDepth === "standard").length,
        lightRooms: viewModel.rooms.slice(1).filter((room) => room.presentationDepth === "light").length
      },
      rooms: viewModel.rooms.slice(1)
    };
    const firstRoom = viewModel.rooms[0];
    if (firstRoom === undefined) {
      throw new Error("Expected room card.");
    }
    const duplicateRooms = [firstRoom, firstRoom, ...viewModel.rooms.slice(2)];
    const duplicate = {
      ...viewModel,
      coverage: {
        ...viewModel.coverage,
        primaryRooms: duplicateRooms.filter((room) => room.presentationDepth === "primary").length,
        standardRooms: duplicateRooms.filter((room) => room.presentationDepth === "standard").length,
        lightRooms: duplicateRooms.filter((room) => room.presentationDepth === "light").length
      },
      rooms: duplicateRooms
    };

    expect(verifySchemePageViewModel(missing, scheme).status).toBe("fail");
    expect(() => assertSchemePageFullSpaceCoverage(missing, scheme)).toThrow();
    expect(verifySchemePageViewModel(duplicate, scheme).status).toBe("fail");
  });

  it("builds a debug payload with scheme trace and coverage", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const debug = buildSchemePageDebugPayload({ scheme });

    expect(debug.request.schemeId).toBe(scheme.schemeId);
    expect(debug.trace.geometryHash).toBe(scheme.geometryHash);
    expect(debug.coverage.totalRooms).toBe(scheme.rooms.length);
    expect(debug.renderStatusShell.summary.notStartedRooms).toBe(scheme.rooms.length);
    expect(debug.viewModel.rooms).toHaveLength(scheme.rooms.length);
    expect(debug.pageVerification.status).not.toBe("fail");
  });

  it("builds a render status shell without runtime ADS inputs", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);
    const shell = buildSchemePageRenderStatusShell({ viewModel });

    expect(shell.source).toBe("view_model");
    expect(shell.trace.geometryHash).toBe(viewModel.trace.geometryHash);
    expect(shell.summary.status).toBe("not_started");
    expect(shell.summary.notStartedRooms).toBe(viewModel.rooms.length);
    expect(shell.rooms.every((room) => room.renderStatus === "not_started")).toBe(true);
    expect(JSON.stringify(shell)).not.toMatch(/render-snapshot|render-human-review|ads-runtime|provider/i);
  });

  it("maps deterministic gallery fixture statuses into the Scheme Page shell", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_anchor_zone_warning");
    const viewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);
    const shell = buildSchemePageRenderStatusShell({
      viewModel,
      renderGalleryViewModel: debug.galleryViewModel
    });

    expect(shell.source).toBe("deterministic_fixture");
    expect(shell.summary.status).toBe("needs_review");
    expect(shell.summary.roomsNeedingHumanReview).toBe(1);
    expect(shell.rooms.some((room) => room.renderStatus === "human_review_required")).toBe(true);
  });

  it("fails closed when render gallery trace does not match Scheme Page trace", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const viewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);

    expect(() => buildSchemePageRenderStatusShell({
      viewModel,
      renderGalleryViewModel: {
        ...debug.galleryViewModel,
        geometryHash: `sha256:${"f".repeat(64)}`
      }
    })).toThrow(/trace does not match/i);
  });
});
