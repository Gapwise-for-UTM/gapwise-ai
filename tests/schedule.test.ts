import { describe, expect, it } from "vitest";
import { daySchedule, weekSchedule } from "@/src/domain/schedule";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 7,
  generatedAt: "2026-08-18T16:30:00.000Z",
  permissions: {
    readSchedule: true,
    readPersonal: false,
    writePersonal: false,
    readGapPreferences: false,
    writeGapPreferences: false,
    readRoutingPreferences: false,
  },
  schedule: [
    {
      id: "m1",
      courseCode: "MAT157Y5",
      activityType: "LEC",
      sectionCode: "LEC0101",
      courseName: "Analysis I",
      startTime: 600,
      endTime: 660,
      weekday: "Monday",
      buildingCode: "MN",
      room: "1210",
      term: "Fall",
      locationUnknown: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
      excludedDates: ["2026-10-12"],
      recurrenceIntervalWeeks: 1,
    },
  ],
  personalItems: [],
  gapPreferences: null,
  routingPreferences: null,
};

describe("delegated schedule queries", () => {
  it("uses source-backed dates and exclusions", () => {
    expect(daySchedule(snapshot, "2026-09-07").meetings).toHaveLength(1);
    expect(daySchedule(snapshot, "2026-10-12").meetings).toHaveLength(0);
    expect(daySchedule(snapshot, "2026-12-14").meetings).toHaveLength(0);
  });

  it("does not invent weekend meetings", () => {
    expect(daySchedule(snapshot, "2026-09-12").meetings).toHaveLength(0);
  });

  it("returns the normalized term timetable", () => {
    const week = weekSchedule(snapshot, "Fall");
    expect(week.revision).toBe(7);
    expect(week.meetings.map((meeting) => meeting.courseCode)).toEqual(["MAT157Y5"]);
  });
});
