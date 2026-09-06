import { describe, expect, it } from "vitest";
import {
  groupGapPlans,
  groupGapPlansByDate,
  scheduleDataFlags,
} from "@/src/domain/assistant-data";
import type { AiSnapshot } from "@/src/domain/schemas";

type Meeting = AiSnapshot["schedule"][number];
type GapPlan = AiSnapshot["gapPlans"][number];

function mat223Meeting(
  id: string,
  weekday: Meeting["weekday"],
  startTime: number,
  endTime: number,
): Meeting {
  return {
    id,
    courseCode: "MAT223H5",
    activityType: "LEC",
    sectionCode: "LEC0101",
    courseName: "Linear Algebra I",
    startTime,
    endTime,
    weekday,
    buildingCode: null,
    room: null,
    term: "Fall",
    locationUnknown: true,
    isReservedAssessmentWindow: false,
    locationType: "tba",
  };
}

function boundaryMeeting(
  id: string,
  weekday: Meeting["weekday"],
  courseCode: string,
  buildingCode: string,
): Meeting {
  return {
    id,
    courseCode,
    activityType: "LEC",
    sectionCode: "LEC0101",
    courseName: courseCode,
    startTime: id.includes("before") ? 660 : 840,
    endTime: id.includes("before") ? 720 : 900,
    weekday,
    buildingCode,
    room: "1000",
    term: "Fall",
    locationUnknown: false,
    isReservedAssessmentWindow: false,
    locationType: "physical",
  };
}

function plan(id: string, weekday: GapPlan["weekday"], previousMeetingId: string, nextMeetingId: string): GapPlan {
  return {
    id,
    term: "Fall",
    weekday,
    startTime: 720,
    endTime: 840,
    durationMinutes: 120,
    previousMeetingId,
    nextMeetingId,
    assessment: {
      primary: {
        id: `study-${id}`,
        action: "meal-window",
        title: "Lunch, then reset",
        summary: "Use the gap for lunch and a short reset.",
        score: 88,
        activityMinutes: 90,
        reasons: ["The gap overlaps the configured lunch window."],
        tags: ["lunch-time", "route-verified"],
        timeline: [
          { kind: "activity", label: "Lunch and reset", minutes: 90 },
          { kind: "travel", label: "Travel", minutes: 20 },
          { kind: "buffer", label: "Buffer", minutes: 10 },
        ],
      },
      alternatives: [],
      confidence: 0.9,
      confidenceLabel: "high",
      travelMinutes: 20,
      bufferMinutes: 10,
      leaveByMinutes: 810,
      arrivalMinutes: 830,
      fallback: false,
      routeStatus: "routed",
      routeAccuracy: "Verified outdoor route, indoor estimate",
      warnings: [],
    },
  };
}

describe("assistant-facing MCP data helpers", () => {
  it("flags suspicious course schedules without claiming they are definitely wrong", () => {
    const meetings: Meeting[] = [
      mat223Meeting("tue", "Tuesday", 540, 600),
      mat223Meeting("thu-am", "Thursday", 540, 660),
      mat223Meeting("thu-pm", "Thursday", 1140, 1260),
    ];

    const flags = scheduleDataFlags(meetings);
    expect(flags.map((flag) => flag.code)).toContain("high_section_weekly_minutes");
    expect(flags.map((flag) => flag.code)).toContain("multiple_same_section_day_windows");
    expect(flags.map((flag) => flag.code)).toContain("late_meeting");
    expect(
      flags.find((flag) => flag.code === "high_section_weekly_minutes")?.evidence.weeklyMinutes,
    ).toBe(300);
    expect(flags.every((flag) => /verify|confirm|unexpected|unusually/iu.test(flag.message))).toBe(true);
  });

  it("groups equivalent gap plans once and lists all applicable weekdays", () => {
    const meetings: Meeting[] = [
      boundaryMeeting("wed-before", "Wednesday", "MAT157Y5", "MN"),
      boundaryMeeting("wed-after", "Wednesday", "CSC110Y5", "DH"),
      boundaryMeeting("fri-before", "Friday", "MAT157Y5", "MN"),
      boundaryMeeting("fri-after", "Friday", "CSC110Y5", "DH"),
    ];
    const groups = groupGapPlans(
      [
        plan("wed", "Wednesday", "wed-before", "wed-after"),
        plan("fri", "Friday", "fri-before", "fri-after"),
      ],
      meetings,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.appliesTo).toEqual(["Wednesday", "Friday"]);
    expect(groups[0]?.sourceGapPlanIds).toEqual(["wed", "fri"]);
    expect(groups[0]).toMatchObject({
      previousCourseCode: "MAT157Y5",
      previousBuildingCode: "MN",
      nextCourseCode: "CSC110Y5",
      nextBuildingCode: "DH",
      primaryTitle: "Lunch, then reset",
      usableActivityMinutes: 90,
      leaveByMinutes: 810,
      confidencePercent: 90,
    });
  });

  it("does not merge visually identical plans when their boundary facts differ", () => {
    const meetings: Meeting[] = [
      boundaryMeeting("wed-before", "Wednesday", "MAT157Y5", "MN"),
      boundaryMeeting("wed-after", "Wednesday", "CSC110Y5", "DH"),
      boundaryMeeting("fri-before", "Friday", "MAT223H5", "DV"),
      boundaryMeeting("fri-after", "Friday", "CSC110Y5", "DH"),
    ];
    const groups = groupGapPlans(
      [
        plan("wed", "Wednesday", "wed-before", "wed-after"),
        plan("fri", "Friday", "fri-before", "fri-after"),
      ],
      meetings,
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.previousCourseCode)).toEqual(["MAT157Y5", "MAT223H5"]);
  });

  it("groups repeated range occurrences with appliesToDates", () => {
    const repeated = plan("wed", "Wednesday", "wed-before", "wed-after");
    const meetings: Meeting[] = [
      boundaryMeeting("wed-before", "Wednesday", "MAT157Y5", "MN"),
      boundaryMeeting("wed-after", "Wednesday", "CSC110Y5", "DH"),
    ];
    const groups = groupGapPlansByDate(
      [
        { date: "2026-09-09", gapPlans: [repeated] },
        { date: "2026-09-16", gapPlans: [repeated] },
      ],
      meetings,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.appliesToDates).toEqual(["2026-09-09", "2026-09-16"]);
    expect(groups[0]?.previousCourseCode).toBe("MAT157Y5");
  });
});
