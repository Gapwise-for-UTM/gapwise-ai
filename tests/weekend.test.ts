import { describe, expect, it } from "vitest";
import { findWeeklyAvailableWindows } from "@/src/domain/availability";
import { checkPlanFeasibility, decisionContext, findAvailableWindows } from "@/src/domain/decision";
import { AiActionSchema, AiSnapshotSchema, type AiSnapshot } from "@/src/domain/schemas";
import { daySchedule, gapContext, weekSchedule, weekdayForDate } from "@/src/domain/schedule";

const permissions = {
  readSchedule: true as const,
  readPersonal: true,
  writePersonal: true,
  readGapPlans: true,
  readGapPreferences: false,
  writeGapPreferences: false,
  readRoutingPreferences: false,
};

function meeting(
  id: string,
  weekday: "Saturday" | "Sunday",
  startTime: number,
  endTime: number,
  startDate: string,
) {
  return {
    id,
    courseCode: id.startsWith("sat") ? "CSC110Y5" : "MAT102H5",
    activityType: "LEC" as const,
    sectionCode: "LEC0101",
    courseName: `Synthetic ${id}`,
    startTime,
    endTime,
    weekday,
    buildingCode: "IB",
    room: "110",
    term: "Fall" as const,
    locationUnknown: false,
    locationType: "physical" as const,
    dateRange: { startDate, endDate: "2026-12-06" },
    recurrenceIntervalWeeks: 1,
  };
}

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 11,
  generatedAt: "2026-09-01T12:00:00.000Z",
  permissions,
  schedule: [
    meeting("sat-a", "Saturday", 600, 660, "2026-09-05"),
    meeting("sat-b", "Saturday", 780, 840, "2026-09-05"),
    meeting("sun-a", "Sunday", 540, 600, "2026-09-06"),
    meeting("sun-b", "Sunday", 720, 780, "2026-09-06"),
  ],
  personalItems: [
    {
      id: "weekend-study",
      title: "Weekend study",
      category: "Study",
      term: "Fall",
      weekday: "Sunday",
      startTime: 840,
      endTime: 900,
      locationBuildingCode: "IB",
      locationRoom: "120",
      locationText: null,
      flexibility: { kind: "fixed" },
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    },
  ],
  gapPlans: [],
  gapPreferences: null,
  routingPreferences: null,
};

describe("weekend delegation and planning", () => {
  it("accepts Saturday and Sunday across snapshot and write schemas", () => {
    expect(AiSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      AiActionSchema.safeParse({
        schemaVersion: 1,
        kind: "create_personal_item",
        expectedRevision: 11,
        item: {
          title: "Saturday review",
          category: "Study",
          term: "Fall",
          weekday: "Saturday",
          startTime: 900,
          endTime: 960,
          flexibility: { kind: "fixed" },
        },
      }).success,
    ).toBe(true);
    expect(
      AiActionSchema.safeParse({
        schemaVersion: 1,
        kind: "update_personal_item",
        expectedRevision: 11,
        itemId: "weekend-study",
        patch: { weekday: "Sunday" },
      }).success,
    ).toBe(true);
  });

  it("maps real weekend calendar dates and returns weekend day schedules", () => {
    expect(weekdayForDate("2026-09-05")).toBe("Saturday");
    expect(weekdayForDate("2026-09-06")).toBe("Sunday");
    expect(daySchedule(snapshot, "2026-09-05").meetings.map((item) => item.id)).toEqual([
      "sat-a",
      "sat-b",
    ]);
    const sunday = daySchedule(snapshot, "2026-09-06");
    expect(sunday.weekday).toBe("Sunday");
    expect(sunday.meetings.map((item) => item.id)).toEqual(["sun-a", "sun-b"]);
    expect(sunday.personalItems.map((item) => item.id)).toEqual(["weekend-study"]);
  });

  it("orders Saturday and Sunday after Friday in the normalized term week", () => {
    const week = weekSchedule(snapshot, "Fall");
    expect(week.meetings.map((item) => item.weekday)).toEqual([
      "Saturday",
      "Saturday",
      "Sunday",
      "Sunday",
    ]);
  });

  it("finds bounded Saturday and Sunday availability", () => {
    const saturday = findAvailableWindows(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Saturday" },
      minimumDurationMinutes: 60,
      maxResults: 10,
    });
    expect(saturday.windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startTime: 660, endTime: 780, durationMinutes: 120 }),
      ]),
    );

    const weekly = findWeeklyAvailableWindows(snapshot, {
      term: "Fall",
      minimumDurationMinutes: 60,
      maxResults: 10,
    });
    expect(weekly.windows.map((window) => window.weekday)).toEqual(
      expect.arrayContaining(["Saturday", "Sunday"]),
    );
  });

  it("includes all seven weekdays in decision context", () => {
    const context = decisionContext(snapshot, "Fall");
    expect(context.days).toHaveLength(7);
    expect(context.days.map((day) => day.weekday)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(context.days.find((day) => day.weekday === "Saturday")?.academicMeetingCount).toBe(2);
    expect(context.days.find((day) => day.weekday === "Sunday")?.fixedPersonalCount).toBe(1);
  });

  it("checks weekend plan feasibility against weekend academic boundaries", () => {
    const result = checkPlanFeasibility(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Saturday" },
      startTime: 660,
      endTime: 720,
    });
    expect(result.weekday).toBe("Saturday");
    expect(result.feasible).toBe(true);
    expect(result.previousBoundary?.id).toBe("sat-a");
    expect(result.nextBoundary?.id).toBe("sat-b");
  });

  it("accepts weekend gap-context queries without inventing a plan", () => {
    const context = gapContext(snapshot, {
      term: "Fall",
      weekday: "Sunday",
      startTime: 600,
      endTime: 720,
    });
    expect(context.weekday).toBe("Sunday");
    expect(context.previous?.id).toBe("sun-a");
    expect(context.next?.id).toBe("sun-b");
    expect(context.gapPlan).toBeNull();
    expect(context.planningStatus).toBe("no_matching_gap_plan");
  });
});
