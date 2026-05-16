import { describe, expect, it } from "vitest";
import { buildV1BetaFixtureHarness } from "@homeai/v1-beta-fixtures";

describe("V1 Beta deterministic fixture harness", () => {
  it("stitches the beta flow from deterministic local fixtures only", () => {
    const harness = buildV1BetaFixtureHarness();

    expect(harness.flow.guardrails.deterministicFixturesOnly).toBe(true);
    expect(harness.guardrails.adsRuntimeConsumed).toBe(false);
    expect(harness.guardrails.adsSnapshotRuntimeConsumed).toBe(false);
    expect(harness.guardrails.humanReviewRuntimeConsumed).toBe(false);
    expect(harness.guardrails.networkCallsEnabled).toBe(false);
    expect(harness.summary.schemeRoomCount).toBe(harness.schemePageViewModel.rooms.length);
    expect(harness.summary.renderStatusRoomCount).toBe(harness.renderStatusShell.rooms.length);
    expect(harness.summary.creativeRenderSpecCount).toBe(harness.creativeRenderSpecBatch.specs.length);
    expect(harness.summary.verifiedSkuCount).toBe(harness.verifiedSkuCatalog.verifiedSkus.length);
  });

  it("keeps every included artifact on the same confirmed geometry trace", () => {
    const harness = buildV1BetaFixtureHarness();
    const expected = harness.trace;

    expect(harness.flow.geometryHash).toBe(expected.geometryHash);
    expect(harness.schemePageViewModel.trace.geometryHash).toBe(expected.geometryHash);
    expect(harness.renderStatusShell.trace.geometryHash).toBe(expected.geometryHash);
    expect(harness.renderGalleryViewModel.geometryHash).toBe(expected.geometryHash);
    expect(harness.creativeRenderSpecBatch.geometryHash).toBe(expected.geometryHash);
    expect(harness.softDecorPlan.geometryHash).toBe(expected.geometryHash);
    expect(harness.conversionActionSet.geometryHash).toBe(expected.geometryHash);
    expect(harness.events.every((event) => event.geometryHash === expected.geometryHash)).toBe(true);
  });

  it("includes mock conversion intent without live commerce", () => {
    const harness = buildV1BetaFixtureHarness();

    expect(harness.conversionActionSet.actions.some((action) => action.type === "payment_started_mock")).toBe(true);
    expect(harness.events.some((event) => event.eventType === "payment_started_mock")).toBe(true);
    expect(harness.guardrails.liveCommerceEnabled).toBe(false);
  });
});
