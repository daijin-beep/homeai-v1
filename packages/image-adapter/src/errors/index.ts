export class RenderProviderPolicyError extends Error {
  override readonly name = "RenderProviderPolicyError";
  readonly code: "blocked" | "unknown_commercial_use" | "unknown_data_retention" | "cost_exceeded";
  readonly policyId: string;

  constructor(
    code: "blocked" | "unknown_commercial_use" | "unknown_data_retention" | "cost_exceeded",
    policyId: string,
    message: string
  ) {
    super(message);
    this.code = code;
    this.policyId = policyId;
  }
}
