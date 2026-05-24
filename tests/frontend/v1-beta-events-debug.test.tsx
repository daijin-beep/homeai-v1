// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import V1BetaEventsDebugPage from "../../apps/web/app/dev/v1-beta-events-debug/page.js";

afterEach(() => {
  cleanup();
});

describe("V1 Beta events debug page", () => {
  it("renders deterministic local event summary and table", () => {
    render(<V1BetaEventsDebugPage />);

    expect(screen.getByTestId("v1-beta-events-debug-page")).toBeInTheDocument();
    expect(screen.getByTestId("v1-beta-events-summary")).toHaveTextContent(
      "Total events",
    );
    expect(screen.getByTestId("v1-beta-events-summary")).toHaveTextContent("4");
    expect(screen.getByTestId("v1-beta-events-table")).toHaveTextContent(
      "render_room_status_opened",
    );
  });
});
