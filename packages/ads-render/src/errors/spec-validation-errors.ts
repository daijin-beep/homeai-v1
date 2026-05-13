export interface AdsSpecValidationIssue {
  code: string;
  path: string;
  message: string;
}

export class AdsSpecValidationError extends Error {
  override readonly name = "AdsSpecValidationError";
  readonly issues: AdsSpecValidationIssue[];

  constructor(issues: AdsSpecValidationIssue[]) {
    super(`CreativeRenderSpec rejected for ADS consumer: ${issues.length} issue(s)`);
    this.issues = issues;
  }
}
