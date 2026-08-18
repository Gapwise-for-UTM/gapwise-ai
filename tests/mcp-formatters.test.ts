import { describe, expect, it } from "vitest";
import { formatDaySchedule, formatGapContext, formatWeekSchedule } from "@/src/mcp/formatters";

const meeting = {
  id: "m1",
  courseCode: "MAT157Y5",
  activityType: "LEC" as const,
  sectionCode: "LEC0101",
  courseName: "Analysis I",
  startTime: 600,
  endTime: 660,
  weekday: "Monday" as const,
  buildingCode: "MN",
  room: "1210",
  term: "Fall" as const,
  locationUnknown: false,
  locationType: "physical" as const,
  dateRange: { startDate: "2026-09-07", endDate: "2026-12-07" },
  recurrenceIntervalWeeks: 1,
};

const gapPlan = {
  id: "m1--m2",
  term: "Fall" as const,
  weekday: "Monday" as const,
  startTime: 660,
  endTime: 780,
  durationMinutes: 120,
  previousMeetingId: "m1",
  nextMeetingId: "m2",
  assessment: {
    primary: {
      id: "study",
      action: "study-block" as const,
      title: "Focused study",
      summary: "Enough for one meaningful study session without rushing the transition.",
      score: 89,
      activityMinutes: 95,
      reasons: ["15 min is protected for travel and transition risk."],
      tags: ["route-verified" as const],
      timeline: [
        { kind: "activity" as const, label: "Focused study", minutes: 95 },
        { kind: "travel" as const, label: "Travel", minutes: 10 },
        { kind: "buffer" as const, label: "Buffer", minutes: 5 },
      ],
    },
    alternatives: [],
    confidence: 0.95,
    confidenceLabel: "high" as const,
    travelMinutes: 10,
    bufferMinutes: 5,
    leaveByMinutes: 765,
    arrivalMinutes: 775,
    fallback: false,
    routeStatus: "routed" as const,
    routeAccuracy: "Verified indoor + outdoor route" as const,
    warnings: [],
  },
};

describe("MCP readable text formatters", () => {
  it("puts actual course, section, time and room facts in week text", () => {
    const text = formatWeekSchedule({
      term: "Fall",
      revision: 7,
      meetings: [meeting],
      personalItems: [],
      gapPlans: [gapPlan],
    });
    expect(text).toContain("MAT157Y5 LEC0101");
    expect(text).toContain("10:00–11:00");
    expect(text).toContain("MN 1210");
    expect(text).toContain("Focused study");
    expect(text).toContain("leave by 12:45");
  });

  it("puts day meeting facts in text rather than only counts", () => {
    const text = formatDaySchedule({
      date: "2026-09-07",
      weekday: "Monday",
      term: "Fall",
      revision: 7,
      meetings: [meeting],
      personalItems: [],
      gapPlans: [],
    });
    expect(text).toContain("MAT157Y5");
    expect(text).toContain("Analysis I");
    expect(text).toContain("MN 1210");
  });

  it("renders authoritative gap route and timing facts", () => {
    const text = formatGapContext({
      revision: 7,
      term: "Fall",
      weekday: "Monday",
      requestedWindow: { startTime: 660, endTime: 780, durationMinutes: 120 },
      previous: {
        source: "academic",
        id: meeting.id,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        item: meeting,
      },
      next: null,
      gapPlan,
      gapPreferences: null,
      routingPreferences: null,
      planningStatus: "gapwise_deterministic_assessment",
    });
    expect(text).toContain("routed");
    expect(text).toContain("travel 10 min");
    expect(text).toContain("confidence high (95%)");
  });
});
