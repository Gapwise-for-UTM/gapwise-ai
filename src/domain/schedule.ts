import type { AiSnapshot, PersonalItem } from "@/src/domain/schemas";

const JS_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const WEEKDAY_ORDER = new Map([
  ["Monday", 1],
  ["Tuesday", 2],
  ["Wednesday", 3],
  ["Thursday", 4],
  ["Friday", 5],
  ["Saturday", 6],
  ["Sunday", 7],
]);
const DAY_MS = 86_400_000;

type Weekday = AiSnapshot["schedule"][number]["weekday"];

function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error("Date must use YYYY-MM-DD.");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Date is invalid.");
  }
  return parsed;
}

export function termForDate(date: string): "Fall" | "Winter" | "Summer" {
  const month = parseDate(date).getUTCMonth() + 1;
  if (month <= 4) return "Winter";
  if (month <= 8) return "Summer";
  return "Fall";
}

export function weekdayForDate(date: string): Weekday {
  return JS_WEEKDAYS[parseDate(date).getUTCDay()]!;
}

function academicMeetingOccursOnDate(
  meeting: AiSnapshot["schedule"][number],
  date: string,
): boolean {
  const weekday = weekdayForDate(date);
  if (meeting.weekday !== weekday) return false;
  if (meeting.excludedDates?.includes(date)) return false;

  if (meeting.dateRange) {
    if (date < meeting.dateRange.startDate) return false;
    if (meeting.dateRange.endDate && date > meeting.dateRange.endDate) return false;
    if (meeting.recurrenceIntervalWeeks && meeting.recurrenceIntervalWeeks > 1) {
      const current = parseDate(date).getTime();
      const start = parseDate(meeting.dateRange.startDate).getTime();
      const days = Math.floor((current - start) / DAY_MS);
      const weeks = Math.floor(days / 7);
      if (weeks < 0 || weeks % meeting.recurrenceIntervalWeeks !== 0) return false;
    }
    return true;
  }

  return meeting.term === termForDate(date);
}

function isFixedPersonal(
  item: PersonalItem,
): item is Extract<PersonalItem, { flexibility: { kind: "fixed" } }> {
  return item.flexibility.kind === "fixed";
}

export function daySchedule(snapshot: AiSnapshot, date: string) {
  const weekday = weekdayForDate(date);
  const term = termForDate(date);
  const meetings = snapshot.schedule
    .filter((meeting) => academicMeetingOccursOnDate(meeting, date))
    .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  const personalItems = snapshot.permissions.readPersonal
    ? snapshot.personalItems
        .filter((item) => item.term === term && item.weekday === weekday)
        .sort((a, b) => {
          const aStart = isFixedPersonal(a) ? a.startTime : a.flexibility.windowStart ?? 0;
          const bStart = isFixedPersonal(b) ? b.startTime : b.flexibility.windowStart ?? 0;
          return aStart - bStart;
        })
    : [];
  const occurringBoundaryIds = new Set([
    ...meetings.map((meeting) => meeting.id),
    ...personalItems.filter(isFixedPersonal).map((item) => item.id),
  ]);
  const gapPlans = snapshot.permissions.readGapPlans
    ? snapshot.gapPlans.filter(
        (plan) =>
          plan.term === term &&
          plan.weekday === weekday &&
          occurringBoundaryIds.has(plan.previousMeetingId) &&
          occurringBoundaryIds.has(plan.nextMeetingId),
      )
    : [];
  return {
    date,
    weekday,
    term,
    revision: snapshot.revision,
    meetings,
    personalItems,
    gapPlans,
  };
}

export function weekSchedule(snapshot: AiSnapshot, term: "Fall" | "Winter" | "Summer") {
  const meetings = snapshot.schedule
    .filter((meeting) => meeting.term === term)
    .sort(
      (a, b) =>
        (WEEKDAY_ORDER.get(a.weekday) ?? 99) - (WEEKDAY_ORDER.get(b.weekday) ?? 99) ||
        a.startTime - b.startTime ||
        a.endTime - b.endTime,
    );
  const personalItems = snapshot.permissions.readPersonal
    ? snapshot.personalItems
        .filter((item) => item.term === term)
        .sort((a, b) => {
          const day =
            (WEEKDAY_ORDER.get(a.weekday) ?? 99) - (WEEKDAY_ORDER.get(b.weekday) ?? 99);
          if (day) return day;
          const aStart = isFixedPersonal(a) ? a.startTime : a.flexibility.windowStart ?? 0;
          const bStart = isFixedPersonal(b) ? b.startTime : b.flexibility.windowStart ?? 0;
          return aStart - bStart;
        })
    : [];
  const gapPlans = snapshot.permissions.readGapPlans
    ? snapshot.gapPlans
        .filter((plan) => plan.term === term)
        .sort(
          (a, b) =>
            (WEEKDAY_ORDER.get(a.weekday) ?? 99) - (WEEKDAY_ORDER.get(b.weekday) ?? 99) ||
            a.startTime - b.startTime,
        )
    : [];
  return { term, revision: snapshot.revision, meetings, personalItems, gapPlans };
}

export function gapContext(
  snapshot: AiSnapshot,
  input: {
    term: "Fall" | "Winter" | "Summer";
    weekday: Weekday;
    startTime: number;
    endTime: number;
  },
) {
  const fixedPersonal = snapshot.permissions.readPersonal
    ? snapshot.personalItems.filter(
        (item): item is Extract<PersonalItem, { flexibility: { kind: "fixed" } }> =>
          isFixedPersonal(item) && item.term === input.term && item.weekday === input.weekday,
      )
    : [];
  const academic = snapshot.schedule.filter(
    (meeting) => meeting.term === input.term && meeting.weekday === input.weekday,
  );
  const boundaries = [
    ...academic.map((item) => ({
      source: "academic" as const,
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      item,
    })),
    ...fixedPersonal.map((item) => ({
      source: "personal" as const,
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      item,
    })),
  ];
  const previous =
    boundaries
      .filter((item) => item.endTime <= input.startTime)
      .sort((a, b) => b.endTime - a.endTime)[0] ?? null;
  const next =
    boundaries
      .filter((item) => item.startTime >= input.endTime)
      .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  const gapPlan = snapshot.permissions.readGapPlans
    ? (snapshot.gapPlans.find(
        (plan) =>
          plan.term === input.term &&
          plan.weekday === input.weekday &&
          plan.startTime === input.startTime &&
          plan.endTime === input.endTime,
      ) ?? null)
    : null;

  return {
    revision: snapshot.revision,
    term: input.term,
    weekday: input.weekday,
    requestedWindow: {
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.endTime - input.startTime,
    },
    previous,
    next,
    gapPlan,
    gapPreferences: snapshot.permissions.readGapPreferences ? snapshot.gapPreferences : null,
    routingPreferences: snapshot.permissions.readRoutingPreferences ? snapshot.routingPreferences : null,
    planningStatus: gapPlan
      ? ("gapwise_deterministic_assessment" as const)
      : snapshot.permissions.readGapPlans
        ? ("no_matching_gap_plan" as const)
        : ("gap_plan_permission_disabled" as const),
  };
}
