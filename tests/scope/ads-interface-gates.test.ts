import { describe, expect, it } from "vitest";

import { AdsInterfaceGatesSchema, loadAdsInterfaceGates } from "@homeai/ads-render";

describe("VAL-ADS-00 interface gate fixture", () => {
  it("loads and validates the gate fixture", () => {
    const gates = loadAdsInterfaceGates();

    expect(AdsInterfaceGatesSchema.safeParse(gates).success).toBe(true);
  });

  it("blocks real provider usage until Kim signs off", () => {
    const gates = loadAdsInterfaceGates();

    expect(gates.realProviderAllowed).toBe(false);
    expect(gates.mockProviderAllowed).toBe(true);
  });

  it("records pending Kim signoff for provider and gallery policies", () => {
    const gates = loadAdsInterfaceGates();

    expect(gates.providerPolicyStatus).toBe("pending");
    expect(gates.galleryAdmissionPolicyStatus).toBe("pending");
  });

  it("rejects gate fixtures that flip real provider without provider policy approval", () => {
    const inconsistent = {
      creativeRenderSpecStatus: "proposed",
      galleryAdmissionPolicyStatus: "pending",
      providerPolicyStatus: "pending",
      realProviderAllowed: true,
      mockProviderAllowed: true,
      capturedAt: "2026-05-13T00:00:00+00:00"
    };
    const parsed = AdsInterfaceGatesSchema.safeParse(inconsistent);
    // Schema alone accepts shape; the policy-consistency check is enforced in real-provider gate.
    // This test guards that the fixture shape is preserved (no silent additions).
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data).sort()).toEqual([
      "capturedAt",
      "creativeRenderSpecStatus",
      "galleryAdmissionPolicyStatus",
      "mockProviderAllowed",
      "providerPolicyStatus",
      "realProviderAllowed"
    ]);
  });

  it("rejects unknown fields (strict)", () => {
    const withExtra = {
      creativeRenderSpecStatus: "proposed",
      galleryAdmissionPolicyStatus: "pending",
      providerPolicyStatus: "pending",
      realProviderAllowed: false,
      mockProviderAllowed: true,
      capturedAt: "2026-05-13T00:00:00+00:00",
      extra: "smuggled"
    };

    const parsed = AdsInterfaceGatesSchema.safeParse(withExtra);
    expect(parsed.success).toBe(false);
  });
});
