import type { AiSnapshot } from "@/src/domain/schemas";

type Meeting = AiSnapshot["schedule"][number];
type GapPlan = AiSnapshot["gapPlans"][number];
type Weekday = Meeting["weekday"];

const WEEKDAY_ORDER: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function meetingSemantics(meeting: Meeting) {
  const reserved = meeting.isReservedAssessmentWindow === true;
  return {
    semanticType: reserved
      ? ("reserved_assessment_window" as const)
      : ("academic_meeting" as const),
    componentLabel: reserved ? ("RES" as const) : meeting.activityType,
    isHardCommitment: !reserved,
  };
}

function locationLabel(meeting: Meeting): string {
  if (meeting.isReservedAssessmentWindow) return "Announced only if this RES window is used";
  if (meeting.locationType === "online") return "Online";
  if (meeting.locationType === "tba") return "TBA";
  const parts = [meeting.buildingCode, meeting.room].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return meeting.locationUnknown ? "Unknown" : "Not provided";
}

export function meetingFact(meeting: Meeting) {
  return {
    id: meeting.id,
    weekday: meeting.weekday,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    courseCode: meeting.courseCode,
    courseName: meeting.courseName,
    sectionCode: meeting.sectionCode,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
    locationLabel: locationLabel(meeting),
    ...meetingSemantics(meeting),
  };
}

export type ScheduleDataFlag = {
  code:
    | "duplicate_meeting"
    | "multiple_same_section_day_windows"
    | "overlapping_section_meetings"
    | "high_section_weekly_minutes"
    | "late_meeting";
  severity: "info" | "warning";
  scope: "meeting" | "section" | "course";
  courseCode: string;
  message: string;
  evidence: {
    sectionCode: string | null;
    weekday: Weekday | null;
    meetingIds: string[];
    weeklyMinutes: number | null;
    startTime: number | null;
  };
};

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}

function flagKey(flag: ScheduleDataFlag): string {
  return [
    flag.code,
    flag.courseCode,
    flag.evidence.sectionCode ?? "",
    flag.evidence.weekday ?? "",
    flag.evidence.meetingIds.join(","),
  ].join("|");
}

