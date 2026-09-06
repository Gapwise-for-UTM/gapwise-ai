import type { z } from "zod";
import {
  CourseContextOutputSchema,
  ScheduleRangeOutputSchema,
  ScheduleSearchOutputSchema,
} from "@/src/domain/context";
import { withMcpDataBoundary } from "@/src/mcp/text-content";

type ScheduleSearch = z.infer<typeof ScheduleSearchOutputSchema>;
type CourseContext = z.infer<typeof CourseContextOutputSchema>;
type ScheduleRange = z.infer<typeof ScheduleRangeOutputSchema>;

type Meeting = ScheduleSearch["results"][number]["meeting"];

function clock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function location(meeting: Meeting): string {
  if (meeting.isReservedAssessmentWindow) return "location only announced if this window is used";
  if (meeting.locationType === "online") return "Online";
  if (meeting.locationType === "tba") return "Location TBA";
  const parts = [meeting.buildingCode, meeting.room].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return meeting.locationUnknown ? "Location unknown" : "Location not provided";
}

function meetingLine(meeting: Meeting): string {
  const component = meeting.isReservedAssessmentWindow ? "RES" : meeting.activityType;
  const semantic = meeting.isReservedAssessmentWindow
    ? "reserved assessment window; not a weekly class; only active when announced"
    : "academic commitment";
  return `${meeting.weekday} ${clock(meeting.startTime)}–${clock(meeting.endTime)} — ${meeting.courseCode} ${component} ${meeting.sectionCode} — ${location(meeting)} — ${semantic}`;
}

export function formatScheduleSearch(value: ScheduleSearch): string {
  const lines = [
    `Gapwise schedule search for “${value.query}” — revision ${value.revision}.`,
    value.results.length ? `${value.results.length} result(s):` : "No delegated schedule entry matched.",
  ];
  for (const result of value.results) {
    lines.push(
      `- score ${result.score}; matched ${result.matchReasons.join(", ")}: ${meetingLine(result.meeting)}`,
    );
  }
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatCourseContext(value: CourseContext): string {
  const lines = [
    `Gapwise course context for “${value.query}” — revision ${value.revision}; status ${value.resolutionStatus}.`,
  ];
  if (value.resolutionStatus !== "resolved") {
    if (value.alternatives.length) {
      lines.push(
        `Candidates: ${value.alternatives.map((item) => `${item.courseCode} — ${item.courseName}`).join("; ")}.`,
      );
    }
    lines.push(...value.notes);
    return withMcpDataBoundary(lines.join("\n"));
  }
  lines.push(`${value.courseCode} — ${value.courseName}.`);
  lines.push("Recurring academic commitments:");
  lines.push(...(value.academicMeetings.length ? value.academicMeetings.map((item) => `- ${meetingLine(item)}`) : ["- None."]));
  lines.push("Reserved assessment windows:");
  lines.push(
    ...(value.reservedAssessmentWindows.length
      ? value.reservedAssessmentWindows.map((item) => `- ${meetingLine(item)}`)
      : ["- None."]),
  );
  lines.push(...value.notes.map((note) => `Note: ${note}`));
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatScheduleRange(value: ScheduleRange): string {
  const lines = [
    `Gapwise schedule range ${value.startDate}–${value.endDate} — revision ${value.revision}.`,
  ];
  for (const day of value.days) {
    lines.push(`\n${day.date} (${day.weekday}, ${day.term})`);
    lines.push("Academic commitments:");
    lines.push(
      ...(day.academicMeetings.length
        ? day.academicMeetings.map((item) => `- ${meetingLine(item)}`)
        : ["- None."]),
    );
    if (day.reservedAssessmentWindows.length) {
      lines.push("Reserved assessment placeholders (not weekly commitments):");
      lines.push(...day.reservedAssessmentWindows.map((item) => `- ${meetingLine(item)}`));
    }
    if (day.gapPlans.length) {
      lines.push(
        `Gapwise delegated gap plans: ${day.gapPlans
          .map((plan) => `${clock(plan.startTime)}–${clock(plan.endTime)} (${plan.assessment.primary.activityMinutes} min activity budget)`)
          .join("; ")}.`,
      );
    }
  }
  return withMcpDataBoundary(lines.join("\n"));
}