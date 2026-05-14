/**
 * Error types for the Track B render verifier. These never carry secrets
 * and never reference Track A write paths.
 */

export class RenderVerifierInputError extends Error {
  override readonly name = "RenderVerifierInputError";
  readonly code: "missing_spec" | "missing_candidate" | "missing_report_id" | "schema_invalid";
  constructor(code: RenderVerifierInputError["code"], message: string) {
    super(message);
    this.code = code;
  }
}
