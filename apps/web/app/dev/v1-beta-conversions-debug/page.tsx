import { notFound } from "next/navigation.js";
import { buildV1BetaConversionDebugFixture } from "@homeai/analytics";

export default function V1BetaConversionsDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const debug = buildV1BetaConversionDebugFixture();

  return (
    <main data-testid="v1-beta-conversions-debug-page" style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Mock conversion</p>
        <h1 style={titleStyle}>V1 Beta conversion actions</h1>
        <p style={mutedStyle}>Actions are local mock events only; no real provider session is created.</p>
      </section>
      <section data-testid="v1-beta-conversion-actions" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Actions</h2>
        <div style={actionGridStyle}>
          {debug.actionSet.actions.map((action) => (
            <article key={action.actionId} data-testid={`v1-beta-conversion-action-${action.type}`} style={cardStyle}>
              <h3 style={cardTitleStyle}>{action.label}</h3>
              <p style={mutedStyle}>{action.status}</p>
              <p style={mutedStyle}>{action.summary}</p>
            </article>
          ))}
        </div>
      </section>
      <section data-testid="v1-beta-payment-started-mock-event" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Payment started mock event</h2>
        <dl style={gridStyle}>
          <dt>eventType</dt>
          <dd>{debug.paymentStartedMockEvent.eventType}</dd>
          <dt>source</dt>
          <dd>{debug.paymentStartedMockEvent.source}</dd>
          <dt>geometryHash</dt>
          <dd>{debug.paymentStartedMockEvent.geometryHash}</dd>
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(debug, null, 2)}</pre>
      </section>
    </main>
  );
}

function isDevPageDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124",
  background: "#f8fafc"
};

const panelStyle = {
  display: "grid",
  gap: 12,
  border: "1px solid #d9dee5",
  borderRadius: 8,
  padding: 16,
  background: "#fff"
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 16
};

const cardTitleStyle = {
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

const actionGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12
};

const cardStyle = {
  display: "grid",
  gap: 8,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px",
  margin: 0
};

const jsonStyle = {
  maxHeight: 360,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
