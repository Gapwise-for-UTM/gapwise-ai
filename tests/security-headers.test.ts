import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("deployment security headers", () => {
  it("keeps the AI service fail-closed for browser capabilities", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.headers).toBeTypeOf("function");

    const rules = await nextConfig.headers!();
    const global = rules.find((rule) => rule.source === "/:path*");
    expect(global).toBeDefined();

    const headers = new Map(
      (global?.headers ?? []).map((header) => [header.key, header.value]),
    );

    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains",
    );
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");

    const permissions = headers.get("Permissions-Policy") ?? "";
    for (const capability of [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
    ]) {
      expect(permissions).toContain(capability);
    }
  });
});
