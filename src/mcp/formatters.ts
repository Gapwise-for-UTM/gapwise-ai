import type { z } from "zod";
import type { AiSnapshot, PersonalItem } from "@/src/domain/schemas";
import {
  DayScheduleOutputSchema,
  GapContextOutputSchema,
  WeekScheduleOutputSchema,
} from "@/src/mcp/output-schemas";
import { withMcpDataBoundary } from "@/src/mcp/text-content";

type DaySchedule = z.infer<typeof DayScheduleOutputSchema>;
type WeekSchedule = z.infer<typeof WeekScheduleOutputSchema>;
type GapContext = z.infer<typeof GapContextOutputSchema>;
type Meeting = AiSnapshot["schedule"][number];
type GapPlan = AiSnapshot["gapPlans"][number];
type GapRecommendation = GapPlan["assessment"]["primary"];
type FixedPersonalItem = Extract<PersonalItem, { flexibility: { kind: "fixed" } }>;

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function clock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isFixedPersonal(item: PersonalItem): item is FixedPersonalItem {
  return item.flexibility.kind === "fixed";
}

function locationForMeeting(meeting: Meeting): string {
  if (meeting.isReservedAssessmentWindow) return "location announced only if this window is used";
  if (meeting.locationType === "online") return "Online";
  if (meeting.locationType === "tba") return "TBA";
  const parts = [meeting.buildingCode, meeting.room].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return meeting.locationUnknown ? "Location unknown" : "Location not provided";
}

function recurrenceForMeeting(meeting: Meeting): string {
  const details: string[] = [];
  if (meeting.dateRange) {
    details.push(
      `active ${meeting.dateRange.startDate}–${meeting.dateRange.endDate ?? "open-ended"}`,
    );
    details.push(
      meeting.recurrenceIntervalWeeks && meeting.recurrenceIntervalWeeks > 1
        ? `every ${meeting.recurrenceIntervalWeeks} weeks from the start date`
        : "weekly on this weekday",
    );
  } else if (meeting.recurrenceIntervalWeeks && meeting.recurrenceIntervalWeeks > 1) {
    details.push(`every ${meeting.recurrenceIntervalWeeks} weeks`);
  }
  if (meeting.excludedDates?.length) {
    details.push(`excluded dates: ${meeting.excludedDates.join(", ")}`);
  }
  return details.length ? ` [${details.join("; ")}]` : "";
}

function meetingLine(meeting: Meeting): string {
  const name =
    meeting.courseName && meeting.courseName !== meeting.courseCode
      ? ` — ${meeting.courseName}`
      : "";
  if (meeting.isReservedAssessmentWindow) {
    return `- ${clock(meeting.startTime)}–${clock(meeting.endTime)} ${meeting.courseCode} RES ${meeting.sectionCode}${name} — Reserved assessment window; NOT a weekly class; only active when announced; ${locationForMeeting(meeting)}${recurrenceForMeeting(meeting)}`;
  }
  return `- ${clock(meeting.startTime)}–${clock(meeting.endTime)} ${meeting.courseCode} ${meeting.sectionCode} (${meeting.activityType})${name} — ${locationForMeeting(meeting)}${recurrenceForMeeting(meeting)}`;
}

function personalItemLine(item: PersonalItem): string {
  const location =
    [item.locationBuildingCode, item.locationRoom].filter(Boolean).join(" ") ||
    item.locationText ||
    "No location";
  if (isFixedPersonal(item)) {
    return `- ${clock(item.startTime)}–${clock(item.endTime)} ${item.title} [${item.category}] — ${location}`;
  }
  const window =
    item.flexibility.windowStart !== undefined && item.flexibility.windowEnd !== undefined
      ? `${clock(item.flexibility.windowStart)}–${clock(item.flexibility.windowEnd)}`
      : "flexible window";
  return `- ${item.title} [${item.category}] — ${item.flexibility.durationMinutes} min within ${window} — ${location}`;
}

function recommendationDetails(label: string, recommendation: GapRecommendation): string[] {
  const lines = [
    `  ${label}: ${recommendation.title} [${recommendation.action}] — ${recommendation.summary}`,
    `  ${label} metrics: activity ${recommendation.activityMinutes} min; score ${recommendation.score}.`,
  ];
  if (recommendation.reasons.length) {
    lines.push(`  ${label} reasons: ${recommendation.reasons.join(" ")}`);
  }
  if (recommendation.tags.length) {
    lines.push(`  ${label} tags: ${recommendation.tags.join(", ")}.`);
  }
  if (recommendation.timeline.length) {
    lines.push(
      `  ${label} timeline: ${recommendation.timeline
        .map((item) => `${item.label}=${item.minutes} min (${item.kind})`)
        .join("; ")}.`,
    );
  }
  return lines;
}

