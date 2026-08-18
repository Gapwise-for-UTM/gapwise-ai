import { describe, expect, it } from "vitest";
import { canonicalMcpResourceUrl } from "@/src/config";

describe("canonicalMcpResourceUrl", () => {
  it("uses the first-party resource on ai.gapwise.ca", () => {
    expect(
      canonicalMcpResourceUrl(
        "https://ai.gapwise.ca/.well-known/oauth-protected-resource",
        null,
      ),
    ).toBe("https://ai.gapwise.ca/api/mcp");
  });

  it("canonicalizes the production Vercel alias to the first-party resource", () => {
    expect(
      canonicalMcpResourceUrl(
        "https://gapwise-ai.vercel.app/.well-known/oauth-protected-resource",
        null,
      ),
    ).toBe("https://ai.gapwise.ca/api/mcp");
  });

  it("keeps preview and local origins isolated", () => {
    expect(
      canonicalMcpResourceUrl(
        "https://gapwise-preview-example.vercel.app/.well-known/oauth-protected-resource",
        null,
      ),
    ).toBe("https://gapwise-preview-example.vercel.app/api/mcp");
  });

  it("honors an explicit alternate deployment origin", () => {
    expect(
      canonicalMcpResourceUrl(
        "https://gapwise-preview-example.vercel.app/.well-known/oauth-protected-resource",
        "https://ai.example.edu",
      ),
    ).toBe("https://ai.example.edu/api/mcp");
  });
});
