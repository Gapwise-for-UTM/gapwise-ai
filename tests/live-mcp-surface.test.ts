import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const EXPECTED_PRIVATE_TOOLS = [
  "get_ai_delegation_status",
  "get_my_day",
  "get_my_week",
  "get_my_gap_plan",
  "get_my_ai_preferences",
  "get_my_decision_context",
  "find_my_available_windows",
  "find_my_weekly_opportunities",
  "check_my_plan_feasibility",
  "create_personal_item",
  "update_personal_item",
  "delete_personal_item",
  "update_gap_preferences",
] as const;

const DORMANT_PUBLIC_TOOLS = [
  "list_utm_buildings",
  "get_utm_building",
  "route_between_utm_buildings",
  "plan_utm_gap_window",
] as const;

describe("live MCP surface contract", () => {
  it("registers exactly the 13 permissioned private tools", async () => {
    const source = await readFile("app/api/mcp/route.ts", "utf8");
    const registered = [
      ...source.matchAll(/server\.registerTool\(\s*\n?\s*["']([^"']+)["']/gu),
    ].map((match) => match[1]);

    expect(registered).toEqual([...EXPECTED_PRIVATE_TOOLS]);
    expect(new Set(registered).size).toBe(EXPECTED_PRIVATE_TOOLS.length);
    for (const name of DORMANT_PUBLIC_TOOLS) expect(registered).not.toContain(name);
  });

  it("keeps the dormant public-campus registrar outside live registration paths", async () => {
    const [routeSource, projectionSource] = await Promise.all([
      readFile("app/api/mcp/route.ts", "utf8"),
      readFile("src/auth/mcp.ts", "utf8"),
    ]);

    expect(routeSource).not.toContain("registerPublicCampusTools");
    expect(projectionSource).not.toContain("registerPublicCampusTools");
  });
});
