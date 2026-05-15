import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

/**
 * D-036 enforcement: Track B packages must not redefine canonical ADS
 * render schemas. Cross-module shapes come from @homeai/contracts.
 *
 * This scope test runs against Track B's packages and asserts that:
 *   - No top-level `export const <Canonical>Schema = z.<...>` for a name
 *     that already exists as canonical.
 *   - No top-level `export type <Canonical> = z.infer<...>` for a
 *     canonical name.
 *   - No top-level `export const <Canonical>Schema = z.object({` followed
 *     by an inlined schema definition (the catch-all duplicate detector).
 *
 * Re-exporting from "@homeai/contracts" remains allowed.
 */

const CANONICAL_SCHEMA_NAMES = [
  "CreativeRenderSpecSchema",
  "CreativeRenderHardConstraintsSchema",
  "CreativeRenderStyleDirectiveSchema",
  "CreativeRenderBudgetDirectiveSchema",
  "CreativeRenderSpecInputsSchema",
  "CreativeRenderSpecBatchSchema",
  "RenderJobSchema",
  "RenderJobStatusSchema",
  "RenderRoomJobSchema",
  "RenderJobIssueSchema",
  "RenderJobCoverageSummarySchema",
  "RenderTraceSchema",
  "RenderLifecycleStatusSchema",
  "RenderCandidateSchema",
  "RenderCandidateStatusSchema",
  "RenderVerificationReportSchema",
  "RenderVerificationStatusSchema",
  "DeterministicRenderCheckSchema",
  "DeterministicRenderCheckTypeSchema",
  "VlmRenderChecklistResultSchema",
  "RetryRecommendationSchema",
  "HumanReviewRecommendationSchema",
  "GalleryEligibilityDecisionSchema",
  "GalleryEligibilityStatusSchema"
];

const CANONICAL_TYPE_NAMES = [
  "CreativeRenderSpec",
  "RenderJob",
  "RenderJobStatus",
  "RenderRoomJob",
  "RenderTrace",
  "RenderCandidate",
  "RenderCandidateStatus",
  "RenderVerificationReport",
  "RenderVerificationStatus",
  "DeterministicRenderCheck",
  "DeterministicRenderCheckType",
  "GalleryEligibilityDecision",
  "GalleryEligibilityStatus"
];

const TRACK_B_PACKAGE_ROOTS = [
  join(repoRoot, "packages", "render-verifier", "src"),
  join(repoRoot, "packages", "ads-runtime", "src"),
  join(repoRoot, "packages", "ads-render", "src"),
  join(repoRoot, "apps", "web", "app", "api", "render-jobs"),
  join(repoRoot, "apps", "web", "app", "api", "render-candidates"),
  join(repoRoot, "apps", "web", "app", "api", "render-verification"),
  join(repoRoot, "apps", "web", "app", "api", "render"),
  join(repoRoot, "apps", "web", "app", "api", "render-human-review"),
  join(repoRoot, "apps", "web", "app", "api", "render-snapshot"),
  join(repoRoot, "apps", "web", "app", "dev", "render-debug")
];

describe("D-036 — no duplicate canonical ADS contracts in Track B packages", () => {
  it("Track B never redefines canonical *Schema constants", () => {
    const files = collect(TRACK_B_PACKAGE_ROOTS);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of CANONICAL_SCHEMA_NAMES) {
        // export const X = z.<anything>  → schema definition (forbidden)
        const re = new RegExp("export\\s+const\\s+" + name + "\\s*[:=]\\s*z\\.", "m");
        if (re.test(text)) {
          offenders.push(`${file}: redefines ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Track B never declares canonical type aliases", () => {
    const files = collect(TRACK_B_PACKAGE_ROOTS);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of CANONICAL_TYPE_NAMES) {
        // export type X = z.infer<...>  or  export type X = { ...  → declaration
        const reInfer = new RegExp("export\\s+type\\s+" + name + "\\s*=\\s*z\\.infer", "m");
        const reShape = new RegExp("export\\s+type\\s+" + name + "\\s*=\\s*\\{", "m");
        const reInterface = new RegExp("export\\s+interface\\s+" + name + "\\b", "m");
        if (reInfer.test(text) || reShape.test(text) || reInterface.test(text)) {
          offenders.push(`${file}: redeclares ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Track B may re-export canonical names from @homeai/contracts (this is allowed)", () => {
    // Positive sanity: the canonical schemas should be importable from the
    // canonical package and be present there.
    // This guards against accidental deletion of canonical exports.
    const canonicalIndex = readFileSync(join(repoRoot, "packages", "contracts", "src", "index.ts"), "utf8");
    expect(canonicalIndex).toMatch(/render-job\.js/);
    expect(canonicalIndex).toMatch(/render-candidate\.js/);
    expect(canonicalIndex).toMatch(/render-verification-report\.js/);
    expect(canonicalIndex).toMatch(/render-gallery-eligibility\.js/);
    expect(canonicalIndex).toMatch(/creative-render-spec\.js/);
  });
});

function collect(roots: ReadonlyArray<string>): string[] {
  return roots.flatMap((root) => walk(root)).filter((p) => /\.(ts|tsx)$/.test(p));
}

function walk(path: string): string[] {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    if (child.includes("node_modules") || child.endsWith(".d.ts")) {
      return [];
    }
    return walk(child);
  });
}
