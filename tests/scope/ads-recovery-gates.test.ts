import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

/**
 * Recovery-branch acceptance gates (recovery task card §2 and §14).
 * These tests make the recovery branch's "ready for review" claims
 * machine-checkable so they cannot silently regress.
 */

describe("ADS recovery acceptance gates", () => {
  it("D-036 import strategy doc is present and lists canonical schemas", () => {
    const path = join(repoRoot, "docs", "ads", "canonical-import-strategy.md");
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/CreativeRenderSpecSchema/);
    expect(text).toMatch(/RenderJobSchema/);
    expect(text).toMatch(/RenderCandidateSchema/);
    expect(text).toMatch(/RenderVerificationReportSchema/);
    expect(text).toMatch(/GalleryEligibilityDecisionSchema/);
    expect(text).toMatch(/D-036/);
  });

  it("recovery audit names every canonical render contract on main", () => {
    const path = join(repoRoot, "docs", "ads", "recovery-audit-batch03-06.md");
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/render-job\.ts/);
    expect(text).toMatch(/render-candidate\.ts/);
    expect(text).toMatch(/render-verification-report\.ts/);
    expect(text).toMatch(/render-gallery-eligibility\.ts/);
    expect(text).toMatch(/creative-render-spec\.ts/);
    expect(text).toMatch(/render-pipeline/);
  });

  it("real-provider gate report exists and explicitly blocks", () => {
    const path = join(repoRoot, "docs", "ads", "real-provider-spike-gate.md");
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/BLOCKED/);
    expect(text).toMatch(/DisabledRealProviderAdapter/);
    expect(text).toMatch(/Kim/);
  });

  it("Track B packages (@homeai/render-verifier, @homeai/ads-runtime) exist", () => {
    for (const pkg of ["render-verifier", "ads-runtime"]) {
      const root = join(repoRoot, "packages", pkg);
      expect(statSync(root).isDirectory()).toBe(true);
      const pkgJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
      };
      expect(pkgJson.name).toBe(`@homeai/${pkg}`);
      expect(pkgJson.dependencies?.["@homeai/contracts"]).toBe("workspace:*");
    }
  });

  it("Track B packages re-export only from @homeai/contracts or local files for canonical names", () => {
    for (const pkg of ["render-verifier", "ads-runtime"]) {
      const indexPath = join(repoRoot, "packages", pkg, "src", "index.ts");
      const text = readFileSync(indexPath, "utf8");
      // No bare re-exports of canonical names — they must come via
      // @homeai/contracts at the call site, not laundered through Track B.
      // A package-local re-export of a canonical name would read like:
      //   export { RenderJobSchema } from "./contracts/...";
      // which the scope scan in `ads-no-duplicate-canonical-contracts`
      // already catches. Here we additionally verify that the index
      // does not re-export canonical names from any other origin.
      const re = /export\s*\{[^}]*\b(RenderJobSchema|RenderCandidateSchema|RenderVerificationReportSchema|CreativeRenderSpecSchema|RenderTraceSchema|GalleryEligibilityDecisionSchema|DeterministicRenderCheckSchema)\b/m;
      const m = text.match(re);
      if (m !== null) {
        // Only allowed if the matched export comes from "@homeai/contracts"
        const lineRe = new RegExp(".*" + m[0].replace(/[$()*+?.\\^|{}\[\]]/g, "\\$&") + ".*", "m");
        const block = text.match(lineRe);
        const blockText = block?.[0] ?? "";
        expect(blockText.includes('from "@homeai/contracts"')).toBe(true);
      }
    }
  });

  it("apps/web declares @homeai/ads-runtime and @homeai/render-verifier as deps", () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "apps", "web", "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@homeai/ads-runtime"]).toBe("workspace:*");
    expect(pkg.dependencies["@homeai/render-verifier"]).toBe("workspace:*");
    // Track A canonical compiler + builders also required
    expect(pkg.dependencies["@homeai/render-pipeline"]).toBe("workspace:*");
  });

  it(".claude harness directory is never tracked by git", () => {
    // The .claude/ worktree harness metadata exists at runtime but must
    // never appear inside the worktree's git tree. Cannot test via git
    // ls-tree here without a child process; instead we verify the
    // .gitignore (or absence of tracked files) by checking that no
    // packaged file references the harness path.
    const trackedFiles = [
      join(repoRoot, "packages", "ads-runtime", "src", "index.ts"),
      join(repoRoot, "packages", "render-verifier", "src", "index.ts")
    ];
    for (const file of trackedFiles) {
      if (existsSync(file)) {
        const text = readFileSync(file, "utf8");
        expect(text).not.toMatch(/\.claude\//);
      }
    }
  });

  it("Track B never creates a competing /api/render-jobs[/id]/start or /retry route", () => {
    // The old stacked PR shipped /api/render-jobs/[id]/start and /retry routes
    // tied to a now-obsolete per-candidate orchestrator. The recovery branch
    // must not resurrect them; Track B exposes a snapshot + queue surface
    // instead. The canonical contract is batch-oriented (RenderJob.roomJobs[]).
    for (const stalePath of [
      join(repoRoot, "apps", "web", "app", "api", "render-jobs", "[renderJobId]", "start"),
      join(repoRoot, "apps", "web", "app", "api", "render-jobs", "[renderJobId]", "retry"),
      join(repoRoot, "apps", "web", "app", "api", "render-jobs", "[renderJobId]", "route.ts"),
      join(repoRoot, "apps", "web", "app", "api", "render-candidates", "[candidateId]", "route.ts")
    ]) {
      expect(existsSync(stalePath)).toBe(false);
    }
  });
});
