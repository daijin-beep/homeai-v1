import type { CSSProperties } from "react";

import type { RenderLifecycleScenario } from "@homeai/render-pipeline";
import { buildRuntimeSnapshot } from "@homeai/ads-runtime";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ scenario?: string }>;
}

const SCENARIOS: ReadonlyArray<RenderLifecycleScenario> = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail"
];

const styles: Record<string, CSSProperties> = {
  page: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    padding: "24px",
    color: "#1f2937",
    maxWidth: "1200px"
  },
  h1: { fontSize: "20px", margin: "0 0 8px 0" },
  h2: { fontSize: "14px", margin: "16px 0 6px 0", color: "#374151" },
  meta: { color: "#6b7280", marginBottom: "12px" },
  section: {
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    padding: "12px 14px",
    marginBottom: "12px",
    background: "#fafafa"
  },
  pill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    marginRight: "6px"
  },
  pass: { background: "#d1fae5", color: "#065f46" },
  fail: { background: "#fee2e2", color: "#991b1b" },
  warn: { background: "#fef3c7", color: "#92400e" },
  neutral: { background: "#e5e7eb", color: "#374151" },
  pre: {
    background: "#0b1020",
    color: "#cbd5e1",
    padding: "10px",
    borderRadius: "4px",
    fontSize: "12px",
    overflow: "auto",
    maxHeight: "320px"
  },
  link: { color: "#1d4ed8", marginRight: "10px", textDecoration: "underline" }
};

function statusPillStyle(status: "pass" | "warning" | "fail"): CSSProperties {
  if (status === "fail") return { ...styles.pill, ...styles.fail };
  if (status === "warning") return { ...styles.pill, ...styles.warn };
  return { ...styles.pill, ...styles.pass };
}

export default async function RenderDebugPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requested = params.scenario;
  const scenario: RenderLifecycleScenario = (SCENARIOS as ReadonlyArray<string>).includes(requested ?? "")
    ? (requested as RenderLifecycleScenario)
    : "all_pass";

  const { snapshot } = buildRuntimeSnapshot({ scenario });

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>/dev/render-debug — ADS runtime (Track B)</h1>
      <p style={styles.meta}>
        Render lifecycle assembled in-process using <code>@homeai/render-pipeline</code> builders +
        Track B <code>@homeai/render-verifier</code>. Mock provider only. No network calls. Distinct
        from <code>/dev/render-job-debug</code> (Codex contract-only compiler preview).
      </p>

      <section style={styles.section}>
        <h2 style={styles.h2}>Scenario</h2>
        <div>
          {SCENARIOS.map((name) => (
            <a key={name} href={`/dev/render-debug?scenario=${name}`} style={styles.link}>
              {name === scenario ? <strong>{name}</strong> : name}
            </a>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>RenderJob</h2>
        <div>
          <span style={statusPillStyle(snapshot.renderJob.coverage.status)}>
            job.status: {snapshot.renderJob.status}
          </span>
          <span style={{ ...styles.pill, ...styles.neutral }}>
            rooms: {snapshot.renderJob.coverage.validRoomCount}
          </span>
          <span style={{ ...styles.pill, ...styles.neutral }}>
            specs: {snapshot.renderJob.coverage.totalRenderSpecCount}
          </span>
          <span style={{ ...styles.pill, ...styles.neutral }}>
            candidates: {snapshot.renderJob.coverage.totalCandidateCount}
          </span>
        </div>
        <p style={styles.meta}>
          renderJobId={snapshot.renderJob.renderJobId} · schemeId={snapshot.renderJob.schemeId} ·
          geometryHash={snapshot.renderJob.geometryHash.slice(0, 24)}…
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Candidates ({snapshot.candidates.length})</h2>
        {snapshot.candidates.map((candidate, i) => {
          const report = snapshot.verificationReports[i];
          const eligibility = snapshot.galleryEligibility[i];
          return (
            <div key={candidate.renderCandidateId} style={{ ...styles.section, marginLeft: "8px" }}>
              <div>
                <span style={{ ...styles.pill, ...styles.neutral }}>{candidate.roomId}</span>
                <span style={{ ...styles.pill, ...styles.neutral }}>cam={candidate.cameraId}</span>
                {report !== undefined ? (
                  <span style={statusPillStyle(report.status)}>verifier: {report.status}</span>
                ) : (
                  <span style={{ ...styles.pill, ...styles.warn }}>no report</span>
                )}
                {eligibility !== undefined ? (
                  <span
                    style={
                      eligibility.status === "eligible"
                        ? { ...styles.pill, ...styles.pass }
                        : eligibility.status === "human_review_required"
                          ? { ...styles.pill, ...styles.warn }
                          : { ...styles.pill, ...styles.fail }
                    }
                  >
                    gallery: {eligibility.status}
                  </span>
                ) : null}
              </div>
              <p style={styles.meta}>
                candidateId={candidate.renderCandidateId} · provider=
                {candidate.provider.providerKind} · output=
                {candidate.output.imageUrl ?? "—"}
              </p>
              {report !== undefined ? (
                <details>
                  <summary style={{ cursor: "pointer", color: "#374151" }}>
                    L1 checks ({report.l1Checks.length})
                  </summary>
                  <pre style={styles.pre}>
                    {JSON.stringify(
                      report.l1Checks.map((c) => ({
                        checkType: c.checkType,
                        status: c.status,
                        severity: c.severity,
                        message: c.message
                      })),
                      null,
                      2
                    )}
                  </pre>
                </details>
              ) : null}
              {report?.humanReview !== undefined ? (
                <p style={styles.meta}>
                  <span style={{ ...styles.pill, ...styles.warn }}>human review required</span>
                  {report.humanReview.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Human review queue ({snapshot.humanReviewItems.length})</h2>
        {snapshot.humanReviewItems.length === 0 ? (
          <p style={styles.meta}>
            No items queued for this scenario. Switch to a warning/fail scenario above to surface
            items requiring operator review.
          </p>
        ) : (
          <pre style={styles.pre}>
            {JSON.stringify(
              snapshot.humanReviewItems.map((item) => ({
                reviewItemId: item.reviewItemId,
                roomId: item.roomId,
                cameraId: item.cameraId,
                status: item.status,
                reason: item.reason,
                renderCandidateId: item.renderCandidateId,
                geometryHash: item.geometryHash.slice(0, 16) + "…"
              })),
              null,
              2
            )}
          </pre>
        )}
        <p style={styles.meta}>
          Decision submission via{" "}
          <code>POST /api/render-human-review/[reviewItemId]/decision</code>. The queue is
          repository-backed and validates a geometryHash snapshot at decision time to refuse stale
          reviews.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Provider policy</h2>
        <p style={styles.meta}>
          <span style={{ ...styles.pill, ...styles.warn }}>real provider: disabled</span>
          Default ADS-runtime policy blocks every real image provider (see Batch 06). Mock provider
          is the only allowed path until Kim signs ADS-OI-006 + Cost & Compliance Settings.
        </p>
      </section>
    </main>
  );
}