function gapPlanLines(plan: GapPlan): string[] {
  const assessment = plan.assessment;
  const route = `${assessment.routeStatus}, ${assessment.routeAccuracy}`;
  const timing = [
    assessment.travelMinutes === null ? "travel unavailable" : `travel ${assessment.travelMinutes} min`,
    `buffer ${assessment.bufferMinutes} min`,
    `leave by ${clock(assessment.leaveByMinutes)}`,
    assessment.arrivalMinutes === null ? "arrival unavailable" : `arrive ${clock(assessment.arrivalMinutes)}`,
  ].join(", ");
  const lines = [
    `- Gap ${clock(plan.startTime)}–${clock(plan.endTime)} (${plan.durationMinutes} min).`,
    ...recommendationDetails("Primary", assessment.primary),
    `  Route: ${route}; confidence ${assessment.confidenceLabel} (${Math.round(assessment.confidence * 100)}%); fallback ${assessment.fallback ? "yes" : "no"}; ${timing}.`,
  ];
  if (assessment.warnings.length) {
    lines.push(`  Warnings: ${assessment.warnings.join(" ")}`);
  }
  for (const [index, alternative] of assessment.alternatives.entries()) {
    lines.push(...recommendationDetails(`Alternative ${index + 1}`, alternative));
  }
  return lines;
}

function compactJson(label: string, value: unknown): string {
  return `${label}: ${JSON.stringify(value)}`;
}

export function formatDaySchedule(value: DaySchedule): string {
  const academic = value.meetings.filter((meeting) => !meeting.isReservedAssessmentWindow);
  const reserved = value.meetings.filter((meeting) => meeting.isReservedAssessmentWindow);
  const lines = [
    `Gapwise day for ${value.date}${value.weekday ? ` (${value.weekday})` : ""} — ${value.term}, revision ${value.revision}.`,
    "Academic commitments:",
    ...(academic.length ? academic.map(meetingLine) : ["- None."]),
  ];
  if (reserved.length) {
    lines.push(
      "Reserved assessment placeholders (informational only; they do not block availability until an assessment is announced):",
      ...reserved.map(meetingLine),
    );
  }
  if (value.personalItems.length) {
    lines.push(
      "Legacy delegated Personal Items (retired in current Gapwise):",
      ...value.personalItems.map(personalItemLine),
    );
  }
  lines.push("Gapwise gap plans:");
  if (value.gapPlans.length) {
    for (const plan of value.gapPlans) lines.push(...gapPlanLines(plan));
  } else {
    lines.push("- None shared for this day.");
  }
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatWeekSchedule(value: WeekSchedule): string {
  const lines = [
    `Gapwise ${value.term} timetable — revision ${value.revision}. Recurrence/date-range facts and exclusions are included per source-backed entry. RES means a reserved assessment placeholder, not a weekly class or hard commitment.`,
  ];
  for (const weekday of WEEKDAYS) {
    const meetings = value.meetings.filter((meeting) => meeting.weekday === weekday);
    const academic = meetings.filter((meeting) => !meeting.isReservedAssessmentWindow);
    const reserved = meetings.filter((meeting) => meeting.isReservedAssessmentWindow);
    const personal = value.personalItems.filter((item) => item.weekday === weekday);
    const gaps = value.gapPlans.filter((plan) => plan.weekday === weekday);
    if (!meetings.length && !personal.length && !gaps.length) continue;
    lines.push(`\n${weekday}`);
    if (academic.length) {
      lines.push("Academic commitments:", ...academic.map(meetingLine));
    }
    if (reserved.length) {
      lines.push("Reserved assessment placeholders:", ...reserved.map(meetingLine));
    }
    if (personal.length) {
      lines.push("Legacy delegated Personal Items:", ...personal.map(personalItemLine));
    }
    if (gaps.length) {
      lines.push("Gapwise gap plans:");
      for (const plan of gaps) lines.push(...gapPlanLines(plan));
    }
  }
  if (lines.length === 1) lines.push("No delegated timetable data is present for this term.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatGapContext(value: GapContext): string {
  const lines = [
    `Gapwise gap context for ${value.weekday}, ${value.term}: ${clock(value.requestedWindow.startTime)}–${clock(value.requestedWindow.endTime)} (${value.requestedWindow.durationMinutes} min), revision ${value.revision}.`,
    `Planning status: ${value.planningStatus}.`,
  ];
  if (value.previous) {
    lines.push(`Previous boundary (${value.previous.source}): ${JSON.stringify(value.previous.item)}`);
  }
  if (value.next) {
    lines.push(`Next boundary (${value.next.source}): ${JSON.stringify(value.next.item)}`);
  }
  if (value.gapPlan) {
    lines.push("Gapwise deterministic assessment:", ...gapPlanLines(value.gapPlan));
  } else {
    lines.push("No matching delegated Gapwise gap plan exists for this exact window.");
  }
  if (value.gapPreferences) {
    lines.push(compactJson("Delegated gap preferences", value.gapPreferences));
  }
  if (value.routingPreferences) {
    lines.push(compactJson("Delegated routing preferences", value.routingPreferences));
  }
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatPreferences(value: {
  revision: number;
  permissions: Record<string, unknown>;
  gapPreferences: unknown;
  routingPreferences: unknown;
}): string {
  return withMcpDataBoundary(
    [
      `Gapwise delegated AI preferences — revision ${value.revision}.`,
      compactJson("Permissions", value.permissions),
      compactJson("Gap preferences", value.gapPreferences),
      compactJson("Routing preferences", value.routingPreferences),
    ].join("\n"),
  );
}