import { describe, expect, it } from "vitest";
import { PUBLIC_GROUNDING_NOTICE, formatPublicBuildings } from "@/src/mcp/public-campus-formatters";
import { MCP_DATA_NOTICE, withMcpDataBoundary } from "@/src/mcp/text-content";

describe("MCP grounding boundaries", () => {
  it("separates delegated Gapwise facts from assistant inference", () => {
    expect(MCP_DATA_NOTICE).toContain("only values returned by this Gapwise tool are Gapwise-grounded");
    expect(MCP_DATA_NOTICE).toContain("transit, amenity, or general advice is not supplied by Gapwise");
    expect(withMcpDataBoundary("Schedule result")).toContain("Schedule result");
  });

  it("applies the same provenance boundary to public campus responses", () => {
    expect(PUBLIC_GROUNDING_NOTICE).toContain("must not be attributed to Gapwise");
    expect(formatPublicBuildings([])).toContain(PUBLIC_GROUNDING_NOTICE);
  });
});
