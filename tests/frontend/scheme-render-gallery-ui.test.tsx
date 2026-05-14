// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { buildSchemePageViewModelFromSchemeLite } from "@homeai/scheme-page";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";
import RenderGalleryDebugPage from "../../apps/web/app/dev/render-gallery-debug/page.js";
import { SchemePagePreview } from "../../apps/web/components/scheme-page/SchemePagePreview.js";
import { RoomRenderGallerySection } from "../../apps/web/components/scheme-render-gallery/RoomRenderGallerySection.js";

afterEach(() => {
  cleanup();
});

describe("Scheme render gallery UI", () => {
  it("renders the per-room status table for every room", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");

    render(<RoomRenderGallerySection gallery={debug.galleryViewModel} />);

    expect(screen.getByTestId("scheme-render-gallery-room-table")).toBeInTheDocument();
    for (const room of debug.galleryViewModel.rooms) {
      expect(screen.getByTestId(`scheme-render-gallery-room-${room.roomId}`)).toBeInTheDocument();
    }
  });

  it("renders eligible and blocked sections without treating failed candidates as gallery cards", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_window_missing_fail");
    const blocked = debug.galleryViewModel.rooms.flatMap((room) => room.blockedCandidates)[0];
    if (blocked === undefined) {
      throw new Error("Expected a blocked candidate fixture.");
    }

    render(<RoomRenderGallerySection gallery={debug.galleryViewModel} />);

    expect(screen.getByTestId("scheme-render-gallery-eligible-candidates")).toBeInTheDocument();
    expect(screen.getByTestId("scheme-render-gallery-blocked-candidates")).toHaveTextContent(blocked.renderCandidateId);
    expect(screen.queryByTestId(`eligible-render-card-${blocked.renderCandidateId}`)).not.toBeInTheDocument();
  });

  it("renders human review candidates", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("one_anchor_zone_warning");

    render(<RoomRenderGallerySection gallery={debug.galleryViewModel} />);

    expect(screen.getByTestId("scheme-render-gallery-review-candidates")).toHaveTextContent("human_review_required");
  });

  it("integrates with Scheme Page preview through shared contracts", () => {
    const debug = buildSchemeRenderGalleryDebugFixture("all_pass");
    const schemePage = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);

    render(<SchemePagePreview viewModel={schemePage} renderGalleryViewModel={debug.galleryViewModel} />);

    expect(screen.getByTestId("scheme-page-preview")).toBeInTheDocument();
    expect(screen.getByTestId("scheme-render-gallery-section")).toBeInTheDocument();
  });

  it("renders the dev debug page with scenario selector and raw payload", () => {
    render(<RenderGalleryDebugPage searchParams={{ scenario: "missing_room_coverage" }} />);

    expect(screen.getByText("Scheme Render Gallery Debug")).toBeInTheDocument();
    expect(screen.getByText("missing_room_coverage")).toBeInTheDocument();
    expect(screen.getAllByTestId("scheme-render-gallery-summary-status").every((node) => node.textContent === "fail"))
      .toBe(true);
  });
});
