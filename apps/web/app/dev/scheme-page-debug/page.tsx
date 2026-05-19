import { notFound } from "next/navigation.js";
import { SchemePagePreview, DevJsonPanel } from "../../../components/scheme-page/SchemePagePreview.js";
import { buildSchemePageDebugPayload, createSchemePageFixtureContract } from "@homeai/scheme-page";

export default function SchemePageDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const scheme = createSchemePageFixtureContract({ withLayoutIntent: true, withWarnings: true });
  const debug = buildSchemePageDebugPayload({ scheme });

  return (
    <div>
      <section style={panelStyle}>
        <h1 style={titleStyle}>Scheme Page Debug</h1>
        <p>Schema validation: {debug.pageVerification.status}</p>
        <p>Rooms rendered: {debug.coverage.totalRooms}</p>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Fixture Input</h2>
        <pre style={jsonStyle}>{JSON.stringify({ schemeId: scheme.schemeId }, null, 2)}</pre>
      </section>
      <SchemePagePreview viewModel={debug.viewModel} renderStatusShell={debug.renderStatusShell} showDebug />
      <DevJsonPanel value={debug} />
    </div>
  );
}

function isDevPageDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}

const panelStyle = {
  margin: 24,
  padding: 16,
  border: "1px solid #ddd",
  borderRadius: 8,
  fontFamily: "Arial, sans-serif"
};

const titleStyle = {
  margin: 0,
  fontSize: 28
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 16
};

const jsonStyle = {
  maxHeight: 280,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
