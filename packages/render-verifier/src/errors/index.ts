export class RenderVerifierError extends Error {
  override readonly name = "RenderVerifierError";
  readonly code:
    | "hash_mismatch"
    | "room_mismatch"
    | "camera_mismatch"
    | "missing_trace"
    | "unsupported"
    | "unknown";
  readonly candidateId?: string;

  constructor(code: RenderVerifierError["code"], message: string, candidateId?: string) {
    super(message);
    this.code = code;
    if (candidateId !== undefined) {
      this.candidateId = candidateId;
    }
  }
}
