// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import V1BetaFixtureHarnessPage from "../../apps/web/app/dev/v1-beta-fixture-harness/page.js";

afterEach(() => {
  cleanup();
});

describe("V1 Beta fixture harness debug page", () => {
  it("renders deterministic harness summary and guardrails", () => {
    render(<V1BetaFixtureHarnessPage />);

    expect(screen.getByTestId("v1-beta-fixture-harness-page")).toBeInTheDocument();
    expect(screen.getByTestId("v1-beta-fixture-summary")).toHaveTextContent("readyForBetaHarness");
    expect(screen.getByTestId("v1-beta-fixture-guardrails")).toHaveTextContent("realProviderEnabled");
    expect(screen.getByTestId("v1-beta-fixture-flow")).toHaveTextContent("Conversion intent");
  });
});
