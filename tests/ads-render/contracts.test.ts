import { describe, expect, it } from "vitest";

import {
  GalleryAdmissionStatusSchema,
  HumanReviewDecisionSchema,
  HumanReviewDecisionTypeSchema,
  RenderGalleryItemSchema
} from "@homeai/ads-render";

describe("ADS Batch 01 — gallery admission contracts (skeleton)", () => {
  it("admission status enum covers the seven VAL-ADS-04 states", () => {
    const states = [
      "not_submitted",
      "pending_verification",
      "blocked_by_fail",
      "needs_human_review",
      "human_rejected",
      "admitted_pass",
      "admitted_human_approved"
    ];
    for (const s of states) {
      expect(GalleryAdmissionStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(GalleryAdmissionStatusSchema.safeParse("admitted_anything_else").success).toBe(false);
  });

  it("human review decision restricts to three allowed verbs", () => {
    expect(HumanReviewDecisionTypeSchema.safeParse("approve_for_gallery").success).toBe(true);
    expect(HumanReviewDecisionTypeSchema.safeParse("reject").success).toBe(true);
    expect(HumanReviewDecisionTypeSchema.safeParse("request_regeneration").success).toBe(true);
    expect(HumanReviewDecisionTypeSchema.safeParse("hack_in").success).toBe(false);
  });

  it("HumanReviewDecisionSchema validates a sample record", () => {
    const parsed = HumanReviewDecisionSchema.safeParse({
      decisionId: "hr_demo_001",
      candidateId: "cand_demo_001",
      reviewerId: "kim",
      decision: "approve_for_gallery",
      reasonCode: "manual_curation_pass",
      createdAt: "2026-05-13T00:00:00+00:00"
    });
    expect(parsed.success).toBe(true);
  });

  it("RenderGalleryItemSchema rejects fail verification status (strict union)", () => {
    const malformed = {
      galleryItemId: "g_demo",
      schemeId: "scheme_demo",
      roomId: "room_demo",
      cameraId: "cam_demo",
      renderSpecId: "rs_demo",
      candidateId: "cand_demo",
      geometryHash: "sha256:demo",
      imageUrl: "data:image/svg+xml;base64,AAA",
      verificationStatus: "fail",
      admissionStatus: "admitted_pass",
      providerTraceId: "trace_demo",
      admittedAt: "2026-05-13T00:00:00+00:00"
    };
    const parsed = RenderGalleryItemSchema.safeParse(malformed);
    expect(parsed.success).toBe(false);
  });
});
