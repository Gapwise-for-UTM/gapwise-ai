import type { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getUtmBuilding,
  listUtmBuildings,
  PublicBuildingOutputSchema,
  PublicBuildingsOutputSchema,
  PublicRouteOutputSchema,
  routeBetweenUtmBuildings,
} from "@/src/domain/public-campus";
import {
  formatPublicBuilding,
  formatPublicBuildings,
  formatPublicRoute,
} from "@/src/mcp/public-campus-formatters";

type McpRegistrar = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

function ok(summary: string, value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: value,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Campus intelligence request failed.";
  return {
    content: [{ type: "text" as const, text: `Gapwise campus intelligence: ${message}` }],
    structuredContent: { error: "campus_intelligence_error", message },
    isError: true,
  };
}

export function registerPublicCampusTools(server: McpRegistrar): void {
  server.registerTool(
    "list_utm_buildings",
    {
      title: "List UTM buildings known to Gapwise",
      description:
        "List canonical UTM buildings and Gapwise's current routing/accessibility coverage and provenance. This is public stateless campus data: it does not read the user's timetable, account, friends, location, or private sync state. Use canonical building codes returned here for routing questions.",
      inputSchema: z.object({}).strict(),
      outputSchema: PublicBuildingsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const value = await listUtmBuildings();
        return ok(formatPublicBuildings(value.buildings), value);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_utm_building",
    {
      title: "Get a UTM building from Gapwise",
      description:
        "Resolve one exact canonical UTM building by code, official name, or known alias and return Gapwise routing coverage, accessibility state and provenance. Fails closed on unknown or ambiguous names rather than guessing.",
      inputSchema: z.object({ query: z.string().min(1).max(240) }).strict(),
      outputSchema: PublicBuildingOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      try {
        const value = await getUtmBuilding(query);
        return ok(formatPublicBuilding(value.building), value);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "route_between_utm_buildings",
    {
      title: "Route between UTM buildings with Gapwise",
      description:
        "Ask Gapwise's deterministic campus routing engine for a building-to-building route. Returns routed/approximate/unavailable status, verification, time/distance and warnings without exposing the routing graph. Preserve the returned uncertainty exactly; step-free mode never invents an accessible route. For personalized planning, first read the user's delegated routing preferences when permission allows and pass them here.",
      inputSchema: z
        .object({
          from: z.string().min(1).max(240),
          to: z.string().min(1).max(240),
          mode: z.enum(["fastest", "prefer-indoor", "step-free"]).optional(),
          walkingSpeedMps: z.number().min(0.5).max(3).optional(),
          transitionBufferMinutes: z.number().int().min(0).max(60).optional(),
        })
        .strict(),
      outputSchema: PublicRouteOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const value = await routeBetweenUtmBuildings(args);
        return ok(formatPublicRoute(value.route), value);
      } catch (error) {
        return failure(error);
      }
    },
  );
}
