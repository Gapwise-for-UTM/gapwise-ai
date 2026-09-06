import { describe, expect, it } from "vitest";
import { groupGapPlans } from "@/src/domain/assistant-data";
import type { AiSnapshot } from "@/src/domain/schemas";

type GapPlan = AiSnapshot["gapPlans"][number];

function plan(id: string, weekday: GapPlan["weekday"], reason: string): GapPlan {
  return {
    id,
    term: "Fall",
    weekday,
    startTime: 720,
    endTime: 840,
    durationMinutes: 120,
    previousMeetingId: `${id}-before`,
    nextMeetingId: `${id}-after`,
    assessment: {
      primary: {
        id: `primary-${id}`,
        action: "study-block",
        title: "Focused study",
        summary: "Use the gap for focused study.",
        score: 90,
        activityMinutes: 90,
        reasons: [reason],
        tags: ["route-verified"],
        timeline: [
          { kind: "activity", label: "Study", minutes: 90 },
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

describe("gap-plan grouping equivalence", () => {
  it("does not collapse plans whose rich recommendation evidence differs", () => {
    const groups = groupGapPlans([
      plan("wed", "Wednesday", "Library is nearby."),
      plan("fri", "Friday", "Student centre is nearby."),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("still ignores recommendation ids when the actual plan semantics match", () => {
    const groups = groupGapPlans([
      plan("wed", "Wednesday", "Same evidence."),
      plan("fri", "Friday", "Same evidence."),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.appliesTo).toEqual(["Wednesday", "Friday"]);
  });
});
