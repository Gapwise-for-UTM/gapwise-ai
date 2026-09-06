import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const EXPECTED_PRIVATE_TOOLS = [
  "get_ai_delegation_status",
  "get_my_day",
  "get_my_week",
  "search_my_schedule",
  "get_my_course_context",
  "get_my_schedule_range",
  "get_my_gap_plan",
  "get_my_ai_preferences",
  "get_my_decision_context",
  "find_my_available_windows",
  "find_my_weekly_opportunities",
  "check_my_plan_feasibility",
  "update_gap_preferences",
] as const;

const EXPECTED_PUBLIC_TOOLS = [
  "list_utm_buildings",
  "search_utm_buildings",
  "get_utm_building",
  "route_between_utm_buildings",
  "plan_utm_gap_window",
] as const;

describe("live MCP surface contract", () => {
  it("registers exactly the current permissioned private tools in the private route", async () => {
    const source = await readFile("app/api/mcp/route.ts", "utf8");
    const registered = [
      ...source.matchAll(/server\.registerTool\(\s*\n?\s*["']([^"']+)["']/gu),
    ].map((match) => match[1]);

    expect(registered).toEqual([...EXPECTED_PRIVATE_TOOLS]);
    expect(new Set(registered).size).toBe(EXPECTED_PRIVATE_TOOLS.length);
    for (const name of EXPECTED_PUBLIC_TOOLS) expect(registered).not.toContain(name);
    for (const retired of ["create_personal_item", "update_personal_item", "delete_personal_item"]) {
      expect(registered).not.toContain(retired);
    }
  });

  it("registers exactly five stateless public campus tools through the shared handler", async () => {
    const [wrapperSource, publicSource] = await Promise.all([
      readFile("src/audit/mcp-handler.ts", "utf8"),
      readFile("src/mcp/public-campus-tools.ts", "utf8"),
    ]);

    expect(wrapperSource).toContain('import { registerPublicCampusTools } from "@/src/mcp/public-campus-tools"');
    expect(wrapperSource).toContain("registerPublicCampusTools(server)");

    const registered = [
      ...publicSource.matchAll(/server\.registerTool\(\s*\n?\s*["']([^"']+)["']/gu),
    ].map((match) => match[1]);
    expect(registered).toEqual([...EXPECTED_PUBLIC_TOOLS]);
    expect(new Set(registered).size).toBe(EXPECTED_PUBLIC_TOOLS.length);
  });

  it("keeps public campus tools free of the private OAuth metadata marker", async () => {
    const source = await readFile("src/mcp/public-campus-tools.ts", "utf8");
    expect(source).not.toContain("OPENAI_TOOL_META");
    expect(source).not.toContain("securitySchemes");
  });

  it("locks the complete live surface to 18 unique tools", () => {
    const all = [...EXPECTED_PUBLIC_TOOLS, ...EXPECTED_PRIVATE_TOOLS];
    expect(all).toHaveLength(18);
    expect(new Set(all).size).toBe(18);
  });
});