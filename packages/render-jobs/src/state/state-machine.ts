import { IllegalRenderJobTransitionError } from "../errors/job-errors.js";
import type { RenderJobStatus } from "../contracts/render-job.js";

export const ALLOWED_TRANSITIONS: Readonly<Record<RenderJobStatus, ReadonlyArray<RenderJobStatus>>> = {
  queued: ["running", "cancelled"],
  running: ["provider_pending", "failed", "cancelled"],
  provider_pending: ["candidate_generated", "failed"],
  candidate_generated: ["verification_pending"],
  verification_pending: ["verified", "failed", "needs_human_review", "blocked"],
  needs_human_review: ["verified", "blocked"],
  verified: [],
  failed: [],
  blocked: [],
  cancelled: []
};

const TERMINAL_STATUSES: ReadonlySet<RenderJobStatus> = new Set<RenderJobStatus>([
  "verified",
  "failed",
  "blocked",
  "cancelled"
]);

export function isTerminal(status: RenderJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransition(from: RenderJobStatus, to: RenderJobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RenderJobStatus, to: RenderJobStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalRenderJobTransitionError(from, to);
  }
}
