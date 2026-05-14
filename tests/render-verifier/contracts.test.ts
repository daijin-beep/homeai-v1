import { describe, expect, it } from "vitest";

import {
  DeterministicCheckSchema,
  DeterministicCheckStatusSchema,
  RenderVerificationReportSchema,
  RenderVerificationStatusSchema
} from "@homeai/render-verifier";

describe("ADS Batch 01 — render-verifier contracts (skeleton)", () => {
  it("DeterministicCheckStatus has pass / warning / fail / unsupported", () => {
    for (const s of ["pass", "warning", "fail", "unsupported"]) {
      expect(DeterministicCheckStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(DeterministicCheckStatusSchema.safeParse("ok").success).toBe(false);
  });

  it("DeterministicCheck validates a minimal record", () => {
    const parsed = DeterministicCheckSchema.safeParse({
      checkId: "wall_line_preservation",
      name: "Wall line preservation",
      status: "pass"
    });
    expect(parsed.success).toBe(true);
  });

  it("RenderVerificationStatusSchema accepts pass/warning/fail/unsupported", () => {
    for (const s of ["pass", "warning", "fail", "unsupported"]) {
      expect(RenderVerificationStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("RenderVerificationReportSchema validates a sample report", () => {
    const parsed = RenderVerificationReportSchema.safeParse({
      reportId: "report_demo_001",
      candidateId: "cand_demo_001",
      renderSpecId: "rs_demo_001",
      roomId: "room_demo_001",
      cameraId: "cam_demo_001",
      geometryHash: "sha256:fixture",
      status: "pass",
      l1Checks: [],
      createdAt: "2026-05-13T00:00:00+00:00"
    });
    expect(parsed.success).toBe(true);
  });

  it("RenderVerificationReportSchema is strict — extra fields rejected", () => {
    const parsed = RenderVerificationReportSchema.safeParse({
      reportId: "r",
      candidateId: "c",
      renderSpecId: "rs",
      roomId: "ro",
      cameraId: "ca",
      geometryHash: "h",
      status: "pass",
      l1Checks: [],
      createdAt: "2026-05-13T00:00:00+00:00",
      smuggled: true
    });
    expect(parsed.success).toBe(false);
  });
});
