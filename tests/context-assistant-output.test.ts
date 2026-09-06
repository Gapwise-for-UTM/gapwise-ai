import { describe, expect, it } from "vitest";
import { getCourseContext, getScheduleRange } from "@/src/domain/context";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 2,
  generatedAt: "2026-09-06T17:00:00.000Z",
  permissions: {
    readSchedule: true,
    readPersonal: false,
    writePersonal: false,
    readGapPlans: true,
    readGapPreferences: false,
    writeGapPreferences: false,
    readRoutingPreferences: false,
  },
  schedule: [
    {
      id: "csc-lec",
      courseCode: "CSC110Y5",
      activityType: "LEC",
      sectionCode: "LEC0101",
      courseName: "Foundations of Computer Science",
      startTime: 600,
      endTime: 660,
      weekday: "Wednesday",
      buildingCode: "MN",
      room: "1210",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-09", endDate: "2026-12-02" },
    },
    {
      id: "csc-next",
      courseCode: "MAT157Y5",
      activityType: "LEC",
      sectionCode: "LEC0101",
      courseName: "Analysis I",
      startTime: 780,
      endTime: 840,
      weekday: "Wednesday",
      buildingCode: "DH",
      room: "2020",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-09", endDate: "2026-12-02" },
    },
    {
      id: "csc-res",
      courseCode: "CSC110Y5",
      activityType: "LEC",
      sectionCode: "LEC0101",
      courseName: "Foundations of Computer Science",
      startTime: 600,
      endTime: 720,
      weekday: "Saturday",
      buildingCode: null,
      room: null,
      term: "Fall",
      locationUnknown: true,
      isReservedAssessmentWindow: true,
      locationType: "tba",
    },
  ],
  personalItems: [],
  gapPlans: [
    {
      id: "csc-lec--csc-next",
      term: "Fall",
      weekday: "Wednesday",
      startTime: 660,
      endTime: 780,
      durationMinutes: 120,
      previousMeetingId: "csc-lec",
      nextMeetingId: "csc-next",
      assessment: {
        primary: {
          id: "meal",
          action: "meal-window",
          title: "Lunch, then reset",
          summary: "Use the gap for lunch.",
          score: 88,
          activityMinutes: 90,
          reasons: [],
          tags: ["lunch-time"],
          timeline: [
            { kind: "activity", label: "Lunch", minutes: 90 },
            { kind: "travel", label: "Travel", minutes: 20 },
            { kind: "buffer", label: "Buffer", minutes: 10 },
          ],
        },
        alternatives: [],
        confidence: 0.9,
        confidenceLabel: "high",
        travelMinutes: 20,
        bufferMinutes: 10,
        leaveByMinutes: 750,
        arrivalMinutes: 770,
        fallback: false,
        routeStatus: "routed",
        routeAccuracy: "Verified outdoor route, indoor estimate",
        warnings: [],
      },
    },
  ],
  gapPreferences: null,
  routingPreferences: null,
};

describe("assistant-readable context outputs", () => {
  it("returns flat course facts while keeping RES separate", () => {
    const result = getCourseContext(snapshot, "CSC110Y5", "Fall");

    expect(result.resolutionStatus).toBe("resolved");
    expect(result.academicMeetings).toHaveLength(1);
    expect(result.reservedAssessmentWindows).toHaveLength(1);
    expect(result.meetingFacts.map((fact) => fact.componentLabel)).toEqual(["LEC", "RES"]);
    expect(result.meetingFacts.find((fact) => fact.componentLabel === "RES")?.isHardCommitment).toBe(false);
  });

  it("returns repeated range plans once with appliesToDates", () => {
    const result = getScheduleRange(snapshot, "2026-09-09", 8);

    expect(result.days[0]?.meetingFacts[0]).toMatchObject({
      courseCode: "CSC110Y5",
      componentLabel: "LEC",
      locationLabel: "MN 1210",
      isHardCommitment: true,
    });
    expect(result.gapPlanGroups).toHaveLength(1);
    expect(result.gapPlanGroups[0]).toMatchObject({
      appliesToDates: ["2026-09-09", "2026-09-16"],
      previousCourseCode: "CSC110Y5",
      nextCourseCode: "MAT157Y5",
      primaryTitle: "Lunch, then reset",
      leaveByMinutes: 750,
      confidencePercent: 90,
    });
  });
});
