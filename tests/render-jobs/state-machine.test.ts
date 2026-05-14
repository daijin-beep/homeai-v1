import { describe, expect, it } from "vitest";

import {
  ALLOWED_TRANSITIONS,
  IllegalRenderJobTransitionError,
  assertTransition,
  canTransition,
  isTerminal,
  type RenderJobStatus
} from "@homeai/render-jobs";

describe("ADS Batch 02 — RenderJob state machine", () => {
  it("matches the architecture-§4.2 transition table", () => {
    expect(ALLOWED_TRANSITIONS.queued).toEqual(["running", "cancelled"]);
    expect(ALLOWED_TRANSITIONS.running).toEqual(["provider_pending", "failed", "cancelled"]);
    expect(ALLOWED_TRANSITIONS.provider_pending).toEqual(["candidate_generated", "failed"]);
    expect(ALLOWED_TRANSITIONS.candidate_generated).toEqual(["verification_pending"]);
    expect(ALLOWED_TRANSITIONS.verification_pending).toEqual([
      "verified",
      "failed",
      "needs_human_review",
      "blocked"
    ]);
    expect(ALLOWED_TRANSITIONS.needs_human_review).toEqual(["verified", "blocked"]);
  });

  it("recognizes the four terminal statuses", () => {
    const terminals: RenderJobStatus[] = ["verified", "failed", "blocked", "cancelled"];
    for (const s of terminals) expect(isTerminal(s)).toBe(true);
    const live: RenderJobStatus[] = [
      "queued",
      "running",
      "provider_pending",
      "candidate_generated",
      "verification_pending",
      "needs_human_review"
    ];
    for (const s of live) expect(isTerminal(s)).toBe(false);
  });

  it("canTransition returns true only for allowed transitions", () => {
    expect(canTransition("queued", "running")).toBe(true);
    expect(canTransition("queued", "cancelled")).toBe(true);
    expect(canTransition("queued", "verified")).toBe(false);
    expect(canTransition("queued", "candidate_generated")).toBe(false);
    expect(canTransition("provider_pending", "candidate_generated")).toBe(true);
    expect(canTransition("provider_pending", "verification_pending")).toBe(false);
    expect(canTransition("verification_pending", "verified")).toBe(true);
  });

  it("assertTransition throws on illegal transition", () => {
    expect(() => assertTransition("queued", "verified")).toThrow(IllegalRenderJobTransitionError);
    expect(() => assertTransition("verified", "running")).toThrow(IllegalRenderJobTransitionError);
    expect(() => assertTransition("cancelled", "queued")).toThrow(IllegalRenderJobTransitionError);
  });

  it("terminal statuses cannot transition anywhere", () => {
    const terminals: RenderJobStatus[] = ["verified", "failed", "blocked", "cancelled"];
    for (const from of terminals) {
      expect(ALLOWED_TRANSITIONS[from]).toEqual([]);
    }
  });
});
