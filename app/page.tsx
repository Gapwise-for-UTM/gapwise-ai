export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
      <img
        src="/logo-mark-purple.svg"
        width={80}
        height={80}
        alt="Gapwise AI deer mark"
        style={{ display: "block", marginBottom: 28 }}
      />
      <p style={{ color: "#8B5CF6", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Gapwise intelligence layer
      </p>
      <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.8rem)", margin: "12px 0 18px", lineHeight: 1 }}>
        Gapwise AI
      </h1>
      <p style={{ color: "#b7bfcc", fontSize: 18, lineHeight: 1.65 }}>
        Permissioned, provider-neutral MCP service for explicitly delegated Gapwise student context.
        Academic meetings are read-only; personal-item writes are permissioned, revision-checked, and queued
        for Gapwise to apply.
      </p>
      <div style={{ marginTop: 36, padding: 22, border: "1px solid #263043", borderRadius: 16 }}>
        <code style={{ color: "#c4b5fd" }}>/api/mcp</code>
        <p style={{ color: "#8f9bad", marginBottom: 0 }}>
          Private tools require authentication and explicit delegation. No timetable or account data is exposed by this page.
        </p>
      </div>
    </main>
  );
}
