import { describe, expect, it } from "vitest";
import { projectedToolAnnotations, projectedToolDescription } from "@/src/auth/mcp";

describe("directory-facing MCP metadata", () => {
  it("preserves non-destructive mutation semantics while making destructive intent explicit", () => {
    expect(
      projectedToolAnnotations({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      }),
    ).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });

    expect(
      projectedToolAnnotations({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      }),
    ).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("makes read-only non-destructive intent explicit", () => {
    expect(projectedToolAnnotations({ readOnlyHint: true, openWorldHint: false })).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    });
  });

  it("projects narrow capability descriptions instead of behavioral instructions", () => {
    const names = [
      "get_my_gap_plan",
      "get_my_decision_context",
      "find_my_available_windows",
      "find_my_weekly_opportunities",
      "check_my_plan_feasibility",
      "list_utm_buildings",
      "route_between_utm_buildings",
      "plan_utm_gap_window",
    ];

    for (const name of names) {
      const description = projectedToolDescription(name, "fallback");
      expect(description).not.toBe("fallback");
      expect(description).not.toMatch(/\b(?:use this|do not|never|preserve)\b/iu);
    }
  });
});
