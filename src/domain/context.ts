import { z } from "zod";
import {
  DateGapPlanGroupSchema,
  MeetingFactSchema,
  ScheduleDataFlagSchema,
} from "@/src/domain/assistant-schemas";
import {
  groupGapPlansByDate,
  meetingFact,
  meetingSemantics,
  scheduleDataFlags,
} from "@/src/domain/assistant-data";
import {
  ActivityTypeSchema,
  GapPlanSchema,
  MeetingSchema,
  TermSchema,
  WeekdaySchema,
  type AiSnapshot,
} from "@/src/domain/schemas";
import { daySchedule } from "@/src/domain/schedule";

type Meeting = AiSnapshot["schedule"][number];
type Term = Meeting["term"];
type Weekday = Meeting["weekday"];
type ActivityType = Meeting["activityType"];

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const SearchResultSchema = z
  .object({
    score: z.number().int().min(1).max(200),
    matchReasons: z.array(z.string().min(1).max(240)).max(8),
    semanticType: z.enum(["academic_meeting", "reserved_assessment_window"]),
    componentLabel: z.string().min(1).max(16),
    isHardCommitment: z.boolean(),
    meeting: MeetingSchema,
  })
  .strict();

export const ScheduleSearchOutputSchema = z
  .object({
    revision: z.number().int().min(1),
    query: z.string().min(1).max(240),
    filters: z
      .object({
        term: TermSchema.nullable(),
        weekday: WeekdaySchema.nullable(),
        activityType: ActivityTypeSchema.nullable(),
      })
      .strict(),
    results: z.array(SearchResultSchema).max(50),
  })
  .strict();

const CourseAlternativeSchema = z
  .object({
    courseCode: z.string().min(1).max(240),
    courseName: z.string().min(1).max(240),
    score: z.number().int().min(1).max(200),
  })
  .strict();

export const CourseContextOutputSchema = z
  .object({
    revision: z.number().int().min(1),
    query: z.string().min(1).max(240),
    term: TermSchema.nullable(),
    resolutionStatus: z.enum(["resolved", "ambiguous", "not_found"]),
    courseCode: z.string().min(1).max(240).nullable(),
    courseName: z.string().min(1).max(240).nullable(),
    academicMeetings: z.array(MeetingSchema).max(100),
    reservedAssessmentWindows: z.array(MeetingSchema).max(100),
    meetingFacts: z.array(MeetingFactSchema).max(100),
    alternatives: z.array(CourseAlternativeSchema).max(8),
    flags: z.array(ScheduleDataFlagSchema).max(40),
    notes: z.array(z.string().min(1).max(1000)).max(12),
  })
  .strict();

export const ScheduleRangeOutputSchema = z
  .object({
    revision: z.number().int().min(1),
    startDate: calendarDate,
    endDate: calendarDate,
    days: z
      .array(
        z
          .object({
            date: calendarDate,
            weekday: WeekdaySchema,
            term: TermSchema,
            academicMeetings: z.array(MeetingSchema).max(100),
            reservedAssessmentWindows: z.array(MeetingSchema).max(100),
            meetingFacts: z.array(MeetingFactSchema).max(100),
            gapPlans: z.array(GapPlanSchema).max(100),
          })
          .strict(),
      )
      .max(14),
    gapPlanGroups: z.array(DateGapPlanGroupSchema).max(200),
  })
  .strict();

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("en-CA")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function compact(value: string | null | undefined): string {
  return normalized(value).replace(/\s+/gu, "");
}

function textScore(query: string, value: string | null | undefined, weights: {
  exact: number;
  prefix: number;
  token: number;
  contains: number;
}): number {
  const q = normalized(query);
  const candidate = normalized(value);
  if (!q || !candidate) return 0;
  if (candidate === q) return weights.exact;
  if (candidate.startsWith(q)) return weights.prefix;
  if (candidate.split(/\s+/u).some((token) => token === q || token.startsWith(q))) {
    return weights.token;
  }
  if (candidate.includes(q)) return weights.contains;
  const compactQuery = compact(query);
  if (compactQuery && compact(value).includes(compactQuery)) return Math.max(1, weights.contains - 5);
  return 0;
}

function scoreMeeting(query: string, meeting: Meeting): { score: number; reasons: string[] } {
  const fields = [
    ["course code", meeting.courseCode, { exact: 200, prefix: 185, token: 175, contains: 165 }],
    ["course name", meeting.courseName, { exact: 175, prefix: 160, token: 150, contains: 140 }],
    ["section", meeting.sectionCode, { exact: 135, prefix: 125, token: 115, contains: 105 }],
    ["building", meeting.buildingCode, { exact: 120, prefix: 110, token: 100, contains: 90 }],
    ["room", meeting.room, { exact: 100, prefix: 90, token: 80, contains: 70 }],
  ] as const;
  let score = 0;
  const reasons: string[] = [];
  for (const [label, value, weights] of fields) {
    const current = textScore(query, value, weights);
    if (current > score) score = current;
    if (current > 0) reasons.push(label);
  }
  return { score, reasons };
}

