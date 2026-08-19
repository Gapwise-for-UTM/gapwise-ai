import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listUtmBuildings,
  routeBetweenUtmBuildings,
  type PublicBuilding,
  type PublicRoute,
} from "@/src/domain/public-campus";
import { formatPublicRoute } from "@/src/mcp/public-campus-formatters";

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
});
