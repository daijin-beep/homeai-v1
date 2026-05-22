// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import V1BetaPage from "../../apps/web/app/beta/page.js";
import {
  V1BetaFlowShell,
  buildV1BetaFlowShellFixture,
} from "../../apps/web/components/v1-beta-flow/V1BetaFlowShell.js";

afterEach(() => {
  cleanup();
});

describe("V1 Beta flow shell", () => {
  it("renders deterministic flow stages and Scheme Page status", () => {
    const fixture = buildV1BetaFlowShellFixture();

    render(<V1BetaFlowShell fixture={fixture} />);

    expect(screen.getByTestId("v1-beta-flow-shell")).toBeInTheDocument();
    expect(screen.getByTestId("v1-beta-flow-status")).toHaveTextContent(
      "needs_review",
    );
    expect(
      screen.getByTestId("v1-beta-flow-stage-floorplan_upload"),
    ).toHaveTextContent("complete");
    expect(
      screen.getByTestId("v1-beta-flow-stage-render_review"),
    ).toHaveTextContent("current");
    expect(
      screen.getByTestId("v1-beta-flow-stage-decor_matching"),
    ).toHaveTextContent("locked");
    expect(
      screen.getByTestId("scheme-page-render-status-shell"),
    ).toHaveAttribute("data-source", "deterministic_fixture");
    expect(
      screen.getByTestId("scheme-render-gallery-section"),
    ).toBeInTheDocument();
  });

  it("exposes guardrails as false for runtime and provider paths", () => {
    render(<V1BetaFlowShell />);

    expect(screen.getByTestId("v1-beta-flow-guardrails")).toHaveTextContent(
      "adsRuntimeConsumed",
    );
    expect(screen.getByTestId("v1-beta-flow-guardrails")).toHaveTextContent(
      "false",
    );
    expect(screen.getByTestId("v1-beta-flow-guardrails")).toHaveTextContent(
      "deterministicFixturesOnly",
    );
    expect(screen.getByTestId("v1-beta-flow-guardrails")).toHaveTextContent(
      "true",
    );
  });

  it("renders the /beta route shell", () => {
    render(<V1BetaPage />);

    expect(screen.getByTestId("v1-beta-flow-shell")).toBeInTheDocument();
    expect(screen.getByText("homeAI V1 Beta flow")).toBeInTheDocument();
  });
});
