import { buildV1BetaFixtureHarness } from "@homeai/v1-beta-fixtures";

export default function V1BetaFixtureHarnessPage() {
  const harness = buildV1BetaFixtureHarness();

  return (
    <main data-testid="v1-beta-fixture-harness-page" style={shellStyle}>
      <section style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Deterministic fixture harness</p>
          <h1 style={titleStyle}>homeAI V1 Beta readiness fixture</h1>
          <p style={mutedStyle}>
            Contract-validated local fixture payload spanning flow, scheme, render status, SKU admission, decor matching, and mock conversion events.
          </p>
        </div>
        <span data-testid="v1-beta-fixture-ready" style={statusStyle}>
          {String(harness.summary.readyForBetaHarness)}
        </span>
      </section>

      <section data-testid="v1-beta-fixture-summary" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Summary</h2>
        <dl style={gridStyle}>
          {Object.entries(harness.summary).map(([key, value]) => (
            <div key={key} style={contentsStyle}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-testid="v1-beta-fixture-trace" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Trace</h2>
        <dl style={gridStyle}>
          {Object.entries(harness.trace).map(([key, value]) => (
            <div key={key} style={contentsStyle}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-testid="v1-beta-fixture-guardrails" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Guardrails</h2>
        <dl style={gridStyle}>
          {Object.entries(harness.guardrails).map(([key, value]) => (
            <div key={key} style={contentsStyle}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section data-testid="v1-beta-fixture-flow" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Flow stages</h2>
        <div style={stageGridStyle}>
          {harness.flow.stages.map((stage) => (
            <article key={stage.stageId} style={stageStyle}>
              <div style={stageHeaderStyle}>
                <h3 style={stageTitleStyle}>{stage.label}</h3>
                <span style={statusStyle}>{stage.status}</span>
              </div>
              <p style={mutedStyle}>{stage.summary}</p>
              <p style={mutedStyle}>{stage.itemCount ?? 0} items / {stage.issueCount ?? 0} issues</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124",
  background: "#f8fafc"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 16,
  borderBottom: "1px solid #d9dee5"
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 16
};

const stageTitleStyle = {
  margin: 0,
  fontSize: 15
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#667085"
};

const mutedStyle = {
  margin: 0,
  color: "#5f6368"
};

const panelStyle = {
  display: "grid",
  gap: 12,
  border: "1px solid #d9dee5",
  borderRadius: 8,
  padding: 16,
  background: "#fff"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px",
  margin: 0
};

const contentsStyle = {
  display: "contents"
};

const statusStyle = {
  alignSelf: "flex-start",
  border: "1px solid #d9dee5",
  borderRadius: 6,
  padding: "5px 8px",
  background: "#fff"
};

const stageGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12
};

const stageStyle = {
  display: "grid",
  gap: 8,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  background: "#fff"
};

const stageHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12
};
