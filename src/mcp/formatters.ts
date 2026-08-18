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
type FixedPersonalItem = Extract<PersonalItem, { flexibility: { kind: "fixed" } }>;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

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
  if (meeting.locationType === "online") return "Online";
  if (meeting.locationType === "tba") return "TBA";
  const parts = [meeting.buildingCode, meeting.room].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return meeting.locationUnknown ? "Location unknown" : "Location not provided";
}

function meetingLine(meeting: Meeting): string {
  const name =
    meeting.courseName && meeting.courseName !== meeting.courseCode ? ` — ${meeting.courseName}` : "";
  return `- ${clock(meeting.startTime)}–${clock(meeting.endTime)} ${meeting.courseCode} ${meeting.sectionCode} (${meeting.activityType})${name} — ${locationForMeeting(meeting)}`;
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

function gapPlanLines(plan: GapPlan): string[] {
  const assessment = plan.assessment;
  const primary = assessment.primary;
  const route = `${assessment.routeStatus}, ${assessment.routeAccuracy}`;
  const timing = [
    assessment.travelMinutes === null ? null : `travel ${assessment.travelMinutes} min`,
    `buffer ${assessment.bufferMinutes} min`,
    `leave by ${clock(assessment.leaveByMinutes)}`,
    assessment.arrivalMinutes === null ? null : `arrive ${clock(assessment.arrivalMinutes)}`,
  ]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `- ${clock(plan.startTime)}–${clock(plan.endTime)} (${plan.durationMinutes} min): ${primary.title} — ${primary.summary}`,
    `  Route: ${route}; confidence ${assessment.confidenceLabel} (${Math.round(assessment.confidence * 100)}%); ${timing}.`,
  ];
  if (primary.reasons.length) lines.push(`  Why: ${primary.reasons.join(" ")}`);
  if (assessment.warnings.length) lines.push(`  Warnings: ${assessment.warnings.join(" ")}`);
  if (assessment.alternatives.length) {
    lines.push(
      `  Alternatives: ${assessment.alternatives.map((item) => `${item.title} (${item.activityMinutes} min)`).join("; ")}.`,
    );
  }
  return lines;
}

function compactJson(label: string, value: unknown): string {
  return `${label}: ${JSON.stringify(value)}`;
}

export function formatDaySchedule(value: DaySchedule): string {
  const lines = [
    `Gapwise day for ${value.date}${value.weekday ? ` (${value.weekday})` : ""} — ${value.term}, revision ${value.revision}.`,
  ];
  lines.push("Academic meetings:");
  lines.push(...(value.meetings.length ? value.meetings.map(meetingLine) : ["- None."]));
  lines.push("Delegated personal items:");
  lines.push(
    ...(value.personalItems.length
      ? value.personalItems.map(personalItemLine)
      : ["- None shared for this day."]),
  );
  lines.push("Gapwise gap plans:");
  if (value.gapPlans.length) {
    for (const plan of value.gapPlans) lines.push(...gapPlanLines(plan));
  } else {
    lines.push("- None shared for this day.");
  }
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatWeekSchedule(value: WeekSchedule): string {
  const lines = [`Gapwise ${value.term} timetable — revision ${value.revision}.`];
  for (const weekday of WEEKDAYS) {
    const meetings = value.meetings.filter((meeting) => meeting.weekday === weekday);
    const personal = value.personalItems.filter((item) => item.weekday === weekday);
    const gaps = value.gapPlans.filter((plan) => plan.weekday === weekday);
    if (!meetings.length && !personal.length && !gaps.length) continue;
    lines.push(`\n${weekday}`);
    if (meetings.length) {
      lines.push("Academic meetings:", ...meetings.map(meetingLine));
    }
    if (personal.length) {
      lines.push("Delegated personal items:", ...personal.map(personalItemLine));
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
