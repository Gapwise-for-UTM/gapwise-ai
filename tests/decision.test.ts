import { describe, expect, it } from "vitest";
import {
  checkPlanFeasibility,
  decisionContext,
  findAvailableWindows,
} from "@/src/domain/decision";
import type { AiSnapshot } from "@/src/domain/schemas";

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 12,
  generatedAt: "2026-08-19T02:45:00.000Z",
  permissions: {
    readSchedule: true,
    readPersonal: true,
    writePersonal: true,
    readGapPlans: true,
    readGapPreferences: true,
    writeGapPreferences: false,
    readRoutingPreferences: true,
  },
  schedule: [
    {
      id: "mat",
      courseCode: "MAT157H5",
      activityType: "LEC",
      sectionCode: "0101",
      courseName: "Analysis I",
      startTime: 600,
      endTime: 660,
      weekday: "Monday",
      buildingCode: "MN",
      room: "1210",
      term: "Fall",
      locationUnknown: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-14", endDate: "2026-12-08" },
      recurrenceIntervalWeeks: 1,
    },
    {
      id: "csc",
      courseCode: "CSC110Y5",
      activityType: "LEC",
      sectionCode: "0101",
      courseName: "Foundations of Computer Science",
      startTime: 780,
      endTime: 840,
      weekday: "Monday",
      buildingCode: "DH",
      room: "2010",
      term: "Fall",
      locationUnknown: false,
      locationType: "physical",
      dateRange: { startDate: "2026-09-14", endDate: "2026-12-08" },
      recurrenceIntervalWeeks: 1,
    },
  ],
  personalItems: [
    {
      id: "flex-study",
      title: "MAT157 study",
      category: "Study",
      term: "Fall",
      weekday: "Monday",
      locationBuildingCode: "MN",
      locationRoom: null,
      locationText: null,
      flexibility: {
        kind: "flexible",
        durationMinutes: 90,
        windowStart: 660,
        windowEnd: 780,
      },
      createdAt: "2026-08-19T01:00:00.000Z",
      updatedAt: "2026-08-19T01:00:00.000Z",
    },
  ],
  gapPlans: [
    {
      id: "mat--csc",
      term: "Fall",
      weekday: "Monday",
      startTime: 660,
      endTime: 780,
      durationMinutes: 120,
      previousMeetingId: "mat",
      nextMeetingId: "csc",
      assessment: {
        primary: {
          id: "study",
          action: "study-block",
          title: "Focused study",
          summary: "A long focused block fits while preserving the next transition.",
          score: 91,
          activityMinutes: 100,
          reasons: ["20 minutes are protected for transition and buffer."],
          tags: ["route-verified"],
          timeline: [
            { kind: "activity", label: "Focused study", minutes: 100 },
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
  gapPreferences: {
    setupMinutes: 5,
    packUpMinutes: 5,
    lunchWindowStart: 690,
    lunchWindowEnd: 840,
    mealDurationMinutes: 30,
    willingToLeaveCampus: false,
    oneWayHomeCommuteMinutes: 45,
    minimumHomeStayMinutes: 60,
    homeTurnaroundMinutes: 10,
    riskTolerance: "medium",
  },
  routingPreferences: {
    mode: "prefer-indoor",
    walkingSpeedMps: 1.2,
    transitionBufferMinutes: 10,
    avoidStairs: false,
    preferIndoor: true,
    dayOrigin: "commute",
    residenceBuildingCode: null,
    commuteMode: "transit",
    campusAccessPointId: null,
  },
};

describe("Gapwise decision engine", () => {
  it("finds bounded availability and attaches the exact Gapwise gap plan", () => {
    const result = findAvailableWindows(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      minimumDurationMinutes: 90,
      maxResults: 10,
    });

    expect(result.status).toBe("available_windows_found");
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.startTime).toBe(660);
    expect(result.windows[0]?.endTime).toBe(780);
    expect(result.windows[0]?.gapPlan?.id).toBe("mat--csc");
    expect(result.windows[0]?.flexiblePersonalItems[0]?.title).toBe("MAT157 study");
  });

  it("does not assume free time outside the scheduled day without explicit bounds", () => {
    const result = findAvailableWindows(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Tuesday" },
      minimumDurationMinutes: 60,
      maxResults: 10,
    });

    expect(result.status).toBe("no_bounded_day");
    expect(result.windows).toEqual([]);
  });

  it("can search explicit user-supplied bounds", () => {
    const result = findAvailableWindows(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      minimumDurationMinutes: 60,
      windowStart: 540,
      windowEnd: 900,
      maxResults: 10,
    });

    expect(result.windows.map((window) => [window.startTime, window.endTime])).toEqual([
      [660, 780],
      [540, 600],
      [840, 900],
    ]);
  });

  it("rejects a block that conflicts with an academic meeting", () => {
    const result = checkPlanFeasibility(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      startTime: 630,
      endTime: 690,
    });

    expect(result.feasible).toBe(false);
    expect(result.validationLevel).toBe("conflict");
    expect(result.conflicts[0]?.id).toBe("mat");
  });

  it("validates a block inside the authoritative Gapwise activity envelope", () => {
    const result = checkPlanFeasibility(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      startTime: 665,
      endTime: 755,
    });

    expect(result.feasible).toBe(true);
    expect(result.validationLevel).toBe("gapwise_transition_validated");
    expect(result.gapPlan?.assessment.leaveByMinutes).toBe(760);
    expect(result.gapwiseActivityWindow).toEqual({
      startTime: 660,
      endTime: 760,
      maxActivityMinutes: 100,
      source: "primary_timeline",
    });
  });

  it("rejects a conflict-free block that overruns the Gapwise activity envelope", () => {
    const result = checkPlanFeasibility(snapshot, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      startTime: 665,
      endTime: 765,
    });

    expect(result.feasible).toBe(false);
    expect(result.validationLevel).toBe("gapwise_transition_rejected");
    expect(result.reasons.join(" ")).toContain("activity envelope ends");
  });

  it("preserves setup time instead of letting a model consume it as activity", () => {
    const withSetup: AiSnapshot = {
      ...snapshot,
      gapPlans: snapshot.gapPlans.map((plan) => ({
        ...plan,
        assessment: {
          ...plan.assessment,
          primary: {
            ...plan.assessment.primary,
            activityMinutes: 103,
            timeline: [
              { kind: "setup", label: "Settle in", minutes: 4 },
              { kind: "activity", label: "Focused study", minutes: 103 },
              { kind: "setup", label: "Pack up", minutes: 3 },
              { kind: "travel", label: "Travel", minutes: 3 },
              { kind: "buffer", label: "Buffer", minutes: 7 },
            ],
          },
          travelMinutes: 3,
          bufferMinutes: 7,
          leaveByMinutes: 770,
          arrivalMinutes: 773,
        },
      })),
    };

    const tooEarly = checkPlanFeasibility(withSetup, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      startTime: 660,
      endTime: 750,
    });
    expect(tooEarly.feasible).toBe(false);
    expect(tooEarly.gapwiseActivityWindow).toEqual({
      startTime: 664,
      endTime: 767,
      maxActivityMinutes: 103,
      source: "primary_timeline",
    });

    const valid = checkPlanFeasibility(withSetup, {
      scope: { kind: "term_weekday", term: "Fall", weekday: "Monday" },
      startTime: 664,
      endTime: 754,
    });
    expect(valid.feasible).toBe(true);
    expect(valid.validationLevel).toBe("gapwise_transition_validated");
  });

  it("summarizes the term for planning without losing authoritative gap data", () => {
    const result = decisionContext(snapshot, "Fall");

    expect(result.hardConstraintSummary.academicMeetingCount).toBe(2);
    expect(result.days[0]?.weekday).toBe("Monday");
    expect(result.days[0]?.bestGap?.id).toBe("mat--csc");
    expect(result.topGapOpportunities[0]?.assessment.primary.score).toBe(91);
    expect(result.gapPreferences?.riskTolerance).toBe("medium");
  });
});
