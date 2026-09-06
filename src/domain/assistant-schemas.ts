import { z } from "zod";
import { WeekdaySchema } from "@/src/domain/schemas";

const minute = z.number().int().min(0).max(1440);

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
        meetingIds: z.array(z.string().min(1).max(240)).max(100),
        weeklyMinutes: z.number().int().min(0).max(20_000).nullable(),
        startTime: minute.nullable(),
      })
      .strict(),
  })
  .strict();
