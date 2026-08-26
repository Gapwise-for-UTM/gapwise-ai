import type { AiSnapshot, PersonalItem } from "@/src/domain/schemas";
import { daySchedule, weekSchedule } from "@/src/domain/schedule";

type Term = AiSnapshot["schedule"][number]["term"];
type Weekday = AiSnapshot["schedule"][number]["weekday"];
type Meeting = AiSnapshot["schedule"][number];
type GapPlan = AiSnapshot["gapPlans"][number];
type FixedPersonalItem = Extract<PersonalItem, { flexibility: { kind: "fixed" } }>;
type FlexiblePersonalItem = Extract<PersonalItem, { flexibility: { kind: "flexible" } }>;

export type DecisionScope =
  | { kind: "date"; date: string }
  | { kind: "term_weekday"; term: Term; weekday: Weekday };

export type AvailabilityQuery = {
  scope: DecisionScope;
  minimumDurationMinutes: number;
  windowStart?: number;
  windowEnd?: number;
  maxResults: number;
};

export type PlanFeasibilityQuery = {
  scope: DecisionScope;
  startTime: number;
  endTime: number;
  locationBuildingCode?: string | null;
  locationRoom?: string | null;
};

type Boundary = {
  source: "academic" | "personal";
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  buildingCode: string | null;
  room: string | null;
};

type ScopedData = {
  term: Term;
  weekday: Weekday | null;
  date: string | null;
  meetings: Meeting[];
  personalItems: PersonalItem[];
  gapPlans: GapPlan[];
};

function isFixedPersonal(item: PersonalItem): item is FixedPersonalItem {
  return item.flexibility.kind === "fixed";
}

function isFlexiblePersonal(item: PersonalItem): item is FlexiblePersonalItem {
  return item.flexibility.kind === "flexible";
}

function scopeData(snapshot: AiSnapshot, scope: DecisionScope): ScopedData {
  if (scope.kind === "date") {
    const day = daySchedule(snapshot, scope.date);
    return {
      term: day.term,
      weekday: day.weekday,
      date: scope.date,
      meetings: day.meetings,
      personalItems: day.personalItems,
      gapPlans: day.gapPlans,
    };
  }

  const week = weekSchedule(snapshot, scope.term);
  return {
    term: scope.term,
    weekday: scope.weekday,
    date: null,
    meetings: week.meetings.filter((meeting) => meeting.weekday === scope.weekday),
    personalItems: week.personalItems.filter((item) => item.weekday === scope.weekday),
    gapPlans: week.gapPlans.filter((plan) => plan.weekday === scope.weekday),
  };
}

function academicBoundary(meeting: Meeting): Boundary {
  return {
    source: "academic",
    id: meeting.id,
    label: `${meeting.courseCode} ${meeting.sectionCode} (${meeting.activityType})`,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
  };
}

function personalBoundary(item: FixedPersonalItem): Boundary {
  return {
    source: "personal",
    id: item.id,
    label: item.title,
    startTime: item.startTime,
    endTime: item.endTime,
    buildingCode: item.locationBuildingCode ?? null,
    room: item.locationRoom ?? null,
  };
}

function boundaries(data: ScopedData): Boundary[] {
  return [
    ...data.meetings.map(academicBoundary),
    ...data.personalItems.filter(isFixedPersonal).map(personalBoundary),
  ].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime || a.id.localeCompare(b.id));
}

function flexibleItems(data: ScopedData): FlexiblePersonalItem[] {
  return data.personalItems.filter(isFlexiblePersonal);
}

function flexibleOverlaps(item: FlexiblePersonalItem, startTime: number, endTime: number): boolean {
  const start = item.flexibility.windowStart;
  const end = item.flexibility.windowEnd;
  if (start === undefined || end === undefined) return true;
  return start < endTime && end > startTime;
}

function mergeBusy(input: Boundary[]): Array<{ startTime: number; endTime: number }> {
  const merged: Array<{ startTime: number; endTime: number }> = [];
  for (const item of input) {
    const last = merged.at(-1);
    if (!last || item.startTime > last.endTime) {
      merged.push({ startTime: item.startTime, endTime: item.endTime });
      continue;
    }
    last.endTime = Math.max(last.endTime, item.endTime);
  }
  return merged;
}

function previousBoundary(input: Boundary[], startTime: number): Boundary | null {
  return (
    input
      .filter((item) => item.endTime <= startTime)
      .sort((a, b) => b.endTime - a.endTime || b.startTime - a.startTime)[0] ?? null
  );
}

