export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
      <p style={{ color: "#72a7ff", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Gapwise for UTM
      </p>
      <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.8rem)", margin: "12px 0 18px", lineHeight: 1 }}>
        Gapwise AI
      </h1>
      <p style={{ color: "#b7bfcc", fontSize: 18, lineHeight: 1.65 }}>
        Private, provider-neutral MCP service for explicitly delegated Gapwise timetable assistance.
        Academic meetings are read-only; personal-item writes are permissioned, revision-checked, and queued
        for Gapwise to apply.
      </p>
      <div style={{ marginTop: 36, padding: 22, border: "1px solid #263043", borderRadius: 16 }}>
        <code style={{ color: "#dbe8ff" }}>/api/mcp</code>
        <p style={{ color: "#8f9bad", marginBottom: 0 }}>
          Authentication is required. No timetable or account data is exposed by this page.
        </p>
      </div>
    </main>
  );
}
