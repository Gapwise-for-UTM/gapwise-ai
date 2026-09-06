import { z } from "zod";
import { TermSchema, WeekdaySchema } from "@/src/domain/schemas";

const minute = z.number().int().min(0).max(1440);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const componentLabel = z.enum(["LEC", "TUT", "PRA", "OTHER", "RES"]);

export const MeetingFactSchema = z
  .object({
    id: z.string().min(1).max(240),
    weekday: WeekdaySchema,
    startTime: minute,
    endTime: minute,
    courseCode: z.string().min(1).max(240),
    courseName: z.string().min(1).max(240),
    sectionCode: z.string().min(1).max(240),
    buildingCode: z.string().max(240).nullable(),
    room: z.string().max(240).nullable(),
    locationLabel: z.string().min(1).max(500),
    semanticType: z.enum(["academic_meeting", "reserved_assessment_window"]),
    componentLabel,
    isHardCommitment: z.boolean(),
  })
  .strict();

const gapPlanGroupBase = {
  term: TermSchema,
  sourceGapPlanIds: z.array(z.string().min(1).max(500)).min(1).max(200),
  startTime: minute,
  endTime: minute,
  durationMinutes: z.number().int().min(1).max(1440),
  previousCourseCode: z.string().max(240).nullable(),
  previousComponentLabel: componentLabel.nullable(),
  previousSectionCode: z.string().max(240).nullable(),
  previousBuildingCode: z.string().max(240).nullable(),
  previousRoom: z.string().max(240).nullable(),
  previousLocationLabel: z.string().max(500).nullable(),
  nextCourseCode: z.string().max(240).nullable(),
  nextComponentLabel: componentLabel.nullable(),
  nextSectionCode: z.string().max(240).nullable(),
  nextBuildingCode: z.string().max(240).nullable(),
  nextRoom: z.string().max(240).nullable(),
  nextLocationLabel: z.string().max(500).nullable(),
  primaryAction: z.string().min(1).max(240),
  primaryTitle: z.string().min(1).max(240),
  primaryScore: z.number().finite(),
  usableActivityMinutes: z.number().int().min(0).max(1440),
  travelMinutes: z.number().int().min(0).max(1440).nullable(),
  bufferMinutes: z.number().int().min(0).max(1440),
  leaveByMinutes: z.number().int().min(-1440).max(2880),
  arrivalMinutes: z.number().int().min(-1440).max(2880).nullable(),
  routeStatus: z.enum(["routed", "approximate", "same-room", "unavailable"]),
  routeAccuracy: z.string().min(1).max(240),
  confidencePercent: z.number().int().min(0).max(100),
  confidenceLabel: z.enum(["high", "medium", "low"]),
  fallback: z.boolean(),
  keyWarning: z.string().max(1000).nullable(),
};

export const GapPlanGroupSchema = z
  .object({
    appliesTo: z.array(WeekdaySchema).min(1).max(7),
    ...gapPlanGroupBase,
  })
  .strict();

export const DateGapPlanGroupSchema = z
  .object({
    appliesToDates: z.array(calendarDate).min(1).max(14),
    ...gapPlanGroupBase,
  })
  .strict();

export const ScheduleDataFlagSchema = z
  .object({
    code: z.enum([
      "duplicate_meeting",
      "multiple_same_section_day_windows",
      "overlapping_section_meetings",
      "high_section_weekly_minutes",
      "late_meeting",
    ]),
    severity: z.enum(["info", "warning"]),
    scope: z.enum(["meeting", "section", "course"]),
    courseCode: z.string().min(1).max(240),
    message: z.string().min(1).max(1000),
    evidence: z
      .object({
        sectionCode: z.string().max(240).nullable(),
        weekday: WeekdaySchema.nullable(),
        meetingIds: z.array(z.string().min(1).max(240)).max(400),
        weeklyMinutes: z.number().int().min(0).max(20_000).nullable(),
        startTime: minute.nullable(),
      })
      .strict(),
  })
  .strict();
