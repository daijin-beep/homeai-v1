import type { CSSProperties } from "react";

import {
  listCreativeRenderSpecFixtures,
  loadCreativeRenderSpecFixture,
  validateCreativeRenderSpecForADS,
  type CreativeRenderSpecFixtureName
} from "@homeai/ads-render";

import {
  getRepositorySnapshotForDebug,
  runCreateRenderJob
} from "../../api/render/_runtime.js";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ fixture?: string; run?: string }>;
}

const styles: Record<string, CSSProperties> = {
  page: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "24px", color: "#1f2937" },
  h1: { fontSize: "20px", margin: "0 0 8px 0" },
  h2: { fontSize: "14px", margin: "16px 0 6px 0", color: "#374151" },
  meta: { color: "#6b7280", marginBottom: "16px" },
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
  good: { background: "#d1fae5", color: "#065f46" },
  bad: { background: "#fee2e2", color: "#991b1b" },
  warn: { background: "#fef3c7", color: "#92400e" },
  pre: {
    background: "#0b1020",
    color: "#cbd5e1",
    padding: "10px",
    borderRadius: "4px",
    fontSize: "12px",
    overflow: "auto",
    maxHeight: "320px"
  },
  link: { color: "#1d4ed8", marginRight: "10px", textDecoration: "underline" },
  img: { maxWidth: "320px", border: "1px solid #d1d5db", borderRadius: "4px" }
};

export default async function RenderDebugPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const fixtures = listCreativeRenderSpecFixtures();
  const selected = pickFixture(params.fixture, fixtures);
  const fixtureData = loadCreativeRenderSpecFixture(selected);
  const validation = validateCreativeRenderSpecForADS(fixtureData);

  const shouldRun = params.run === "1" && validation.status === "pass";
  const runOutcome = shouldRun ? await runCreateRenderJob(fixtureData) : null;

  const snapshot = getRepositorySnapshotForDebug();

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>/dev/render-debug — ADS Batch 01 skeleton</h1>
      <p style={styles.meta}>
        Mock provider only. No real provider, no gallery admission. Verifier placeholder (ADS Batch 03 fills in).
      </p>

      <section style={styles.section}>
        <h2 style={styles.h2}>Fixture selector</h2>
        <div>
          {fixtures.map((name) => (
            <a key={name} href={fixtureHref(name, params.run === "1")} style={styles.link}>
              {name === selected ? <strong>{name}</strong> : name}
            </a>
          ))}
        </div>
        <div style={{ marginTop: "6px" }}>
          <a href={fixtureHref(selected, true)} style={styles.link}>
            Run mock job ?run=1
          </a>
          <a href={fixtureHref(selected, false)} style={styles.link}>
            Validate only
          </a>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Validation result</h2>
        <div>
          {validation.status === "pass" ? (
            <span style={{ ...styles.pill, ...styles.good }}>pass</span>
          ) : (
            <span style={{ ...styles.pill, ...styles.bad }}>fail ({validation.issues.length})</span>
          )}
        </div>
        {validation.status === "pass" ? (
          <p style={styles.meta}>immutableInputHash = {validation.immutableInputHash}</p>
        ) : (
          <pre style={styles.pre}>{JSON.stringify(validation.issues, null, 2)}</pre>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Mock job</h2>
        {runOutcome === null ? (
          <p style={styles.meta}>Click "Run mock job ?run=1" above to create a job from the selected fixture.</p>
        ) : runOutcome.status === "ok" ? (
          <div>
            <div>
              <span style={{ ...styles.pill, ...styles.good }}>job: {runOutcome.job.status}</span>
              <span style={{ ...styles.pill, ...styles.good }}>candidate: {runOutcome.candidate.status}</span>
            </div>
            <p style={styles.meta}>
              jobId={runOutcome.job.renderJobId} candidateId={runOutcome.candidate.candidateId}
            </p>
            <img alt="mock render" src={runOutcome.candidate.imageUrl} style={styles.img} />
            <h2 style={styles.h2}>ProviderTrace summary</h2>
            <pre style={styles.pre}>
              {JSON.stringify(
                {
                  traceId: runOutcome.candidate.providerTrace.traceId,
                  providerName: runOutcome.candidate.providerTrace.providerName,
                  providerModel: runOutcome.candidate.providerTrace.providerModel,
                  adapterVersion: runOutcome.candidate.providerTrace.adapterVersion,
                  latencyMs: runOutcome.candidate.providerTrace.latencyMs,
                  estimatedCostCents: runOutcome.candidate.providerTrace.estimatedCostCents,
                  inputAssetHashes: runOutcome.candidate.providerTrace.inputAssetHashes,
                  outputAssetHash: runOutcome.candidate.providerTrace.outputAssetHash,
                  safetyStatus: runOutcome.candidate.providerTrace.safetyStatus
                },
                null,
                2
              )}
            </pre>
          </div>
        ) : runOutcome.status === "spec_invalid" ? (
          <div>
            <span style={{ ...styles.pill, ...styles.bad }}>spec_invalid</span>
            <pre style={styles.pre}>{JSON.stringify(runOutcome.issues, null, 2)}</pre>
          </div>
        ) : (
          <div>
            <span style={{ ...styles.pill, ...styles.bad }}>provider_failed</span>
            <pre style={styles.pre}>{runOutcome.reason}</pre>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Verification</h2>
        <p style={styles.meta}>
          <span style={{ ...styles.pill, ...styles.warn }}>placeholder</span>
          L1 deterministic verifier lands in ADS Batch 03; this section is a no-op for Batch 01.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Repository snapshot (in-memory)</h2>
        <p style={styles.meta}>
          jobs={snapshot.jobs} · candidates={snapshot.candidates} · traces={snapshot.traces}
        </p>
        <p style={styles.meta}>
          Repos are reset on Next dev server hot reload; this is expected for Batch 01. Real persistence lands later.
        </p>
      </section>
    </main>
  );
}

function pickFixture(
  raw: string | undefined,
  fixtures: readonly CreativeRenderSpecFixtureName[]
): CreativeRenderSpecFixtureName {
  if (raw !== undefined && (fixtures as readonly string[]).includes(raw)) {
    return raw as CreativeRenderSpecFixtureName;
  }
  return fixtures[0] ?? "valid";
}

function fixtureHref(name: CreativeRenderSpecFixtureName, run: boolean): string {
  const search = new URLSearchParams({ fixture: name });
  if (run) search.set("run", "1");
  return `/dev/render-debug?${search.toString()}`;
}
