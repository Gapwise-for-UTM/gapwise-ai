import { z } from "zod";
import { getRuntimeConfig } from "@/src/config";

const VerificationStatusSchema = z.enum(["verified", "inferred", "unknown"]);
const AccessibilitySchema = z.enum(["accessible", "not_accessible", "unknown"]);
const RouteModeSchema = z.enum(["fastest", "prefer-indoor", "step-free"]);

const ProvenanceSchema = z.object({
  source: z.string(),
  sourceUrl: z.string(),
  lastVerified: z.string(),
  verificationStatus: VerificationStatusSchema,
});

export const PublicBuildingSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.enum(["academic", "residence", "facility"]),
  aliases: z.array(z.string()),
  routingCoverage: z.string(),
  entranceCount: z.number().int().nonnegative(),
  verifiedEntranceCount: z.number().int().nonnegative(),
  accessibility: AccessibilitySchema,
  indoorRoomNodeCount: z.number().int().nonnegative(),
  provenance: z.array(ProvenanceSchema),
});

export const PublicBuildingsOutputSchema = z.object({
  service: z.literal("gapwise-public-campus"),
  buildings: z.array(PublicBuildingSchema),
});

export const PublicBuildingOutputSchema = z.object({
  service: z.literal("gapwise-public-campus"),
  building: PublicBuildingSchema,
});

export const PublicRouteSchema = z.object({
  dataVersion: z.string(),
  from: PublicBuildingSchema,
  to: PublicBuildingSchema,
  preferences: z.object({
    mode: RouteModeSchema,
    walkingSpeedMps: z.number().positive(),
    transitionBufferMinutes: z.number().int().nonnegative(),
  }),
  status: z.enum(["same-building", "routed", "approximate", "unavailable"]),
  accuracy: z.enum([
    "Same building",
    "Verified outdoor route, indoor estimate",
    "Mapped campus path, indoor estimate",
    "Approximate building-to-building estimate",
    "Location unavailable",
  ]),
  totalDistanceMeters: z.number().nonnegative().nullable(),
  indoorDistanceMeters: z.number().nonnegative().nullable(),
  outdoorDistanceMeters: z.number().nonnegative().nullable(),
  estimatedSeconds: z.number().nonnegative().nullable(),
  floorChanges: z.number().nonnegative().nullable(),
  warnings: z.array(z.string()),
  routeVerification: z.enum(["verified", "mixed", "inferred", "unavailable"]),
});

export const PublicRouteOutputSchema = z.object({
  service: z.literal("gapwise-public-campus"),
  route: PublicRouteSchema,
});

export type PublicBuilding = z.infer<typeof PublicBuildingSchema>;
export type PublicRoute = z.infer<typeof PublicRouteSchema>;

class CampusIntelligenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampusIntelligenceError";
  }
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const { gapwiseAppOrigin } = getRuntimeConfig();
  const response = await fetch(new URL(path, gapwiseAppOrigin), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CampusIntelligenceError("Gapwise campus intelligence returned malformed JSON.");
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : `Gapwise campus intelligence returned HTTP ${response.status}.`;
    throw new CampusIntelligenceError(message);
  }
  return body;
}

export async function listUtmBuildings() {
  return PublicBuildingsOutputSchema.parse(await fetchJson("/api/utm-buildings"));
}

export async function getUtmBuilding(query: string) {
  const params = new URLSearchParams({ q: query });
  return PublicBuildingOutputSchema.parse(await fetchJson(`/api/utm-building?${params.toString()}`));
}

export async function routeBetweenUtmBuildings(input: {
  from: string;
  to: string;
  mode?: z.infer<typeof RouteModeSchema>;
  walkingSpeedMps?: number;
  transitionBufferMinutes?: number;
}) {
  const preferences = {
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.walkingSpeedMps !== undefined ? { walkingSpeedMps: input.walkingSpeedMps } : {}),
    ...(input.transitionBufferMinutes !== undefined
      ? { transitionBufferMinutes: input.transitionBufferMinutes }
      : {}),
  };
  return PublicRouteOutputSchema.parse(
    await fetchJson("/api/utm-route", {
      method: "POST",
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        preferences: Object.keys(preferences).length > 0 ? preferences : null,
      }),
    }),
  );
}
