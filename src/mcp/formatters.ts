import type { z } from "zod";
import {
  DayScheduleOutputSchema,
  GapContextOutputSchema,
  WeekScheduleOutputSchema,
} from "@/src/mcp/output-schemas";
import { withMcpDataBoundary } from "@/src/mcp/text-content";

type DaySchedule = z.infer<typeof DayScheduleOutputSchema>;
type WeekSchedule = z.infer<typeof WeekScheduleOutputSchema>;
type GapContext = z.infer<typeof GapContextOutputSchema>;
type MeetingFact = DaySchedule["meetingFacts"][number];
type GapGroup = DaySchedule["gapPlanGroups"][number];

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

function meetingFactLine(fact: MeetingFact): string {
  const status = fact.isHardCommitment ? "hard" : "informational";
  return `- ${clock(fact.startTime)}–${clock(fact.endTime)} ${fact.courseCode} ${fact.componentLabel} ${fact.sectionCode} · ${fact.locationLabel} · ${status}`;
}

function gapGroupLine(group: GapGroup): string {
  const days = group.appliesTo.join("/");
  const travel = group.travelMinutes === null ? "travel ?" : `travel ${group.travelMinutes}m`;
  const warning = group.keyWarning ? ` · warning: ${group.keyWarning}` : "";
  return `- ${days} ${clock(group.startTime)}–${clock(group.endTime)} · ${group.primaryTitle} · ${group.usableActivityMinutes}m usable · ${travel} · buffer ${group.bufferMinutes}m · leave ${clock(group.leaveByMinutes)} · ${group.confidencePercent}% ${group.confidenceLabel}${warning}`;
}

function compactJson(label: string, value: unknown): string {
  return `${label}: ${JSON.stringify(value)}`;
}

export function formatDaySchedule(value: DaySchedule): string {
  const lines = [
    `Gapwise ${value.date}${value.weekday ? ` (${value.weekday})` : ""} · ${value.term} · revision ${value.revision}.`,
    `${value.academicMeetings.length} hard academic commitment(s); ${value.reservedAssessmentWindows.length} RES placeholder(s).`,
  ];
  if (value.meetingFacts.length) {
    lines.push("Schedule:", ...value.meetingFacts.map(meetingFactLine));
  }
  if (value.gapPlanGroups.length) {
    lines.push("Gap plans:", ...value.gapPlanGroups.map(gapGroupLine));
  }
  if (value.personalItems.length) {
    lines.push(`${value.personalItems.length} legacy Personal Item(s) are also present in structuredContent.`);
  }
  lines.push("Exact recurrence, exclusions, full gap reasoning, and source fields are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatWeekSchedule(value: WeekSchedule): string {
  const lines = [
    `Gapwise ${value.term} timetable · revision ${value.revision}.`,
    `${value.academicMeetings.length} hard academic commitment(s); ${value.reservedAssessmentWindows.length} RES placeholder(s). RES is not counted as weekly load.`,
  ];

  for (const weekday of WEEKDAYS) {
    const facts = value.meetingFacts.filter((fact) => fact.weekday === weekday);
    if (!facts.length) continue;
    lines.push(`\n${weekday}`, ...facts.map(meetingFactLine));
  }

  if (value.gapPlanGroups.length) {
    lines.push("\nDistinct gap plans:", ...value.gapPlanGroups.map(gapGroupLine));
  }
  if (!value.meetingFacts.length) lines.push("No delegated timetable data is present for this term.");
  lines.push("Exact recurrence, exclusions, rich gap details, and raw source-backed meetings are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatGapContext(value: GapContext): string {
  const lines = [
    `Gapwise gap ${value.weekday} ${clock(value.requestedWindow.startTime)}–${clock(value.requestedWindow.endTime)} · ${value.term} · revision ${value.revision}.`,
    `Status: ${value.planningStatus}.`,
  ];
  if (value.gapPlan) {
    const assessment = value.gapPlan.assessment;
    const travel = assessment.travelMinutes === null ? "travel unavailable" : `${assessment.travelMinutes}m travel`;
    lines.push(
      `${assessment.primary.title} · ${assessment.primary.activityMinutes}m usable · ${travel} · ${assessment.bufferMinutes}m buffer · leave ${clock(assessment.leaveByMinutes)} · ${Math.round(assessment.confidence * 100)}% ${assessment.confidenceLabel}.`,
    );
    if (assessment.warnings.length) lines.push(`Warning: ${assessment.warnings[0]}`);
    lines.push("Full reasons, tags, timeline, alternatives, route accuracy, and preferences are in structuredContent.");
  } else {
    lines.push("No matching delegated Gapwise gap plan exists for this exact window.");
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
      `Gapwise delegated AI preferences · revision ${value.revision}.`,
      compactJson("Permissions", value.permissions),
      compactJson("Gap preferences", value.gapPreferences),
      compactJson("Routing preferences", value.routingPreferences),
    ].join("\n"),
  );
}
