import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gapwise AI",
  description: "Permissioned, provider-neutral MCP integration service for Gapwise.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "radial-gradient(circle at 18% -10%, rgba(139,92,246,.24), transparent 36rem), radial-gradient(circle at 84% 6%, rgba(109,40,217,.14), transparent 34rem), linear-gradient(180deg,#140b1d 0%,#0f0a16 52%,#0b0810 100%)",
          color: "#f6f1fb",
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
