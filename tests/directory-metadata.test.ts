import { describe, expect, it } from "vitest";
import { projectedToolAnnotations, projectedToolDescription } from "@/src/auth/mcp";

describe("directory-facing MCP metadata", () => {
  it("marks every state-modifying tool as destructive for client approval", () => {
    expect(
      projectedToolAnnotations({
        readOnlyHint: false,
        destructiveHint: false,
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

  it("leaves read-only annotations unchanged", () => {
    const annotations = { readOnlyHint: true, openWorldHint: false };
    expect(projectedToolAnnotations(annotations)).toEqual(annotations);
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
