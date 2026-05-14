import type { CSSProperties } from "react";

import {
  listCreativeRenderSpecFixtures,
  loadCreativeRenderSpecFixture,
  validateCreativeRenderSpecForADS,
  type CreativeRenderSpecFixtureName
} from "@homeai/ads-render";
import type { MockImageAdapterMode } from "@homeai/image-adapter";

import {
  getRepositorySnapshotForDebug,
  listMockModes,
  runCreateAndStart,
  type RunCreateAndStartOutcome
} from "../../api/render/_runtime.js";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ fixture?: string; run?: string; mode?: string }>;
}

const styles: Record<string, CSSProperties> = {
  page: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "24px", color: "#1f2937" },
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
  good: { background: "#d1fae5", color: "#065f46" },
  bad: { background: "#fee2e2", color: "#991b1b" },
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
  link: { color: "#1d4ed8", marginRight: "10px", textDecoration: "underline" },
  img: { maxWidth: "320px", border: "1px solid #d1d5db", borderRadius: "4px" }
};

export default async function RenderDebugPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const fixtures = listCreativeRenderSpecFixtures();
  const modes = listMockModes();
  const selectedFixture = pickFixture(params.fixture, fixtures);
  const selectedMode = pickMode(params.mode, modes);
  const fixtureData = loadCreativeRenderSpecFixture(selectedFixture);
  const validation = validateCreativeRenderSpecForADS(fixtureData);

  const shouldRun = params.run === "1" && validation.status === "pass";
  const runOutcome: RunCreateAndStartOutcome | null = shouldRun
    ? await runCreateAndStart(fixtureData, selectedMode)
    : null;

  const snapshot = getRepositorySnapshotForDebug();

  return (
    <main style={styles.page}>
      <h1 style={styles.h1}>/dev/render-debug — ADS Batch 02 orchestrator</h1>
      <p style={styles.meta}>
        Mock provider lifecycle (queued → running → provider_pending → candidate_generated → verification_pending).
        No real provider, no gallery admission. Verifier placeholder (ADS Batch 03 fills in).
      </p>

      <section style={styles.section}>
        <h2 style={styles.h2}>Fixture selector</h2>
        <div>
          {fixtures.map((name) => (
            <a key={name} href={hrefFor(name, selectedMode, false)} style={styles.link}>
              {name === selectedFixture ? <strong>{name}</strong> : name}
            </a>
          ))}
        </div>
        <h2 style={styles.h2}>Mock provider mode</h2>
        <div>
          {modes.map((mode) => (
            <a key={mode} href={hrefFor(selectedFixture, mode, false)} style={styles.link}>
              {mode === selectedMode ? <strong>{mode}</strong> : mode}
            </a>
          ))}
        </div>
        <div style={{ marginTop: "8px" }}>
          <a href={hrefFor(selectedFixture, selectedMode, true)} style={styles.link}>
            ▶ Create + Start mock job ({selectedMode})
          </a>
          <a href={hrefFor(selectedFixture, selectedMode, false)} style={styles.link}>
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
        <h2 style={styles.h2}>Mock job run</h2>
        {runOutcome === null ? (
          <p style={styles.meta}>Click "Create + Start" above to run the orchestrator end-to-end.</p>
        ) : runOutcome.status === "ok" && "candidate" in runOutcome ? (
          <SuccessView outcome={runOutcome} />
        ) : runOutcome.status === "failed" ? (
          <FailedView outcome={runOutcome} mode={selectedMode} fixture={selectedFixture} />
        ) : runOutcome.status === "spec_invalid" ? (
          <div>
            <span style={{ ...styles.pill, ...styles.bad }}>spec_invalid</span>
            <pre style={styles.pre}>{JSON.stringify(runOutcome.issues, null, 2)}</pre>
          </div>
        ) : runOutcome.status === "policy_denied" ? (
          <div>
            <span style={{ ...styles.pill, ...styles.bad }}>policy_denied</span>
            <pre style={styles.pre}>{runOutcome.reason}</pre>
          </div>
        ) : (
          <pre style={styles.pre}>{JSON.stringify(runOutcome, null, 2)}</pre>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Verification</h2>
        <p style={styles.meta}>
          <span style={{ ...styles.pill, ...styles.warn }}>placeholder</span>
          L1 deterministic verifier lands in ADS Batch 03; for now jobs end in <em>verification_pending</em>.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Repository snapshot (in-memory)</h2>
        <p style={styles.meta}>
          jobs={snapshot.jobs} · candidates={snapshot.candidates} · traces={snapshot.traces}
        </p>
        <p style={styles.meta}>
          Repos and specStore are reset on Next dev server hot reload; expected for Batch 02. DB lands later.
        </p>
      </section>
    </main>
  );
}

function SuccessView({
  outcome
}: {
  outcome: Extract<RunCreateAndStartOutcome, { status: "ok"; candidate: import("@homeai/render-jobs").RenderCandidate }>;
}) {
  return (
    <div>
      <div>
        <span style={{ ...styles.pill, ...styles.good }}>job: {outcome.job.status}</span>
        <span style={{ ...styles.pill, ...styles.good }}>candidate: {outcome.candidate.status}</span>
        <span style={{ ...styles.pill, ...styles.neutral }}>
          attempt {outcome.job.attempt}/{outcome.job.maxAttempts}
        </span>
      </div>
      <p style={styles.meta}>
        jobId={outcome.job.renderJobId} · candidateId={outcome.candidate.candidateId}
      </p>
      <img alt="mock render" src={outcome.candidate.imageUrl} style={styles.img} />
      <h2 style={styles.h2}>ProviderTrace summary</h2>
      <pre style={styles.pre}>
        {JSON.stringify(
          {
            traceId: outcome.candidate.providerTrace.traceId,
            providerName: outcome.candidate.providerTrace.providerName,
            providerModel: outcome.candidate.providerTrace.providerModel,
            adapterVersion: outcome.candidate.providerTrace.adapterVersion,
            latencyMs: outcome.candidate.providerTrace.latencyMs,
            estimatedCostCents: outcome.candidate.providerTrace.estimatedCostCents,
            inputAssetHashes: outcome.candidate.providerTrace.inputAssetHashes,
            outputAssetHash: outcome.candidate.providerTrace.outputAssetHash,
            safetyStatus: outcome.candidate.providerTrace.safetyStatus
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

function FailedView({
  outcome,
  mode,
  fixture
}: {
  outcome: Extract<RunCreateAndStartOutcome, { status: "failed" }>;
  mode: MockImageAdapterMode;
  fixture: CreativeRenderSpecFixtureName;
}) {
  void mode;
  void fixture;
  return (
    <div>
      <span style={{ ...styles.pill, ...styles.bad }}>failed</span>
      <span style={{ ...styles.pill, ...styles.neutral }}>
        attempt {outcome.job.attempt}/{outcome.job.maxAttempts}
      </span>
      <p style={styles.meta}>
        jobId={outcome.job.renderJobId} reason={outcome.reason}
      </p>
      {outcome.job.error !== undefined ? (
        <pre style={styles.pre}>
          {JSON.stringify(
            {
              code: outcome.job.error.code,
              message: outcome.job.error.message,
              stage: outcome.job.error.stage,
              occurredAt: outcome.job.error.occurredAt
            },
            null,
            2
          )}
        </pre>
      ) : null}
      <p style={styles.meta}>
        Retry via POST{" "}
        <code>/api/render-jobs/{outcome.job.renderJobId}/retry</code> (curl from terminal — retry is not exposed as a
        clickable link in Batch 02 to keep the page idempotent).
      </p>
    </div>
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

function pickMode(raw: string | undefined, modes: readonly MockImageAdapterMode[]): MockImageAdapterMode {
  if (raw !== undefined && (modes as readonly string[]).includes(raw)) {
    return raw as MockImageAdapterMode;
  }
  return "normal";
}

function hrefFor(
  fixture: CreativeRenderSpecFixtureName,
  mode: MockImageAdapterMode,
  run: boolean
): string {
  const search = new URLSearchParams({ fixture, mode });
  if (run) search.set("run", "1");
  return `/dev/render-debug?${search.toString()}`;
}
