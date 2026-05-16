import { notFound } from "next/navigation.js";
import { buildV1BetaEventDebugFixture } from "@homeai/analytics";
import type { V1BetaEvent } from "@homeai/contracts";

export default function V1BetaEventsDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const debug = buildV1BetaEventDebugFixture();

  return (
    <main data-testid="v1-beta-events-debug-page" style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Local analytics</p>
        <h1 style={titleStyle}>V1 Beta events debug</h1>
        <p style={mutedStyle}>Deterministic event fixture and local repository shape.</p>
      </section>
      <section data-testid="v1-beta-events-summary" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Summary</h2>
        <dl style={gridStyle}>
          <dt>Total events</dt>
          <dd>{debug.summary.totalEvents}</dd>
          <dt>Unique sessions</dt>
          <dd>{debug.summary.uniqueSessions}</dd>
          <dt>Flow viewed</dt>
          <dd>{debug.summary.eventTypes.beta_flow_viewed}</dd>
          <dt>Render room opened</dt>
          <dd>{debug.summary.eventTypes.render_room_status_opened}</dd>
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Events</h2>
        <table data-testid="v1-beta-events-table" style={tableStyle}>
          <thead>
            <tr>
              <th>eventId</th>
              <th>eventType</th>
              <th>source</th>
              <th>stageId</th>
              <th>roomId</th>
              <th>createdAt</th>
            </tr>
          </thead>
          <tbody>
            {debug.events.map((event) => (
              <EventRow key={event.eventId} event={event} />
            ))}
          </tbody>
        </table>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(debug, null, 2)}</pre>
      </section>
    </main>
  );
}

function EventRow({ event }: { event: V1BetaEvent }) {
  return (
    <tr data-testid={`v1-beta-event-${event.eventId}`}>
      <td>{event.eventId}</td>
      <td>{event.eventType}</td>
      <td>{event.source}</td>
      <td>{event.stageId ?? "none"}</td>
      <td>{event.roomId ?? "none"}</td>
      <td>{event.createdAt}</td>
    </tr>
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px",
  margin: 0
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const
};

const jsonStyle = {
  maxHeight: 360,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
