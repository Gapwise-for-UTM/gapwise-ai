import { describe, expect, it } from "vitest";
import { decisionContext } from "@/src/domain/decision";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 21,
  generatedAt: "2026-09-06T16:00:00.000Z",
  permissions: {
    readSchedule: true,
    readPersonal: false,
    writePersonal: false,
    readGapPlans: true,
    readGapPreferences: true,
    writeGapPreferences: true,
    readRoutingPreferences: false,
  },
  schedule: [],
  personalItems: [],
  gapPlans: [],
  gapPreferences: {
    setupMinutes: 5,
    packUpMinutes: 5,
    lunchWindowStart: 690,
    lunchWindowEnd: 840,
    mealDurationMinutes: 30,
    willingToLeaveCampus: true,
    oneWayHomeCommuteMinutes: null,
    minimumHomeStayMinutes: 90,
    homeTurnaroundMinutes: 10,
    riskTolerance: "medium",
  },
  routingPreferences: null,
};

describe("decision context setup gaps", () => {
  it("surfaces missing home commute time when leaving campus is enabled", () => {
    const result = decisionContext(snapshot, "Fall");
    expect(result.actionItems).toEqual([
      expect.objectContaining({
        code: "set_home_commute_minutes",
        field: "gapPreferences.oneWayHomeCommuteMinutes",
        resolvableViaMcp: true,
      }),
    ]);
    expect(result.actionItems[0]?.affects).toContain("go_home_recommendations");
  });

  it("does not nag for home commute time when the user will not leave campus", () => {
    const result = decisionContext(
      {
        ...snapshot,
        gapPreferences: { ...snapshot.gapPreferences!, willingToLeaveCampus: false },
      },
      "Fall",
    );
    expect(result.actionItems).toEqual([]);
  });
});
