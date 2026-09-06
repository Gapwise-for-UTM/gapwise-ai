import { describe, expect, it } from "vitest";
import { decisionContext } from "@/src/domain/decision";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 1,
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
      id: "before",
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
      isReservedAssessmentWindow: false,
      locationType: "physical",
    },
    {
      id: "after",
      courseCode: "CSC110Y5",
      activityType: "TUT",
      sectionCode: "TUT0101",
      courseName: "Foundations of Computer Science",
      startTime: 780,
      endTime: 840,
      weekday: "Monday",
      buildingCode: "DH",
      room: "2020",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
      locationType: "physical",
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
      id: "before--after",
      term: "Fall",
      weekday: "Monday",
      startTime: 660,
      endTime: 780,
      durationMinutes: 120,
      previousMeetingId: "before",
      nextMeetingId: "after",
      assessment: {
        primary: {
          id: "study",
          action: "study-block",
          title: "Focused study",
          summary: "A focused block fits.",
          score: 90,
          activityMinutes: 100,
          reasons: [],
          tags: ["route-verified"],
          timeline: [
            { kind: "activity", label: "Study", minutes: 100 },
            { kind: "travel", label: "Travel", minutes: 10 },
            { kind: "buffer", label: "Buffer", minutes: 10 },
          ],
        },
        alternatives: [],
        confidence: 0.9,
        confidenceLabel: "high",
        travelMinutes: 10,
        bufferMinutes: 10,
        leaveByMinutes: 760,
        arrivalMinutes: 770,
        fallback: false,
        routeStatus: "routed",
        routeAccuracy: "Verified indoor + outdoor route",
        warnings: [],
      },
    },
  ],
  gapPreferences: null,
  routingPreferences: null,
};

describe("decision-context assistant data", () => {
  it("keeps surrounding course/component/location facts in the flat gap group", () => {
    const result = decisionContext(snapshot, "Fall");

    expect(result.gapPlanGroups).toHaveLength(1);
    expect(result.gapPlanGroups[0]).toMatchObject({
      previousCourseCode: "MAT157Y5",
      previousComponentLabel: "LEC",
      previousBuildingCode: "MN",
      previousRoom: "1210",
      nextCourseCode: "CSC110Y5",
      nextComponentLabel: "TUT",
      nextBuildingCode: "DH",
      nextRoom: "2020",
      usableActivityMinutes: 100,
      leaveByMinutes: 760,
      confidencePercent: 90,
    });
  });

  it("returns RES facts explicitly without counting them as hard academic load", () => {
    const result = decisionContext(snapshot, "Fall");

    expect(result.hardConstraintSummary.academicMeetingCount).toBe(2);
    expect(result.hardConstraintSummary.reservedAssessmentWindowCount).toBe(1);
    expect(result.reservedAssessmentWindows).toEqual([
      expect.objectContaining({
        id: "csc-res",
        weekday: "Saturday",
        courseCode: "CSC110Y5",
        componentLabel: "RES",
        semanticType: "reserved_assessment_window",
        isHardCommitment: false,
      }),
    ]);
  });
});
