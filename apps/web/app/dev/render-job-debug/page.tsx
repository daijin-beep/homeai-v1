import { notFound } from "next/navigation.js";
import { buildRenderLifecycleDebugFixture, type RenderLifecycleScenario } from "@homeai/render-pipeline";

const Scenarios: RenderLifecycleScenario[] = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail"
];

export default function RenderJobDebugPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const scenario = scenarioFromSearchParams(searchParams);
  const debug = buildRenderLifecycleDebugFixture(scenario);

  return (
    <main style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Contract-only preview</p>
        <h1 style={titleStyle}>RenderJob Debug</h1>
        <p>Scenario: {scenario}</p>
        <p>Coverage: {debug.renderJob.coverage.coveredRoomCount} / {debug.renderJob.coverage.validRoomCount}</p>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Scenario Switcher</h2>
        <div style={linkGridStyle}>
          {Scenarios.map((candidate) => (
            <a key={candidate} href={`/dev/render-job-debug?scenario=${candidate}`}>
              {candidate}
            </a>
          ))}
        </div>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Input Summary</h2>
        <dl style={traceGridStyle}>
          <dt>sceneContractId</dt>
          <dd>{debug.sceneContract.sceneContractId}</dd>
          <dt>schemeId</dt>
          <dd>{debug.schemeLiteContract.schemeId}</dd>
          <dt>geometryHash</dt>
          <dd>{debug.sceneContract.geometryHash}</dd>
          <dt>validRoomCount</dt>
          <dd>{debug.sceneContract.rooms.length}</dd>
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Per-room Coverage</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th>roomId</th>
              <th>roomType</th>
              <th>renderSpecCount</th>
              <th>candidateCount</th>
              <th>verificationStatus</th>
              <th>galleryEligibleCount</th>
              <th>issues</th>
            </tr>
          </thead>
          <tbody>
            {debug.renderJob.roomJobs.map((roomJob) => (
              <tr key={roomJob.roomId}>
                <td>{roomJob.roomId}</td>
                <td>{roomJob.roomType}</td>
                <td>{roomJob.renderSpecIds.length}</td>
                <td>{roomJob.candidateIds.length}</td>
                <td>{roomJob.status}</td>
                <td>{roomJob.coverage.galleryEligibleCount}</td>
                <td>{roomJob.issues.map((issue) => issue.code).join(", ") || "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section style={gridStyle}>
        <DebugCard title="RenderCandidates" value={debug.candidates.length} />
        <DebugCard title="VerificationReports" value={debug.verificationReports.length} />
        <DebugCard title="Gallery Eligibility" value={debug.galleryEligibility.filter((decision) => decision.status === "eligible").length} />
        <DebugCard title="Network Calls" value={debug.renderJob.trace.networkCalls ? 1 : 0} />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(debug, null, 2)}</pre>
      </section>
    </main>
  );
}

function DebugCard({ title, value }: { title: string; value: number }) {
  return (
    <article style={panelStyle}>
      <p style={eyebrowStyle}>{title}</p>
      <strong>{value}</strong>
    </article>
  );
}

function scenarioFromSearchParams(searchParams: Record<string, string | string[] | undefined> | undefined): RenderLifecycleScenario {
  const rawScenario = Array.isArray(searchParams?.scenario) ? searchParams?.scenario[0] : searchParams?.scenario;
  if (rawScenario !== undefined && Scenarios.includes(rawScenario as RenderLifecycleScenario)) {
    return rawScenario as RenderLifecycleScenario;
  }
  return "all_pass";
}

function isDevPageDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124"
};

const panelStyle = {
  padding: 16,
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff"
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 16
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#6b7280"
};

const traceGridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px"
};

const linkGridStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const
};

const jsonStyle = {
  maxHeight: 420,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
