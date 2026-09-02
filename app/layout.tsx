import type { Metadata } from "next";
import type { ReactNode } from "react";

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
          background: "radial-gradient(circle at 20% -10%, rgba(78,167,254,.10), transparent 34rem), linear-gradient(180deg,#07101a 0%,#08111b 58%,#07101a 100%)",
          color: "#f3f7fb",
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
