import type { RenderJobErrorCode, RenderJobStatus } from "../contracts/render-job.js";

export class RenderJobValidationError extends Error {
  override readonly name = "RenderJobValidationError";
  readonly code: RenderJobErrorCode;
  readonly details?: unknown;
  constructor(code: RenderJobErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class IllegalRenderJobTransitionError extends Error {
  override readonly name = "IllegalRenderJobTransitionError";
  readonly from: RenderJobStatus;
  readonly to: RenderJobStatus;
  constructor(from: RenderJobStatus, to: RenderJobStatus) {
    super(`Illegal RenderJob transition: ${from} → ${to}`);
    this.from = from;
    this.to = to;
  }
}

export class RenderJobNotFoundError extends Error {
  override readonly name = "RenderJobNotFoundError";
  readonly renderJobId: string;
  constructor(renderJobId: string) {
    super(`RenderJob ${renderJobId} not found`);
    this.renderJobId = renderJobId;
  }
}

export class RenderCandidateValidationError extends Error {
  override readonly name = "RenderCandidateValidationError";
  readonly candidateId?: string;
  constructor(message: string, candidateId?: string) {
    super(message);
    if (candidateId !== undefined) {
      this.candidateId = candidateId;
    }
  }
}
