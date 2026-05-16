// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import V1BetaConversionsDebugPage from "../../apps/web/app/dev/v1-beta-conversions-debug/page.js";

afterEach(() => {
  cleanup();
});

describe("V1 Beta conversions debug page", () => {
  it("renders mock actions and payment started mock event", () => {
    render(<V1BetaConversionsDebugPage />);

    expect(screen.getByTestId("v1-beta-conversions-debug-page")).toBeInTheDocument();
    expect(screen.getByTestId("v1-beta-conversion-actions")).toHaveTextContent("Start payment mock");
    expect(screen.getByTestId("v1-beta-payment-started-mock-event")).toHaveTextContent("payment_started_mock");
  });
});