export function scheduleDataFlags(meetings: Meeting[]): ScheduleDataFlag[] {
  const academic = meetings.filter((meeting) => !meeting.isReservedAssessmentWindow);
  const flags: ScheduleDataFlag[] = [];

  const duplicates = groupBy(academic, (meeting) =>
    JSON.stringify({
      courseCode: meeting.courseCode,
      activityType: meeting.activityType,
      sectionCode: meeting.sectionCode,
      weekday: meeting.weekday,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      buildingCode: meeting.buildingCode,
      room: meeting.room,
      term: meeting.term,
      locationType: meeting.locationType ?? null,
    }),
  );
  for (const duplicateGroup of duplicates.values()) {
    if (duplicateGroup.length < 2) continue;
    const first = duplicateGroup[0]!;
    flags.push({
      code: "duplicate_meeting",
      severity: "warning",
      scope: "meeting",
      courseCode: first.courseCode,
      message: `${first.courseCode} ${first.sectionCode} contains duplicate meeting records with the same day, time, and location.`,
      evidence: {
        sectionCode: first.sectionCode,
        weekday: first.weekday,
        meetingIds: duplicateGroup.map((meeting) => meeting.id),
        weeklyMinutes: null,
        startTime: first.startTime,
      },
    });
  }

  const sectionDays = groupBy(
    academic,
    (meeting) => `${meeting.courseCode}|${meeting.sectionCode}|${meeting.weekday}`,
  );
  for (const sectionDay of sectionDays.values()) {
    if (sectionDay.length < 2) continue;
    const first = sectionDay[0]!;
    const uniqueWindows = new Set(sectionDay.map((meeting) => `${meeting.startTime}-${meeting.endTime}`));
    if (uniqueWindows.size > 1) {
      flags.push({
        code: "multiple_same_section_day_windows",
        severity: "warning",
        scope: "section",
        courseCode: first.courseCode,
        message: `${first.courseCode} ${first.sectionCode} has multiple distinct meeting windows on ${first.weekday}; verify that the section/component labels are correct.`,
        evidence: {
          sectionCode: first.sectionCode,
          weekday: first.weekday,
          meetingIds: sectionDay.map((meeting) => meeting.id),
          weeklyMinutes: null,
          startTime: null,
        },
      });
    }

    const sorted = [...sectionDay].sort(
      (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
    );
    const overlappingIds = new Set<string>();
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      if (current.startTime < previous.endTime) {
        overlappingIds.add(previous.id);
        overlappingIds.add(current.id);
      }
    }
    if (overlappingIds.size) {
      flags.push({
        code: "overlapping_section_meetings",
        severity: "warning",
        scope: "section",
        courseCode: first.courseCode,
        message: `${first.courseCode} ${first.sectionCode} has overlapping meetings on ${first.weekday}.`,
        evidence: {
          sectionCode: first.sectionCode,
          weekday: first.weekday,
          meetingIds: [...overlappingIds],
          weeklyMinutes: null,
          startTime: null,
        },
      });
    }
  }

  const sections = groupBy(
    academic,
    (meeting) => `${meeting.courseCode}|${meeting.sectionCode}`,
  );
  for (const section of sections.values()) {
    const first = section[0]!;
    const weeklyMinutes = section.reduce(
      (total, meeting) => total + meeting.endTime - meeting.startTime,
      0,
    );
    if (weeklyMinutes > 240) {
      flags.push({
        code: "high_section_weekly_minutes",
        severity: "warning",
        scope: "section",
        courseCode: first.courseCode,
        message: `${first.courseCode} ${first.sectionCode} totals ${weeklyMinutes} scheduled minutes per week, which is unusually high for a single section and should be verified.`,
        evidence: {
          sectionCode: first.sectionCode,
          weekday: null,
          meetingIds: section.map((meeting) => meeting.id),
          weeklyMinutes,
          startTime: null,
        },
      });
    }
  }

  for (const meeting of academic) {
    if (meeting.startTime < 18 * 60) continue;
    flags.push({
      code: "late_meeting",
      severity: "info",
      scope: "meeting",
      courseCode: meeting.courseCode,
      message: `${meeting.courseCode} ${meeting.sectionCode} starts at or after 18:00; confirm this late meeting is intentional if it looks unexpected.`,
      evidence: {
        sectionCode: meeting.sectionCode,
        weekday: meeting.weekday,
        meetingIds: [meeting.id],
        weeklyMinutes: null,
        startTime: meeting.startTime,
      },
    });
  }

  return [...new Map(flags.map((flag) => [flagKey(flag), flag])).values()].slice(0, 40);
}

type GapBoundarySummary = {
  courseCode: string | null;
  componentLabel: "LEC" | "TUT" | "PRA" | "OTHER" | "RES" | null;
  sectionCode: string | null;
  buildingCode: string | null;
  room: string | null;
  locationLabel: string | null;
};

function gapBoundarySummary(meeting: Meeting | undefined): GapBoundarySummary {
  if (!meeting) {
    return {
      courseCode: null,
      componentLabel: null,
      sectionCode: null,
      buildingCode: null,
      room: null,
      locationLabel: null,
    };
  }
  return {
    courseCode: meeting.courseCode,
    componentLabel: meetingSemantics(meeting).componentLabel,
    sectionCode: meeting.sectionCode,
    buildingCode: meeting.buildingCode,
    room: meeting.room,
    locationLabel: locationLabel(meeting),
  };
}

