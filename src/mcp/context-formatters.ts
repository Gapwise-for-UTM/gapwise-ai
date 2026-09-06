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
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function location(meeting: Meeting): string {
  if (meeting.isReservedAssessmentWindow) return "announced if RES is used";
  if (meeting.locationType === "online") return "Online";
  if (meeting.locationType === "tba") return "TBA";
  const parts = [meeting.buildingCode, meeting.room].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return meeting.locationUnknown ? "Unknown" : "Not provided";
}

function meetingLine(meeting: Meeting): string {
  const component = meeting.isReservedAssessmentWindow ? "RES" : meeting.activityType;
  const status = meeting.isReservedAssessmentWindow ? "informational" : "hard";
  return `${meeting.weekday} ${clock(meeting.startTime)}–${clock(meeting.endTime)} · ${meeting.courseCode} ${component} ${meeting.sectionCode} · ${location(meeting)} · ${status}`;
}

export function formatScheduleSearch(value: ScheduleSearch): string {
  const lines = [
    `Gapwise schedule search “${value.query}” · revision ${value.revision}.`,
    value.results.length ? `${value.results.length} result(s):` : "No delegated schedule entry matched.",
  ];
  for (const result of value.results) {
    lines.push(`- ${meetingLine(result.meeting)}`);
  }
  lines.push("Match scores and exact source fields are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatCourseContext(value: CourseContext): string {
  const lines = [
    `Gapwise course context “${value.query}” · revision ${value.revision} · ${value.resolutionStatus}.`,
  ];
  if (value.resolutionStatus !== "resolved") {
    if (value.alternatives.length) {
      lines.push(`Candidates: ${value.alternatives.map((item) => item.courseCode).join(", ")}.`);
    }
    if (value.notes.length) lines.push(value.notes[0]!);
    return withMcpDataBoundary(lines.join("\n"));
  }

  lines.push(`${value.courseCode} · ${value.courseName}.`);
  lines.push(
    `Academic meetings: ${value.academicMeetings.length}; RES placeholders: ${value.reservedAssessmentWindows.length}.`,
  );
  lines.push(...value.academicMeetings.map((meeting) => `- ${meetingLine(meeting)}`));
  if (value.reservedAssessmentWindows.length) {
    lines.push("RES:", ...value.reservedAssessmentWindows.map((meeting) => `- ${meetingLine(meeting)}`));
  }
  if (value.flags.length) {
    lines.push("Data flags:", ...value.flags.map((flag) => `- ${flag.message}`));
  }
  if (value.notes.length) lines.push(...value.notes.map((note) => `Note: ${note}`));
  lines.push("Flat meetingFacts plus exact anomaly evidence are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatScheduleRange(value: ScheduleRange): string {
  const lines = [
    `Gapwise schedule ${value.startDate}–${value.endDate} · revision ${value.revision}.`,
  ];
  for (const day of value.days) {
    lines.push(`\n${day.date} (${day.weekday})`);
    lines.push(...(day.academicMeetings.length
      ? day.academicMeetings.map((meeting) => `- ${meetingLine(meeting)}`)
      : ["- No academic commitments."]));
    if (day.reservedAssessmentWindows.length) {
      lines.push(...day.reservedAssessmentWindows.map((meeting) => `- ${meetingLine(meeting)}`));
    }
  }
  if (value.gapPlanGroups.length) {
    lines.push("\nDistinct gap plans:");
    for (const plan of value.gapPlanGroups) {
      const dates = plan.appliesToDates.join(", ");
      const leaveBy = clock(plan.leaveByMinutes);
      const warning = plan.keyWarning ? ` · warning: ${plan.keyWarning}` : "";
      lines.push(
        `- ${dates} · ${clock(plan.startTime)}–${clock(plan.endTime)} · ${plan.primaryTitle} · ${plan.usableActivityMinutes}m usable · leave ${leaveBy} · ${plan.confidencePercent}%${warning}`,
      );
    }
  }
  lines.push("Flat meetingFacts, grouped gap plans, recurrence, and exclusions are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}