function sortMeetings(a: Meeting, b: Meeting): number {
  const days: Weekday[] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return (
    days.indexOf(a.weekday) - days.indexOf(b.weekday) ||
    a.startTime - b.startTime ||
    a.courseCode.localeCompare(b.courseCode)
  );
}

export function searchSchedule(
  snapshot: AiSnapshot,
  input: {
    query: string;
    term?: Term;
    weekday?: Weekday;
    activityType?: ActivityType;
    maxResults: number;
  },
) {
  const results = snapshot.schedule
    .filter((meeting) => input.term === undefined || meeting.term === input.term)
    .filter((meeting) => input.weekday === undefined || meeting.weekday === input.weekday)
    .filter((meeting) => input.activityType === undefined || meeting.activityType === input.activityType)
    .map((meeting) => {
      const { score, reasons } = scoreMeeting(input.query, meeting);
      return {
        score,
        matchReasons: reasons,
        ...meetingSemantics(meeting),
        meeting,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || sortMeetings(a.meeting, b.meeting))
    .slice(0, input.maxResults);

  return {
    revision: snapshot.revision,
    query: input.query,
    filters: {
      term: input.term ?? null,
      weekday: input.weekday ?? null,
      activityType: input.activityType ?? null,
    },
    results,
  };
}

function courseGroups(snapshot: AiSnapshot, query: string, term?: Term) {
  const groups = new Map<string, { courseCode: string; courseName: string; score: number }>();
  for (const meeting of snapshot.schedule) {
    if (term !== undefined && meeting.term !== term) continue;
    const { score } = scoreMeeting(query, meeting);
    if (!score) continue;
    const previous = groups.get(meeting.courseCode);
    if (!previous || score > previous.score) {
      groups.set(meeting.courseCode, {
        courseCode: meeting.courseCode,
        courseName: meeting.courseName,
        score,
      });
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.score - a.score || a.courseCode.localeCompare(b.courseCode),
  );
}

export function getCourseContext(snapshot: AiSnapshot, query: string, term?: Term) {
  const alternatives = courseGroups(snapshot, query, term).slice(0, 8);
  const top = alternatives[0];
  if (!top) {
    return {
      revision: snapshot.revision,
      query,
      term: term ?? null,
      resolutionStatus: "not_found" as const,
      courseCode: null,
      courseName: null,
      academicMeetings: [],
      reservedAssessmentWindows: [],
      meetingFacts: [],
      alternatives: [],
      flags: [],
      notes: ["No delegated academic course matched this query. Do not infer a course that is absent."],
    };
  }

  const second = alternatives[1];
  const exactCode = compact(top.courseCode) === compact(query);
  const ambiguous = !exactCode && second !== undefined && second.score === top.score;
  if (ambiguous) {
    return {
      revision: snapshot.revision,
      query,
      term: term ?? null,
      resolutionStatus: "ambiguous" as const,
      courseCode: null,
      courseName: null,
      academicMeetings: [],
      reservedAssessmentWindows: [],
      meetingFacts: [],
      alternatives,
      flags: [],
      notes: ["Multiple delegated courses match equally well. Use search_my_schedule or a course code to disambiguate."],
    };
  }

  const meetings = snapshot.schedule
    .filter((meeting) => meeting.courseCode === top.courseCode)
    .filter((meeting) => term === undefined || meeting.term === term)
    .sort(sortMeetings);
  const academicMeetings = meetings.filter((meeting) => !meeting.isReservedAssessmentWindow);
  const reservedAssessmentWindows = meetings.filter((meeting) => meeting.isReservedAssessmentWindow);
  const flags = scheduleDataFlags(academicMeetings);
  const notes: string[] = [];
  if (reservedAssessmentWindows.length) {
    notes.push(
      "RES entries are recurring ACORN assessment placeholders, not weekly classes. They do not block availability unless a real assessment is separately announced.",
    );
  }
  if (academicMeetings.some((meeting) => meeting.locationType === "tba")) {
    notes.push(
      "At least one ordinary academic meeting has a TBA location. It remains a real timetable commitment even though its location is unresolved.",
    );
  }

  return {
    revision: snapshot.revision,
    query,
    term: term ?? null,
    resolutionStatus: "resolved" as const,
    courseCode: top.courseCode,
    courseName: top.courseName,
    academicMeetings,
    reservedAssessmentWindows,
    meetingFacts: meetings.map(meetingFact),
    alternatives,
    flags,
    notes,
  };
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Date is invalid.");
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getScheduleRange(snapshot: AiSnapshot, startDate: string, days: number) {
  const entries = Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const day = daySchedule(snapshot, date);
    return {
      date,
      weekday: day.weekday,
      term: day.term,
      academicMeetings: day.academicMeetings,
      reservedAssessmentWindows: day.reservedAssessmentWindows,
      meetingFacts: day.meetingFacts,
      gapPlans: day.gapPlans,
    };
  });
  return {
    revision: snapshot.revision,
    startDate,
    endDate: addDays(startDate, days - 1),
    days: entries,
    gapPlanGroups: groupGapPlansByDate(entries, snapshot.schedule),
  };
}
