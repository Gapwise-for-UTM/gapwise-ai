import { findAvailableWindows } from "@/src/domain/decision";
import type { AiSnapshot } from "@/src/domain/schemas";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
type Term = AiSnapshot["schedule"][number]["term"];
type Weekday = (typeof WEEKDAYS)[number];
type GapPlan = AiSnapshot["gapPlans"][number];

export type WeeklyAvailabilityQuery = {
  term: Term;
  minimumDurationMinutes: number;
  windowStart?: number;
  windowEnd?: number;
  maxResults: number;
};

function containingGapPlan(
  snapshot: AiSnapshot,
  term: Term,
  weekday: Weekday,
  startTime: number,
  endTime: number,
): GapPlan | null {
  if (!snapshot.permissions.readGapPlans) return null;
  return (
    snapshot.gapPlans
      .filter(
        (plan) =>
          plan.term === term &&
          plan.weekday === weekday &&
          plan.startTime <= startTime &&
          plan.endTime >= endTime,
      )
      .sort((a, b) => a.durationMinutes - b.durationMinutes)[0] ?? null
  );
}

function usableMinutes(rawDurationMinutes: number, plan: GapPlan | null): number {
  if (!plan) return rawDurationMinutes;
  if (plan.assessment.routeStatus === "unavailable") return 0;
  return Math.min(rawDurationMinutes, plan.assessment.primary.activityMinutes);
}

export function findWeeklyAvailableWindows(snapshot: AiSnapshot, query: WeeklyAvailabilityQuery) {
  const windows = WEEKDAYS.flatMap((weekday) => {
    const raw = findAvailableWindows(snapshot, {
      scope: { kind: "term_weekday", term: query.term, weekday },
      minimumDurationMinutes: 1,
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
      maxResults: 20,
    });

    return raw.windows.map((window) => {
      const gapPlan =
        window.gapPlan ??
        containingGapPlan(snapshot, query.term, weekday, window.startTime, window.endTime);
      const effectiveMinutes = usableMinutes(window.durationMinutes, gapPlan);
      return {
        weekday,
        startTime: window.startTime,
        endTime: window.endTime,
        rawDurationMinutes: window.durationMinutes,
        usableActivityMinutes: effectiveMinutes,
        planningValidation: gapPlan
          ? gapPlan.assessment.routeStatus === "unavailable"
            ? ("gapwise_transition_unavailable" as const)
            : ("gapwise_activity_budget" as const)
          : ("temporal_only" as const),
        previousBoundary: window.previousBoundary,
        nextBoundary: window.nextBoundary,
        flexiblePersonalItems: window.flexiblePersonalItems,
        gapPlan,
      };
    });
  })
    .filter((window) => window.usableActivityMinutes >= query.minimumDurationMinutes)
    .sort(
      (a, b) =>
        b.usableActivityMinutes - a.usableActivityMinutes ||
        WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
        a.startTime - b.startTime,
    )
    .slice(0, query.maxResults);

  return {
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    term: query.term,
    minimumDurationMinutes: query.minimumDurationMinutes,
    searchBounds:
      query.windowStart !== undefined && query.windowEnd !== undefined
        ? { startTime: query.windowStart, endTime: query.windowEnd }
        : null,
    windows,
    status: windows.length ? ("available_windows_found" as const) : ("no_matching_window" as const),
    interpretation:
      "When a delegated Gapwise gap assessment contains a window, usableActivityMinutes is capped by Gapwise's authoritative primary activity budget and becomes zero if the surrounding route is unavailable. Windows without a delegated gap assessment are temporal-only and do not imply validated transition travel.",
  };
}