function gapPlanDetails(plan: GapPlan, meetingsById: Map<string, Meeting>) {
  const assessment = plan.assessment;
  const previous = gapBoundarySummary(meetingsById.get(plan.previousMeetingId));
  const next = gapBoundarySummary(meetingsById.get(plan.nextMeetingId));
  return {
    term: plan.term,
    startTime: plan.startTime,
    endTime: plan.endTime,
    durationMinutes: plan.durationMinutes,
    previousCourseCode: previous.courseCode,
    previousComponentLabel: previous.componentLabel,
    previousSectionCode: previous.sectionCode,
    previousBuildingCode: previous.buildingCode,
    previousRoom: previous.room,
    previousLocationLabel: previous.locationLabel,
    nextCourseCode: next.courseCode,
    nextComponentLabel: next.componentLabel,
    nextSectionCode: next.sectionCode,
    nextBuildingCode: next.buildingCode,
    nextRoom: next.room,
    nextLocationLabel: next.locationLabel,
    primaryAction: assessment.primary.action,
    primaryTitle: assessment.primary.title,
    primaryScore: assessment.primary.score,
    usableActivityMinutes: assessment.primary.activityMinutes,
    travelMinutes: assessment.travelMinutes,
    bufferMinutes: assessment.bufferMinutes,
    leaveByMinutes: assessment.leaveByMinutes,
    arrivalMinutes: assessment.arrivalMinutes,
    routeStatus: assessment.routeStatus,
    routeAccuracy: assessment.routeAccuracy,
    confidencePercent: Math.round(assessment.confidence * 100),
    confidenceLabel: assessment.confidenceLabel,
    fallback: assessment.fallback,
    keyWarning: assessment.warnings[0] ?? null,
  };
}

function gapGroupKey(plan: GapPlan, meetingsById: Map<string, Meeting>): string {
  return JSON.stringify(gapPlanDetails(plan, meetingsById));
}

function gapPlanGroupFromPlan(plan: GapPlan, meetingsById: Map<string, Meeting>) {
  return {
    appliesTo: [plan.weekday] as Weekday[],
    sourceGapPlanIds: [plan.id],
    ...gapPlanDetails(plan, meetingsById),
  };
}

export function groupGapPlans(plans: GapPlan[], meetings: Meeting[] = []) {
  const meetingsById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const groups = new Map<string, ReturnType<typeof gapPlanGroupFromPlan>>();
  for (const plan of plans) {
    const key = gapGroupKey(plan, meetingsById);
    const existing = groups.get(key);
    if (existing) {
      if (!existing.appliesTo.includes(plan.weekday)) existing.appliesTo.push(plan.weekday);
      existing.sourceGapPlanIds.push(plan.id);
      continue;
    }
    groups.set(key, gapPlanGroupFromPlan(plan, meetingsById));
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      appliesTo: [...group.appliesTo].sort(
        (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
      ),
    }))
    .sort(
      (a, b) =>
        WEEKDAY_ORDER.indexOf(a.appliesTo[0]!) - WEEKDAY_ORDER.indexOf(b.appliesTo[0]!) ||
        a.startTime - b.startTime,
    );
}

export function groupGapPlansByDate(
  entries: Array<{ date: string; gapPlans: GapPlan[] }>,
  meetings: Meeting[] = [],
) {
  const meetingsById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  type DateGroup = Omit<ReturnType<typeof gapPlanGroupFromPlan>, "appliesTo"> & {
    appliesToDates: string[];
  };
  const groups = new Map<string, DateGroup>();
  for (const entry of entries) {
    for (const plan of entry.gapPlans) {
      const key = gapGroupKey(plan, meetingsById);
      const existing = groups.get(key);
      if (existing) {
        if (!existing.appliesToDates.includes(entry.date)) existing.appliesToDates.push(entry.date);
        existing.sourceGapPlanIds.push(plan.id);
        continue;
      }
      const { appliesTo: _appliesTo, ...base } = gapPlanGroupFromPlan(plan, meetingsById);
      groups.set(key, { ...base, appliesToDates: [entry.date] });
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, appliesToDates: [...group.appliesToDates].sort() }))
    .sort(
      (a, b) =>
        (a.appliesToDates[0] ?? "").localeCompare(b.appliesToDates[0] ?? "") ||
        a.startTime - b.startTime,
    );
}
