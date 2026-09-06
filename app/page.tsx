export default function HomePage() {
  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(139,92,246,.16)", background: "rgba(10,7,15,.9)", backdropFilter: "blur(20px) saturate(140%)" }}>
        <div style={{ width: "min(1120px, calc(100% - 40px))", minHeight: 64, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <a href="https://gapwise.ca" style={{ display: "flex", alignItems: "center", gap: 10, color: "#f7f3fb", textDecoration: "none", fontWeight: 700, letterSpacing: "-.02em" }}>
            <img src="/logo-mark-purple.svg" width={30} height={30} alt="" style={{ display: "block", filter: "drop-shadow(0 0 14px rgba(139,92,246,.22))" }} />
            <span>Gapwise <strong style={{ fontWeight: 700 }}>AI</strong></span>
          </a>
          <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <a href="https://docs.gapwise.ca/ai" style={{ color: "#a59aaa", textDecoration: "none", padding: "8px 10px" }}>Docs</a>
            <a href="https://gapwise.ca" style={{ color: "#a59aaa", textDecoration: "none", padding: "8px 10px" }}>Gapwise</a>
          </nav>
        </div>
      </header>

      <main style={{ width: "min(1120px, calc(100% - 40px))", margin: "0 auto", padding: "56px 0 88px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(320px,.85fr)", gap: 16, alignItems: "stretch" }}>
          <div style={{ position: "relative", overflow: "hidden", padding: "clamp(34px,5vw,58px)", border: "1px solid #45305d", borderRadius: 24, background: "linear-gradient(145deg,rgba(31,18,44,.98),rgba(13,9,19,.98) 68%)", boxShadow: "inset 0 1px rgba(255,255,255,.04),0 28px 70px rgba(0,0,0,.25)" }}>
            <div style={{ position: "absolute", width: 430, height: 430, right: -170, bottom: -230, border: "1px solid rgba(139,92,246,.22)", borderRadius: "50%", boxShadow: "0 0 0 45px rgba(139,92,246,.035),0 0 0 90px rgba(139,92,246,.022)" }} />
            <p style={{ margin: 0, color: "#a78bfa", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Gapwise intelligence layer · MCP v0.4</p>
            <h1 style={{ maxWidth: 680, fontSize: "clamp(3.2rem,7vw,6.2rem)", margin: "32px 0 24px", lineHeight: .94, letterSpacing: "-.065em", fontWeight: 650 }}>
              Campus context,
              <br />delegated <span style={{ color: "#8b5cf6" }}>carefully.</span>
            </h1>
            <p style={{ maxWidth: 680, margin: 0, color: "#aaa0b2", fontSize: 17, lineHeight: 1.65 }}>
              Permissioned, provider-neutral MCP access for explicitly delegated Gapwise student context. Search schedule and course context, find realistic availability, discover source-backed UTM places, and preserve Gapwise route and assessment uncertainty. Academic meetings stay read-only; Personal Items are retired.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
              <a href="https://docs.gapwise.ca/ai/connect" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: "1px solid #9b74f8", borderRadius: 10, background: "#7c4df0", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Connect an AI client →</a>
              <a href="https://docs.gapwise.ca/ai" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "0 18px", border: "1px solid #49345f", borderRadius: 10, background: "#15101c", color: "#ece6f2", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Read the docs</a>
            </div>
          </div>

          <aside style={{ padding: "clamp(28px,4vw,42px)", border: "1px solid #3e2d50", borderRadius: 24, background: "linear-gradient(180deg,rgba(28,19,38,.96),rgba(15,11,20,.96))", boxShadow: "inset 0 1px rgba(255,255,255,.025)" }}>
            <img src="/logo-mark-purple.svg" width={54} height={54} alt="Gapwise AI deer mark" style={{ display: "block", marginBottom: 32 }} />
            <p style={{ margin: 0, color: "#a78bfa", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>MCP endpoint</p>
            <h2 style={{ margin: "10px 0 12px", fontSize: 29, lineHeight: 1.08, letterSpacing: "-.045em" }}>Private by design.</h2>
            <p style={{ margin: 0, color: "#a59aaa", fontSize: 14, lineHeight: 1.65 }}>No timetable or account data is exposed by this public page. Private tools require authentication and explicit delegation. Public campus tools remain stateless.</p>
            <div style={{ marginTop: 28, padding: 18, border: "1px solid #49345f", borderRadius: 14, background: "#120d18" }}>
              <code style={{ color: "#c4b5fd", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 13 }}>/api/mcp</code>
              <div style={{ height: 1, background: "#362642", margin: "16px 0" }} />
              <div style={{ display: "grid", gap: 12, color: "#9f94a7", fontSize: 12 }}>
                <span>● OAuth-protected private access</span>
                <span>● Explicit student delegation</span>
                <span>● Source-backed search and context</span>
                <span>● Bounded gap-preference writes</span>
              </div>
            </div>
          </aside>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginTop: 16 }}>
          {[
            ["Search before guessing", "Resolve delegated courses, sections, rooms, buildings, and source-backed UTM places with deterministic search/context tools."],
            ["Respect schedule semantics", "RES entries are possible assessment windows, not weekly commitments. Ordinary TBA-location classes still block their scheduled time."],
            ["Keep uncertainty intact", "Unknown hours stay unknown, approximate routes stay approximate, and Gapwise gap budgets and warnings remain authoritative."],
          ].map(([title, copy]) => (
            <article key={title} style={{ padding: 24, border: "1px solid #3e2d50", borderRadius: 18, background: "rgba(23,16,31,.88)" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "#8b5cf6", boxShadow: "0 0 0 5px rgba(139,92,246,.10)", marginBottom: 24 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title}</h3>
              <p style={{ margin: 0, color: "#9f94a7", fontSize: 13, lineHeight: 1.6 }}>{copy}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
