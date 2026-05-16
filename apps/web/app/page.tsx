export default function HomePage() {
  return (
    <main style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>homeAI V1</p>
        <h1 style={titleStyle}>Beta flow shell</h1>
        <p style={mutedStyle}>Contract-first user preview for the current deterministic beta path.</p>
        <a href="/beta" style={linkStyle}>Open beta flow</a>
      </section>
    </main>
  );
}

const shellStyle = {
  minHeight: "100svh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  color: "#202124"
};

const panelStyle = {
  display: "grid",
  gap: 12,
  maxWidth: 520,
  border: "1px solid #d9dee5",
  borderRadius: 8,
  padding: 24,
  background: "#fff"
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#667085"
};

const titleStyle = {
  margin: 0,
  fontSize: 30
};

const mutedStyle = {
  margin: 0,
  color: "#5f6368"
};

const linkStyle = {
  justifySelf: "start",
  color: "#1a73e8"
};
