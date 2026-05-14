import { notFound } from "next/navigation.js";
import {
  buildCreativeRenderSpecDebugPayload,
  createCreativeRenderSpecFixtureInput
} from "@homeai/creative-render-spec";

export default function CreativeRenderSpecDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const input = createCreativeRenderSpecFixtureInput({ withLayoutIntent: true, withWarnings: true });
  const debug = buildCreativeRenderSpecDebugPayload({ input });

  return (
    <main style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Contract-only preview</p>
        <h1 style={titleStyle}>CreativeRenderSpec Debug</h1>
        <p>Verification: {debug.renderSpecVerification.status}</p>
        <p>Rooms covered: {debug.coverage.roomsWithSpecs} / {debug.coverage.schemeRoomCount}</p>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Batch Trace</h2>
        <dl style={traceGridStyle}>
          <dt>schemeId</dt>
          <dd>{debug.batch.schemeId}</dd>
          <dt>sceneContractId</dt>
          <dd>{debug.batch.sceneContractId}</dd>
          <dt>geometryHash</dt>
          <dd>{debug.batch.geometryHash}</dd>
          <dt>layoutIntentHash</dt>
          <dd>{debug.batch.layoutIntentHash ?? "none"}</dd>
        </dl>
      </section>
      <section style={gridStyle}>
        {debug.batch.specs.map((spec) => (
          <article key={spec.renderSpecId} style={cardStyle}>
            <p style={eyebrowStyle}>{spec.roomType}</p>
            <h2 style={sectionTitleStyle}>{spec.roomId}</h2>
            <p>camera: {spec.cameraId}</p>
            <p>assets: {Object.keys(spec.inputs).length}</p>
            <p>anchors: {spec.anchorRefs.length}</p>
            <ul>
              {spec.promptDirectives.forbiddenChanges.map((directive) => (
                <li key={directive}>{directive}</li>
              ))}
            </ul>
          </article>
        ))}
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16
};

const cardStyle = {
  ...panelStyle
};

const jsonStyle = {
  maxHeight: 420,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
