export default function HomePage() {
  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(78,167,254,.15)", background: "rgba(6,11,18,.88)", backdropFilter: "blur(20px) saturate(140%)" }}>
        <div style={{ width: "min(1120px, calc(100% - 40px))", minHeight: 64, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href="https://gapwise.ca" style={{ display: "flex", alignItems: "center", gap: 10, color: "#f3f7fb", textDecoration: "none", fontWeight: 700, letterSpacing: "-.02em" }}>
            <img src="/logo-mark-purple.svg" width={30} height={30} alt="" style={{ display: "block", filter: "drop-shadow(0 0 14px rgba(139,92,246,.18))" }} />
            <span>Gapwise <strong style={{ fontWeight: 700 }}>AI</strong></span>
          </a>
          <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <a href="https://docs.gapwise.ca/ai" style={{ color: "#9aa8b9", textDecoration: "none", padding: "8px 10px" }}>Docs</a>
            <a href="https://gapwise.ca" style={{ color: "#9aa8b9", textDecoration: "none", padding: "8px 10px" }}>Gapwise</a>
          </nav>
        </div>
      </header>

      <main style={{ width: "min(1120px, calc(100% - 40px))", margin: "0 auto", padding: "56px 0 88px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(320px,.85fr)", gap: 16, alignItems: "stretch" }}>
          <div style={{ position: "relative", overflow: "hidden", padding: "clamp(34px,5vw,58px)", border: "1px solid #26435d", borderRadius: 24, background: "linear-gradient(145deg,rgba(14,30,47,.98),rgba(7,14,24,.98) 68%)", boxShadow: "inset 0 1px rgba(255,255,255,.04),0 28px 70px rgba(0,0,0,.2)" }}>
            <div style={{ position: "absolute", width: 430, height: 430, right: -170, bottom: -230, border: "1px solid rgba(78,167,254,.18)", borderRadius: "50%", boxShadow: "0 0 0 45px rgba(78,167,254,.025),0 0 0 90px rgba(78,167,254,.018)" }} />
            <p style={{ margin: 0, color: "#66b7ff", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Gapwise intelligence layer</p>
            <h1 style={{ maxWidth: 680, fontSize: "clamp(3.2rem,7vw,6.2rem)", margin: "32px 0 24px", lineHeight: .94, letterSpacing: "-.065em", fontWeight: 650 }}>
              Campus context,
              <br />delegated <span style={{ color: "#4ea7fe" }}>carefully.</span>
            </h1>
            <p style={{ maxWidth: 680, margin: 0, color: "#9eacbd", fontSize: 17, lineHeight: 1.65 }}>
              Permissioned, provider-neutral MCP access for explicitly delegated Gapwise student context. Academic meetings stay read-only; personal-item writes are permissioned, revision-checked, and queued for Gapwise to apply.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
              <a href="https://docs.gapwise.ca/ai/connect" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: "1px solid #2f98ef", borderRadius: 10, background: "#1478d4", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Connect an AI client →</a>
              <a href="https://docs.gapwise.ca/ai" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: "1px solid #274057", borderRadius: 10, background: "#0b1420", color: "#dce7f2", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Read the docs</a>
            </div>
          </div>

          <aside style={{ padding: "clamp(28px,4vw,42px)", border: "1px solid #21364b", borderRadius: 24, background: "linear-gradient(180deg,rgba(15,26,40,.96),rgba(9,17,28,.96))", boxShadow: "inset 0 1px rgba(255,255,255,.025)" }}>
            <img src="/logo-mark-purple.svg" width={54} height={54} alt="Gapwise AI deer mark" style={{ display: "block", marginBottom: 32 }} />
            <p style={{ margin: 0, color: "#66b7ff", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>MCP endpoint</p>
            <h2 style={{ margin: "10px 0 12px", fontSize: 29, lineHeight: 1.08, letterSpacing: "-.045em" }}>Private by design.</h2>
            <p style={{ margin: 0, color: "#93a1b3", fontSize: 14, lineHeight: 1.65 }}>No timetable or account data is exposed by this public page. Private tools require authentication and explicit delegation.</p>
            <div style={{ marginTop: 28, padding: 18, border: "1px solid #274057", borderRadius: 14, background: "#08131f" }}>
              <code style={{ color: "#8ccaff", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13 }}>/api/mcp</code>
              <div style={{ height: 1, background: "#1c3043", margin: "16px 0" }} />
              <div style={{ display: "grid", gap: 12, color: "#8f9fb1", fontSize: 12 }}>
                <span>● OAuth-protected private access</span>
                <span>● Explicit student delegation</span>
                <span>● Bounded, revision-checked writes</span>
              </div>
            </div>
          </aside>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginTop: 16 }}>
          {[
            ["Read boundaries", "Academic meetings are available as read-only context, keeping the canonical schedule protected."],
            ["Permissioned writes", "Personal-item mutations require delegated permission and are queued rather than silently applied."],
            ["Provider neutral", "The MCP surface is designed around explicit capabilities instead of a single model provider."],
          ].map(([title, copy]) => (
            <article key={title} style={{ padding: 24, border: "1px solid #21364b", borderRadius: 18, background: "rgba(11,20,32,.85)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "#4ea7fe", boxShadow: "0 0 0 5px rgba(78,167,254,.08)", marginBottom: 24 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title}</h3>
              <p style={{ margin: 0, color: "#8f9fb1", fontSize: 13, lineHeight: 1.6 }}>{copy}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
