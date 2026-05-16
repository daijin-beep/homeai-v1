// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import SoftDecorGpsLiteDebugPage from "../../apps/web/app/dev/soft-decor-gps-lite-debug/page.js";

afterEach(() => {
  cleanup();
});

describe("Soft Decor GPS Lite debug page", () => {
  it("renders Lite matching from admitted SKUs", () => {
    render(<SoftDecorGpsLiteDebugPage />);

    expect(screen.getByTestId("soft-decor-gps-lite-debug-page")).toBeInTheDocument();
    expect(screen.getByTestId("soft-decor-gps-lite-summary")).toHaveTextContent("Verified SKUs");
    expect(screen.getByTestId("soft-decor-gps-lite-summary")).toHaveTextContent("2");
    expect(screen.getByTestId("soft-decor-gps-lite-room-room-living")).toHaveTextContent("sku-local-sofa-001");
  });
});
