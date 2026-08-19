import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listUtmBuildings,
  planUtmGapWindow,
  routeBetweenUtmBuildings,
  type PublicBuilding,
  type PublicGapPlan,
  type PublicRoute,
} from "@/src/domain/public-campus";
import {
  formatPublicGapPlan,
  formatPublicRoute,
} from "@/src/mcp/public-campus-formatters";

const building: PublicBuilding = {
  code: "MN",
  name: "Maanjiwe nendamowinan",
  category: "academic",
  aliases: ["MAANJIWE NENDAMOWINAN BUILDING"],
  routingCoverage: "mapped",
  entranceCount: 1,
  verifiedEntranceCount: 1,
  accessibility: "unknown",
  indoorRoomNodeCount: 0,
  provenance: [
    {
      source: "OpenStreetMap",
      sourceUrl: "https://www.openstreetmap.org/",
      lastVerified: "2026-08-10",
      verificationStatus: "verified",
    },
  ],
};

const ib = { ...building, code: "IB", name: "Instructional Centre" };
const route: PublicRoute = {
  dataVersion: "2026-08-10",
  from: building,
  to: ib,
  preferences: { mode: "prefer-indoor", walkingSpeedMps: 1.2, transitionBufferMinutes: 7 },
  status: "routed",
  accuracy: "Mapped campus path, indoor estimate",
  totalDistanceMeters: 180,
  indoorDistanceMeters: 0,
  outdoorDistanceMeters: 180,
  estimatedSeconds: 150,
  floorChanges: 0,
  warnings: ["Indoor room routing is not included."],
  routeVerification: "mixed",
};

beforeEach(() => {
  process.env.GAPWISE_SUPABASE_URL = "https://example.supabase.co";
  process.env.GAPWISE_SUPABASE_PUBLISHABLE_KEY = "publishable-key-with-enough-length";
  process.env.GAPWISE_AI_DATA_KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=";
  process.env.GAPWISE_APP_ORIGIN = "https://gapwise.ca";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public campus intelligence adapter", () => {
  it("reads canonical public buildings from gapwise.ca", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ service: "gapwise-public-campus", buildings: [building] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const value = await listUtmBuildings();
    expect(value.buildings[0]?.code).toBe("MN");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://gapwise.ca/api/utm-buildings"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("passes bounded route preferences to the deterministic Gapwise API", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        from: "MN",
        to: "IB",
        preferences: {
          mode: "prefer-indoor",
          walkingSpeedMps: 1.2,
          transitionBufferMinutes: 7,
        },
      });
      return new Response(
        JSON.stringify({ service: "gapwise-public-campus", route }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const value = await routeBetweenUtmBuildings({
      from: "MN",
      to: "IB",
      mode: "prefer-indoor",
      walkingSpeedMps: 1.2,
      transitionBufferMinutes: 7,
    });
    expect(value.route.status).toBe("routed");
    expect(formatPublicRoute(value.route)).toContain("verification: mixed");
    expect(formatPublicRoute(value.route)).toContain("Do not upgrade approximate/unavailable");
  });

  it("passes an exact free window to Gapwise instead of doing model-side gap arithmetic", async () => {
    const gapPlan: PublicGapPlan = {
      dataVersion: "2026-08-10",
      gap: {
        term: "Fall",
        weekday: "Wednesday",
        startTime: 660,
        endTime: 780,
        durationMinutes: 120,
        from: building,
        to: ib,
      },
      route,
      gapPreferences: {
        setupMinutes: 4,
        packUpMinutes: 3,
        lunchWindowStart: 690,
        lunchWindowEnd: 870,
        mealDurationMinutes: 30,
        willingToLeaveCampus: false,
        oneWayHomeCommuteMinutes: null,
        minimumHomeStayMinutes: 90,
        homeTurnaroundMinutes: 10,
        riskTolerance: "low",
      },
      assessment: {
        primary: {
          id: "meal-window",
          action: "meal-window",
          title: "Lunch fits comfortably",
          summary: "30 min protected for eating, with time left for studying or resting.",
          score: 93,
          activityMinutes: 103,
          reasons: ["Meal target fits."],
          tags: ["lunch-time", "route-verified"],
          timeline: [
            { kind: "setup", label: "Settle in", minutes: 4 },
            { kind: "activity", label: "Meal + flexible time", minutes: 103 },
            { kind: "setup", label: "Pack up", minutes: 3 },
            { kind: "travel", label: "Travel", minutes: 3 },
            { kind: "buffer", label: "Buffer", minutes: 7 },
          ],
        },
        alternatives: [],
        confidence: 0.83,
        confidenceLabel: "high",
        travelMinutes: 3,
        bufferMinutes: 7,
        leaveByMinutes: 770,
        arrivalMinutes: 773,
        fallback: false,
        routeStatus: "routed",
        routeAccuracy: "Mapped campus path, indoor estimate",
        warnings: ["Indoor room routing is not included."],
      },
    };
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.toString()).toBe("https://gapwise.ca/api/utm-gap-plan");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        from: "MN",
        to: "IB",
        term: "Fall",
        weekday: "Wednesday",
        startTime: 660,
        endTime: 780,
      });
      return new Response(
        JSON.stringify({ service: "gapwise-public-campus", gapPlan }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const value = await planUtmGapWindow({
      from: "MN",
      to: "IB",
      term: "Fall",
      weekday: "Wednesday",
      startTime: 660,
      endTime: 780,
      routePreferences: {
        mode: "prefer-indoor",
        walkingSpeedMps: 1.2,
        transitionBufferMinutes: 7,
      },
      gapPreferences: gapPlan.gapPreferences,
    });
    expect(value.gapPlan.assessment.primary.title).toBe("Lunch fits comfortably");
    expect(formatPublicGapPlan(value.gapPlan)).toContain("leave by 12:50");
    expect(formatPublicGapPlan(value.gapPlan)).toContain("authoritative computation");
  });
});
