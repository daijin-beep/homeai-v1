// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import VerifiedSkuDebugPage from "../../apps/web/app/dev/verified-sku-debug/page.js";

afterEach(() => {
  cleanup();
});

describe("Verified SKU debug page", () => {
  it("renders local fixture admission summary", () => {
    render(<VerifiedSkuDebugPage />);

    expect(
      screen.getByTestId("verified-sku-debug-page"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("verified-sku-summary"),
    ).toHaveTextContent("Admitted");
    expect(
      screen.getByTestId("verified-sku-summary"),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId("verified-sku-results-table"),
    ).toHaveTextContent("missing_price");
    expect(
      screen.getByTestId("verified-sku-results-table"),
    ).toHaveTextContent("unavailable");
  });
});
