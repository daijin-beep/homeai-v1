import { notFound } from "next/navigation.js";
import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import { buildSoftDecorGpsLitePlan, buildVerifiedSkuDebugFixture } from "@homeai/soft-decor-gps";
import type { SoftDecorGpsLiteRoom } from "@homeai/contracts";

export default function SoftDecorGpsLiteDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const scheme = createSchemePageFixtureContract({ withLayoutIntent: true, withWarnings: true });
  const catalog = buildVerifiedSkuDebugFixture();
  const plan = buildSoftDecorGpsLitePlan({ scheme, catalog });

  return (
    <main data-testid="soft-decor-gps-lite-debug-page" style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Soft Decor GPS Lite</p>
        <h1 style={titleStyle}>Verified SKU matching</h1>
        <p style={mutedStyle}>Matches are computed only from admitted local fixture SKUs.</p>
      </section>
      <section data-testid="soft-decor-gps-lite-summary" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Summary</h2>
        <dl style={gridStyle}>
          <dt>Verified SKUs</dt>
          <dd>{plan.totalVerifiedSkuCount}</dd>
          <dt>Matched SKUs</dt>
          <dd>{plan.matchedSkuCount}</dd>
          <dt>Rooms</dt>
          <dd>{plan.rooms.length}</dd>
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Room matches</h2>
        <div style={roomGridStyle}>
          {plan.rooms.map((room) => (
            <RoomMatchCard key={room.roomId} room={room} />
          ))}
        </div>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(plan, null, 2)}</pre>
      </section>
    </main>
  );
}

function RoomMatchCard({ room }: { room: SoftDecorGpsLiteRoom }) {
  return (
    <article data-testid={`soft-decor-gps-lite-room-${room.roomId}`} style={cardStyle}>
      <h3 style={roomTitleStyle}>{room.roomId}</h3>
      <p style={mutedStyle}>{room.roomType}</p>
      <p style={mutedStyle}>{room.matches.length} matches</p>
      {room.matches.length === 0 ? (
        <p style={warningStyle}>{room.warnings.join(", ")}</p>
      ) : (
        <ul>
          {room.matches.map((match) => (
            <li key={match.matchId}>
              {match.category} / {match.skuId} / {match.score}
            </li>
          ))}
        </ul>
      )}
    </article>
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

const roomTitleStyle = {
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

const warningStyle = {
  ...mutedStyle,
  color: "#9a3412"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px",
  margin: 0
};

const roomGridStyle = {
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

const jsonStyle = {
  maxHeight: 360,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
