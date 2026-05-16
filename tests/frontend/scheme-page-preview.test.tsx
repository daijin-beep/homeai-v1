// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { buildSchemePageViewModelFromSchemeLite } from "@homeai/scheme-page";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";
import { SchemePagePreview } from "../../apps/web/components/scheme-page/SchemePagePreview.js";

afterEach(() => {
  cleanup();
});

describe("Scheme Page preview components", () => {
  it("renders every SchemeLite room card including balcony", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true, withWarnings: true });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);

    render(<SchemePagePreview viewModel={viewModel} />);

    expect(screen.getByTestId("scheme-page-preview")).toBeInTheDocument();
    for (const room of viewModel.rooms) {
      expect(screen.getByTestId(`scheme-room-card-${room.roomId}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("scheme-room-card-room-balcony")).toHaveTextContent("balcony");
    expect(screen.getByTestId("scheme-coverage")).toHaveTextContent(String(viewModel.rooms.length));
    expect(screen.getByTestId("scheme-page-render-status-shell")).toHaveAttribute("data-source", "view_model");
    expect(screen.getByTestId("scheme-page-render-status-summary")).toHaveTextContent("not_started");
    for (const room of viewModel.rooms) {
      expect(screen.getByTestId(`scheme-page-render-status-room-${room.roomId}`)).toHaveTextContent("not_started");
    }
  });

  it("renders warnings and trace panel in debug context without unsupported user-facing claims", () => {
    const scheme = createSchemePageFixtureContract({ withLayoutIntent: true, withWarnings: true });
    const viewModel = buildSchemePageViewModelFromSchemeLite(scheme);

    render(<SchemePagePreview viewModel={viewModel} showDebug />);

    expect(screen.getByTestId("scheme-warnings")).toHaveTextContent("Corridor");
    expect(screen.getByTestId("scheme-trace-panel")).toHaveTextContent(viewModel.trace.geometryHash);
    expect(screen.getByTestId("scheme-debug-json")).toBeInTheDocument();
    expect(screen.queryByText(/checkout|payment|productUrl|providerName|imageUrl|load-bearing|structural/i)).not.toBeInTheDocument();
  });

  it("renders deterministic render gallery statuses through the Scheme Page shell", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_window_missing_fail");
    const viewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);
    const failedRoom = debug.galleryViewModel.rooms.find((room) => room.renderStatus === "failed");
    if (failedRoom === undefined) {
      throw new Error("Expected failed render status fixture.");
    }

    render(<SchemePagePreview viewModel={viewModel} renderGalleryViewModel={debug.galleryViewModel} />);

    expect(screen.getByTestId("scheme-page-render-status-shell")).toHaveAttribute("data-source", "deterministic_fixture");
    expect(screen.getByTestId("scheme-page-render-status-summary")).toHaveTextContent("blocked");
    expect(screen.getByTestId(`scheme-page-render-status-room-${failedRoom.roomId}`)).toHaveTextContent("failed");
    expect(screen.getByTestId("scheme-render-gallery-section")).toBeInTheDocument();
  });
});