function nextBoundary(input: Boundary[], endTime: number): Boundary | null {
  return (
    input
      .filter((item) => item.startTime >= endTime)
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)[0] ?? null
  );
}

function exactGapPlan(data: ScopedData, startTime: number, endTime: number): GapPlan | null {
  return (
    data.gapPlans.find((plan) => plan.startTime === startTime && plan.endTime === endTime) ?? null
  );
}

function containingGapPlan(data: ScopedData, startTime: number, endTime: number): GapPlan | null {
  return (
    data.gapPlans
      .filter((plan) => plan.startTime <= startTime && plan.endTime >= endTime)
      .sort((a, b) => a.durationMinutes - b.durationMinutes)[0] ?? null
  );
}

function primaryActivityEnvelope(plan: GapPlan) {
  const timeline = plan.assessment.primary.timeline;
  const activityIndexes = timeline
    .map((item, index) => (item.kind === "activity" || item.kind === "flex" ? index : -1))
    .filter((index) => index >= 0);
  const maxActivityMinutes = plan.assessment.primary.activityMinutes;
  if (!activityIndexes.length) {
    return {
      startTime: plan.startTime,
      endTime: Math.min(plan.endTime, plan.assessment.leaveByMinutes),
      maxActivityMinutes,
      source: "leave_by_fallback" as const,
    };
  }

  const first = activityIndexes[0]!;
  const last = activityIndexes.at(-1)!;
  const leadingMinutes = timeline
    .slice(0, first)
    .reduce((total, item) => total + item.minutes, 0);
  const throughActivityMinutes = timeline
    .slice(0, last + 1)
    .reduce((total, item) => total + item.minutes, 0);
  return {
    startTime: Math.min(plan.endTime, plan.startTime + leadingMinutes),
    endTime: Math.min(
      plan.endTime,
      plan.assessment.leaveByMinutes,
      plan.startTime + throughActivityMinutes,
    ),
    maxActivityMinutes,
    source: "primary_timeline" as const,
  };
}

