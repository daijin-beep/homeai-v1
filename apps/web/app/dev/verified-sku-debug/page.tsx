import { notFound } from "next/navigation.js";
import { buildVerifiedSkuDebugFixture } from "@homeai/soft-decor-gps";
import type { VerifiedSkuAdmissionResult } from "@homeai/contracts";

export default function VerifiedSkuDebugPage() {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const catalog = buildVerifiedSkuDebugFixture();

  return (
    <main data-testid="verified-sku-debug-page" style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Local catalog</p>
        <h1 style={titleStyle}>Verified SKU admission</h1>
        <p style={mutedStyle}>Local fixture import with price, dimensions, image, lead, and availability gates.</p>
      </section>
      <section data-testid="verified-sku-summary" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Summary</h2>
        <dl style={gridStyle}>
          <dt>Total raw SKUs</dt>
          <dd>{catalog.totalRawSkus}</dd>
          <dt>Admitted</dt>
          <dd>{catalog.admittedCount}</dd>
          <dt>Rejected</dt>
          <dd>{catalog.rejectedCount}</dd>
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Admission results</h2>
        <table data-testid="verified-sku-results-table" style={tableStyle}>
          <thead>
            <tr>
              <th>rawSkuId</th>
              <th>status</th>
              <th>category</th>
              <th>issues</th>
            </tr>
          </thead>
          <tbody>
            {catalog.results.map((result) => (
              <AdmissionRow key={result.rawSkuId} result={result} />
            ))}
          </tbody>
        </table>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(catalog, null, 2)}</pre>
      </section>
    </main>
  );
}

function AdmissionRow({ result }: { result: VerifiedSkuAdmissionResult }) {
  return (
    <tr data-testid={`verified-sku-result-${result.rawSkuId}`}>
      <td>{result.rawSkuId}</td>
      <td>{result.status}</td>
      <td>{result.sku?.category ?? "none"}</td>
      <td>{result.issues.map((issue) => issue.code).join(", ") || "none"}</td>
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
