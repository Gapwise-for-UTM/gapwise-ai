import { z } from "zod";
import { getRuntimeConfig } from "@/src/config";
import { GapPreferencesSchema, TermSchema, WeekdaySchema } from "@/src/domain/schemas";

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

export const PublicBuildingSearchOutputSchema = z.object({
  service: z.literal("gapwise-public-campus"),
  query: z.string().min(1).max(240),
  results: z.array(
    z.object({
      score: z.number().int().min(1).max(200),
      matchReasons: z.array(z.string().min(1).max(120)).max(8),
      building: PublicBuildingSchema,
    }),
  ),
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

const GapRecommendationSchema = z.object({
  id: z.string(),
  action: z.enum([
    "tight-transition",
    "quick-reset",
    "focus-sprint",
    "meal-window",
    "study-block",
    "deep-work-block",
    "flexible-long-gap",
    "leave-campus-candidate",
    "go-home",
    "location-dependent",
  ]),
  title: z.string(),
  summary: z.string(),
  score: z.number(),
  activityMinutes: z.number().int().nonnegative(),
  reasons: z.array(z.string()),
  tags: z.array(z.string()),
  timeline: z.array(
    z.object({
      kind: z.enum(["setup", "activity", "travel", "buffer", "flex"]),
      label: z.string(),
      minutes: z.number().int().nonnegative(),
    }),
  ),
});

const PublicGapAssessmentSchema = z.object({
  primary: GapRecommendationSchema,
  alternatives: z.array(GapRecommendationSchema),
  confidence: z.number().min(0).max(1),
  confidenceLabel: z.enum(["high", "medium", "low"]),
  travelMinutes: z.number().int().nonnegative().nullable(),
  bufferMinutes: z.number().int().nonnegative(),
  leaveByMinutes: z.number().int(),
  arrivalMinutes: z.number().int().nullable(),
  fallback: z.boolean(),
  routeStatus: z.enum(["routed", "approximate", "same-room", "unavailable"]),
  routeAccuracy: z.enum([
    "Verified indoor + outdoor route",
    "Verified outdoor route, indoor estimate",
    "Mapped campus path, indoor estimate",
    "Approximate building-to-building estimate",
    "Location unavailable",
  ]),
  warnings: z.array(z.string()),
});

export const PublicGapPlanSchema = z.object({
  dataVersion: z.string(),
  gap: z.object({
    term: TermSchema,
    weekday: WeekdaySchema,
    startTime: z.number().int().min(0).max(1440),
    endTime: z.number().int().min(0).max(1440),
    durationMinutes: z.number().int().positive(),
    from: PublicBuildingSchema,
    to: PublicBuildingSchema,
  }),
  route: PublicRouteSchema,
  gapPreferences: GapPreferencesSchema,
  assessment: PublicGapAssessmentSchema,
});

export const PublicGapPlanOutputSchema = z.object({
  service: z.literal("gapwise-public-campus"),
  gapPlan: PublicGapPlanSchema,
});

export type PublicBuilding = z.infer<typeof PublicBuildingSchema>;
export type PublicRoute = z.infer<typeof PublicRouteSchema>;
export type PublicGapPlan = z.infer<typeof PublicGapPlanSchema>;

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

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("en-CA").replace(/[^a-z0-9]+/gu, " ").trim();
}

function buildingMatch(query: string, building: PublicBuilding) {
  const q = normalizeSearch(query);
  const compactQuery = q.replace(/\s+/gu, "");
  const candidates = [
    ["code", building.code, 200, 190, 180, 170],
    ["official name", building.name, 185, 170, 160, 150],
    ...building.aliases.map((alias) => ["alias", alias, 180, 165, 155, 145] as const),
  ] as const;
  let score = 0;
  const reasons: string[] = [];
  for (const [label, raw, exact, prefix, token, contains] of candidates) {
    const value = normalizeSearch(raw);
    let current = 0;
    if (value === q) current = exact;
    else if (value.startsWith(q)) current = prefix;
    else if (value.split(/\s+/u).some((part) => part === q || part.startsWith(q))) current = token;
    else if (value.includes(q)) current = contains;
    else if (compactQuery && value.replace(/\s+/gu, "").includes(compactQuery)) current = contains - 5;
    if (current > 0) reasons.push(label);
    score = Math.max(score, current);
  }
  return { score, reasons: [...new Set(reasons)] };
}

export async function searchUtmBuildings(query: string, maxResults = 8) {
  const { buildings } = await listUtmBuildings();
  const results = buildings
    .map((building) => {
      const match = buildingMatch(query, building);
      return { score: match.score, matchReasons: match.reasons, building };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.building.code.localeCompare(b.building.code))
    .slice(0, maxResults);
  return PublicBuildingSearchOutputSchema.parse({
    service: "gapwise-public-campus",
    query,
    results,
  });
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

export async function planUtmGapWindow(input: {
  from: string;
  to: string;
  term: z.infer<typeof TermSchema>;
  weekday: z.infer<typeof WeekdaySchema>;
  startTime: number;
  endTime: number;
  routePreferences?: {
    mode?: z.infer<typeof RouteModeSchema>;
    walkingSpeedMps?: number;
    transitionBufferMinutes?: number;
  } | null;
  gapPreferences?: Partial<z.infer<typeof GapPreferencesSchema>> | null;
}) {
  return PublicGapPlanOutputSchema.parse(
    await fetchJson("/api/utm-gap-plan", {
      method: "POST",
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        term: input.term,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        routePreferences: input.routePreferences ?? null,
        gapPreferences: input.gapPreferences ?? null,
      }),
    }),
  );
}