export function findAvailableWindows(snapshot: AiSnapshot, query: AvailabilityQuery) {
  const data = scopeData(snapshot, query.scope);
  if (!data.weekday) {
    return {
      revision: snapshot.revision,
      generatedAt: snapshot.generatedAt,
      term: data.term,
      weekday: null,
      date: data.date,
      minimumDurationMinutes: query.minimumDurationMinutes,
      searchBounds: null,
      windows: [],
      status: "no_weekday_schedule" as const,
    };
  }

  const hardBoundaries = boundaries(data);
  const busy = mergeBusy(hardBoundaries);
  const hasExplicitBounds = query.windowStart !== undefined && query.windowEnd !== undefined;
  const candidateWindows: Array<{ startTime: number; endTime: number }> = [];

  if (hasExplicitBounds) {
    const lower = query.windowStart!;
    const upper = query.windowEnd!;
    let cursor = lower;
    for (const interval of busy) {
      if (interval.endTime <= lower || interval.startTime >= upper) continue;
      const clippedStart = Math.max(interval.startTime, lower);
      if (clippedStart > cursor) candidateWindows.push({ startTime: cursor, endTime: clippedStart });
      cursor = Math.max(cursor, Math.min(interval.endTime, upper));
      if (cursor >= upper) break;
    }
    if (cursor < upper) candidateWindows.push({ startTime: cursor, endTime: upper });
  } else {
    for (let index = 0; index < busy.length - 1; index += 1) {
      const current = busy[index]!;
      const next = busy[index + 1]!;
      if (next.startTime > current.endTime) {
        candidateWindows.push({ startTime: current.endTime, endTime: next.startTime });
      }
    }
  }

  const flexible = flexibleItems(data);
  const windows = candidateWindows
    .filter((window) => window.endTime - window.startTime >= query.minimumDurationMinutes)
    .map((window) => ({
      ...window,
      durationMinutes: window.endTime - window.startTime,
      previousBoundary: previousBoundary(hardBoundaries, window.startTime),
      nextBoundary: nextBoundary(hardBoundaries, window.endTime),
      flexiblePersonalItems: flexible
        .filter((item) => flexibleOverlaps(item, window.startTime, window.endTime))
        .map((item) => ({
          id: item.id,
          title: item.title,
          durationMinutes: item.flexibility.durationMinutes,
          windowStart: item.flexibility.windowStart ?? null,
          windowEnd: item.flexibility.windowEnd ?? null,
        })),
      gapPlan: exactGapPlan(data, window.startTime, window.endTime),
    }))
    .sort((a, b) => b.durationMinutes - a.durationMinutes || a.startTime - b.startTime)
    .slice(0, query.maxResults);

  return {
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    term: data.term,
    weekday: data.weekday,
    date: data.date,
    minimumDurationMinutes: query.minimumDurationMinutes,
    searchBounds: hasExplicitBounds
      ? { startTime: query.windowStart!, endTime: query.windowEnd! }
      : null,
    windows,
    status:
      windows.length > 0
        ? ("available_windows_found" as const)
        : hasExplicitBounds || busy.length >= 2
          ? ("no_matching_window" as const)
          : ("no_bounded_day" as const),
  };
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function checkPlanFeasibility(snapshot: AiSnapshot, query: PlanFeasibilityQuery) {
  const data = scopeData(snapshot, query.scope);
  const hardBoundaries = boundaries(data);
  const conflicts = hardBoundaries.filter((item) =>
    overlap(query.startTime, query.endTime, item.startTime, item.endTime),
  );
  const softConflicts = flexibleItems(data)
    .filter((item) => flexibleOverlaps(item, query.startTime, query.endTime))
    .map((item) => ({
      id: item.id,
      title: item.title,
      durationMinutes: item.flexibility.durationMinutes,
      windowStart: item.flexibility.windowStart ?? null,
      windowEnd: item.flexibility.windowEnd ?? null,
    }));
  const previous = previousBoundary(hardBoundaries, query.startTime);
  const next = nextBoundary(hardBoundaries, query.endTime);
  const gapPlan = containingGapPlan(data, query.startTime, query.endTime);
  const activityWindow = gapPlan ? primaryActivityEnvelope(gapPlan) : null;
  const requestedDurationMinutes = query.endTime - query.startTime;

  let validationLevel:
    | "conflict"
    | "gapwise_transition_validated"
    | "gapwise_transition_rejected"
    | "temporal_only";
  let feasible: boolean;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (conflicts.length > 0) {
    validationLevel = "conflict";
    feasible = false;
    reasons.push("The proposed block overlaps one or more delegated hard timetable boundaries.");
  } else if (gapPlan && activityWindow) {
    const withinActivityBudget = requestedDurationMinutes <= activityWindow.maxActivityMinutes;
    const startsInsideActivityWindow = query.startTime >= activityWindow.startTime;
    const endsInsideActivityWindow = query.endTime <= activityWindow.endTime;
    const routeUsable = gapPlan.assessment.routeStatus !== "unavailable";
    feasible =
      withinActivityBudget &&
      startsInsideActivityWindow &&
      endsInsideActivityWindow &&
      routeUsable;
    validationLevel = feasible ? "gapwise_transition_validated" : "gapwise_transition_rejected";
    if (!withinActivityBudget) {
      reasons.push(
        `The block needs ${requestedDurationMinutes} min but Gapwise exposes ${activityWindow.maxActivityMinutes} min of activity budget in this gap.`,
      );
    }
    if (!startsInsideActivityWindow) {
      reasons.push(
        `The block starts before Gapwise's primary activity envelope begins at ${activityWindow.startTime} minutes after midnight.`,
      );
    }
    if (!endsInsideActivityWindow) {
      reasons.push(
        `The block ends after Gapwise's primary activity envelope ends at ${activityWindow.endTime} minutes after midnight.`,
      );
    }
    if (!routeUsable) {
      reasons.push("Gapwise marks the surrounding transition route unavailable.");
    }
    if (feasible) {
      reasons.push(
        "The block fits inside Gapwise's delegated primary activity envelope while preserving its authoritative transition constraints.",
      );
    }
    warnings.push(...gapPlan.assessment.warnings);
  } else {
    validationLevel = "temporal_only";
    feasible = true;
    reasons.push(
      "No delegated hard event overlaps this block, but Gapwise has no matching deterministic gap assessment to validate transition travel/buffer constraints.",
    );
  }

  const requestedLocation =
    query.locationBuildingCode || query.locationRoom
      ? {
          buildingCode: query.locationBuildingCode ?? null,
          room: query.locationRoom ?? null,
          validated: false as const,
        }
      : null;
  if (requestedLocation) {
    warnings.push(
      "The proposed personal-item location was not route-validated by this tool; only delegated Gapwise gap/transition facts are authoritative.",
    );
  }
  if (softConflicts.length > 0) {
    warnings.push(
      "One or more delegated flexible personal items could compete for this time window; they are soft constraints rather than hard conflicts.",
    );
  }

  return {
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    term: data.term,
    weekday: data.weekday,
    date: data.date,
    requestedBlock: {
      startTime: query.startTime,
      endTime: query.endTime,
      durationMinutes: requestedDurationMinutes,
      location: requestedLocation,
    },
    feasible,
    validationLevel,
    conflicts,
    flexiblePersonalItems: softConflicts,
    previousBoundary: previous,
    nextBoundary: next,
    gapPlan,
    gapwiseActivityWindow: activityWindow,
    reasons,
    warnings: [...new Set(warnings)].slice(0, 24),
  };
}

export function decisionContext(snapshot: AiSnapshot, term: Term) {
  const week = weekSchedule(snapshot, term);
  const weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ] as const;
  const days = weekdays.map((weekday) => {
    const meetings = week.meetings.filter((meeting) => meeting.weekday === weekday);
    const fixedPersonal = week.personalItems.filter(
      (item): item is FixedPersonalItem => isFixedPersonal(item) && item.weekday === weekday,
    );
    const gaps = week.gapPlans.filter((plan) => plan.weekday === weekday);
    const busy = [
      ...meetings.map((meeting) => ({ startTime: meeting.startTime, endTime: meeting.endTime })),
      ...fixedPersonal.map((item) => ({ startTime: item.startTime, endTime: item.endTime })),
    ];
    const firstStart = busy.length ? Math.min(...busy.map((item) => item.startTime)) : null;
    const lastEnd = busy.length ? Math.max(...busy.map((item) => item.endTime)) : null;
    const academicMinutes = meetings.reduce(
      (total, meeting) => total + meeting.endTime - meeting.startTime,
      0,
    );
    const fixedPersonalMinutes = fixedPersonal.reduce(
      (total, item) => total + item.endTime - item.startTime,
      0,
    );
    const bestGap = [...gaps].sort(
      (a, b) =>
        b.assessment.primary.score - a.assessment.primary.score ||
        b.assessment.primary.activityMinutes - a.assessment.primary.activityMinutes,
    )[0] ?? null;
    const warnings = [...new Set(gaps.flatMap((plan) => plan.assessment.warnings))].slice(0, 12);

    return {
      weekday,
      academicMeetingCount: meetings.length,
      academicMinutes,
      fixedPersonalCount: fixedPersonal.length,
      fixedPersonalMinutes,
      firstStart,
      lastEnd,
      gapCount: gaps.length,
      totalGapMinutes: gaps.reduce((total, gap) => total + gap.durationMinutes, 0),
      totalGapwiseActivityMinutes: gaps.reduce(
        (total, gap) => total + gap.assessment.primary.activityMinutes,
        0,
      ),
      unresolvedRouteCount: gaps.filter((gap) => gap.assessment.routeStatus === "unavailable").length,
      bestGap,
      warnings,
    };
  });

  const opportunities = [...week.gapPlans]
    .sort(
      (a, b) =>
        b.assessment.primary.score - a.assessment.primary.score ||
        b.assessment.primary.activityMinutes - a.assessment.primary.activityMinutes,
    )
    .slice(0, 8);
  const limitations: string[] = [];
  if (!snapshot.permissions.readPersonal) {
    limitations.push("Personal timetable items are not delegated, so planning ignores them.");
  }
  if (!snapshot.permissions.readGapPlans) {
    limitations.push("Gap-plan sharing is disabled, so deterministic gap opportunities are unavailable.");
  }
  if (!snapshot.permissions.readGapPreferences) {
    limitations.push("Gap-planning preferences are not delegated.");
  }
  if (!snapshot.permissions.readRoutingPreferences) {
    limitations.push("Routing preferences are not delegated.");
  }

  return {
    revision: snapshot.revision,
    generatedAt: snapshot.generatedAt,
    term,
    permissions: snapshot.permissions,
    hardConstraintSummary: {
      academicMeetingCount: week.meetings.length,
      fixedPersonalCount: week.personalItems.filter(isFixedPersonal).length,
    },
    days,
    topGapOpportunities: opportunities,
    gapPreferences: snapshot.permissions.readGapPreferences ? snapshot.gapPreferences : null,
    routingPreferences: snapshot.permissions.readRoutingPreferences
      ? snapshot.routingPreferences
      : null,
    limitations,
  };
}
