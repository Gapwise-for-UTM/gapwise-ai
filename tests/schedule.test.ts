import { describe, expect, it } from "vitest";
import { daySchedule, gapContext, weekSchedule } from "@/src/domain/schedule";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 7,
  generatedAt: "2026-08-18T16:30:00.000Z",
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
      isReservedAssessmentWindow: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
      excludedDates: ["2026-10-12"],
      recurrenceIntervalWeeks: 1,
    },
    {
      id: "m2",
      courseCode: "CSC110Y5",
      activityType: "LEC",
      sectionCode: "LEC0101",
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
      dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
      recurrenceIntervalWeeks: 1,
    },
  ],
  personalItems: [],
  gapPlans: [
    {
      id: "m1--m2",
      term: "Fall",
      weekday: "Monday",
      startTime: 660,
      endTime: 780,
      durationMinutes: 120,
      previousMeetingId: "m1",
      nextMeetingId: "m2",
      assessment: {
        primary: {
          id: "productivity-study-block",
          action: "study-block",
          title: "Focused study",
          summary: "Enough for one meaningful study session without rushing the transition.",
          score: 89,
          activityMinutes: 95,
          reasons: ["15 min is protected for travel and transition risk."],
          tags: ["route-verified"],
          timeline: [
            { kind: "activity", label: "Focused study", minutes: 95 },
            { kind: "travel", label: "Travel", minutes: 10 },
            { kind: "buffer", label: "Buffer", minutes: 5 },
          ],
        },
        alternatives: [],
        confidence: 0.95,
        confidenceLabel: "high",
        travelMinutes: 10,
        bufferMinutes: 5,
        leaveByMinutes: 765,
        arrivalMinutes: 775,
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

describe("delegated schedule queries", () => {
  it("uses source-backed dates and exclusions", () => {
    expect(daySchedule(snapshot, "2026-09-07").meetings).toHaveLength(2);
    expect(daySchedule(snapshot, "2026-09-07").gapPlans).toHaveLength(1);
    expect(daySchedule(snapshot, "2026-10-12").meetings).toHaveLength(1);
    expect(daySchedule(snapshot, "2026-10-12").gapPlans).toHaveLength(0);
    expect(daySchedule(snapshot, "2026-12-14").meetings).toHaveLength(0);
    expect(daySchedule(snapshot, "2026-12-14").gapPlans).toHaveLength(0);
  });

  it("does not invent weekend meetings", () => {
    expect(daySchedule(snapshot, "2026-09-12").meetings).toHaveLength(0);
    expect(daySchedule(snapshot, "2026-09-12").gapPlans).toHaveLength(0);
  });

  it("returns the normalized term timetable and delegated Gapwise plan", () => {
    const week = weekSchedule(snapshot, "Fall");
    expect(week.revision).toBe(7);
    expect(week.meetings.map((meeting) => meeting.courseCode)).toEqual(["MAT157Y5", "CSC110Y5"]);
    expect(week.gapPlans).toHaveLength(1);
    expect(week.gapPlans[0]?.assessment.routeStatus).toBe("routed");
  });

  it("returns the exact precomputed Gapwise assessment for a matching gap", () => {
    const context = gapContext(snapshot, {
      term: "Fall",
      weekday: "Monday",
      startTime: 660,
      endTime: 780,
    });
    expect(context.planningStatus).toBe("gapwise_deterministic_assessment");
    expect(context.gapPlan?.assessment.leaveByMinutes).toBe(765);
    expect(context.gapPlan?.assessment.primary.action).toBe("study-block");
  });

  it("fails closed when no delegated Gapwise assessment matches", () => {
    const context = gapContext(snapshot, {
      term: "Fall",
      weekday: "Monday",
      startTime: 665,
      endTime: 775,
    });
    expect(context.gapPlan).toBeNull();
    expect(context.planningStatus).toBe("no_matching_gap_plan");
  });
});