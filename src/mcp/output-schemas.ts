import { z } from "zod";
import {
  AiPermissionsSchema,
  GapPlanSchema,
  GapPreferencesSchema,
  MeetingSchema,
  PersonalItemSchema,
  RoutingPreferencesSchema,
  TermSchema,
  WeekdaySchema,
} from "@/src/domain/schemas";

const revision = z.number().int().min(1);
const minute = z.number().int().min(0).max(1440);
const isoDateTime = z.string().datetime({ offset: true });
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

const MeetingFactSchema = z
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
    componentLabel: z.enum(["LEC", "TUT", "PRA", "OTHER", "RES"]),
    isHardCommitment: z.boolean(),
  })
  .strict();

const GapPlanGroupSchema = z
  .object({
    term: TermSchema,
    appliesTo: z.array(WeekdaySchema).min(1).max(7),
    sourceGapPlanIds: z.array(z.string().min(1).max(500)).min(1).max(7),
    startTime: minute,
    endTime: minute,
    durationMinutes: z.number().int().min(1).max(1440),
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
        meetingIds: z.array(z.string().min(1).max(240)).max(100),
        weeklyMinutes: z.number().int().min(0).max(20_000).nullable(),
        startTime: minute.nullable(),
      })
      .strict(),
  })
  .strict();

const DecisionActionItemSchema = z
  .object({
    code: z.enum(["set_home_commute_minutes"]),
    priority: z.enum(["info", "recommended", "important"]),
    field: z.string().min(1).max(240),
    affects: z.array(z.string().min(1).max(240)).min(1).max(12),
    message: z.string().min(1).max(1000),
    resolvableViaMcp: z.boolean(),
  })
  .strict();

export const DelegationStatusOutputSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      revision,
      permissions: AiPermissionsSchema,
      updatedAt: isoDateTime,
    })
    .strict(),
]);

export const DayScheduleOutputSchema = z
  .object({
    date: calendarDate,
    weekday: WeekdaySchema.nullable(),
    term: TermSchema,
    revision,
    meetings: z.array(MeetingSchema),
    academicMeetings: z.array(MeetingSchema),
    reservedAssessmentWindows: z.array(MeetingSchema),
    meetingFacts: z.array(MeetingFactSchema),
    personalItems: z.array(PersonalItemSchema),
    gapPlans: z.array(GapPlanSchema),
    gapPlanGroups: z.array(GapPlanGroupSchema),
  })
  .strict();

export const WeekScheduleOutputSchema = z
  .object({
    term: TermSchema,
    revision,
    meetings: z.array(MeetingSchema),
    academicMeetings: z.array(MeetingSchema),
    reservedAssessmentWindows: z.array(MeetingSchema),
    meetingFacts: z.array(MeetingFactSchema),
    personalItems: z.array(PersonalItemSchema),
    gapPlans: z.array(GapPlanSchema),
    gapPlanGroups: z.array(GapPlanGroupSchema),
  })
  .strict();

const GapBoundarySchema = z
  .object({
    source: z.enum(["academic", "personal"]),
    id: z.string().min(1).max(240),
    startTime: minute,
    endTime: minute,
    item: z.union([MeetingSchema, PersonalItemSchema]),
  })
  .strict();

export const GapContextOutputSchema = z
  .object({
    revision,
    term: TermSchema,
    weekday: WeekdaySchema,
    requestedWindow: z
      .object({
        startTime: minute,
        endTime: minute,
        durationMinutes: z.number().int().min(1).max(1440),
      })
      .strict(),
    previous: GapBoundarySchema.nullable(),
    next: GapBoundarySchema.nullable(),
    gapPlan: GapPlanSchema.nullable(),
    gapPreferences: GapPreferencesSchema.nullable(),
    routingPreferences: RoutingPreferencesSchema.nullable(),
    planningStatus: z.enum([
      "gapwise_deterministic_assessment",
      "no_matching_gap_plan",
      "gap_plan_permission_disabled",
    ]),
  })
  .strict();

const DecisionBoundarySchema = z
  .object({
    source: z.enum(["academic", "personal"]),
    id: z.string().min(1).max(240),
    label: z.string().min(1).max(500),
    startTime: minute,
    endTime: minute,
    buildingCode: z.string().max(240).nullable(),
    room: z.string().max(240).nullable(),
  })
  .strict();

const FlexiblePersonalSummarySchema = z
  .object({
    id: z.string().min(1).max(240),
    title: z.string().min(1).max(240),
    durationMinutes: z.number().int().min(1).max(1440),
    windowStart: minute.nullable(),
    windowEnd: minute.nullable(),
  })
  .strict();

export const AvailabilityOutputSchema = z
  .object({
    revision,
    generatedAt: isoDateTime,
    term: TermSchema,
    weekday: WeekdaySchema.nullable(),
    date: calendarDate.nullable(),
    minimumDurationMinutes: z.number().int().min(1).max(1440),
    searchBounds: z
      .object({ startTime: minute, endTime: minute })
      .strict()
      .nullable(),
    windows: z
      .array(
        z
          .object({
            startTime: minute,
            endTime: minute,
            durationMinutes: z.number().int().min(1).max(1440),
            previousBoundary: DecisionBoundarySchema.nullable(),
            nextBoundary: DecisionBoundarySchema.nullable(),
            flexiblePersonalItems: z.array(FlexiblePersonalSummarySchema).max(200),
            gapPlan: GapPlanSchema.nullable(),
          })
          .strict(),
      )
      .max(20),
    status: z.enum([
      "available_windows_found",
      "no_matching_window",
      "no_bounded_day",
      "no_weekday_schedule",
    ]),
  })
  .strict();

export const WeeklyAvailabilityOutputSchema = z
  .object({
    revision,
    generatedAt: isoDateTime,
    term: TermSchema,
    minimumDurationMinutes: z.number().int().min(1).max(1440),
    searchBounds: z
      .object({ startTime: minute, endTime: minute })
      .strict()
      .nullable(),
    windows: z
      .array(
        z
          .object({
            weekday: WeekdaySchema,
            startTime: minute,
            endTime: minute,
            rawDurationMinutes: z.number().int().min(1).max(1440),
            usableActivityMinutes: z.number().int().min(0).max(1440),
            planningValidation: z.enum([
              "gapwise_activity_budget",
              "gapwise_transition_unavailable",
              "temporal_only",
            ]),
            previousBoundary: DecisionBoundarySchema.nullable(),
            nextBoundary: DecisionBoundarySchema.nullable(),
            flexiblePersonalItems: z.array(FlexiblePersonalSummarySchema).max(200),
            gapPlan: GapPlanSchema.nullable(),
          })
          .strict(),
      )
      .max(20),
    status: z.enum(["available_windows_found", "no_matching_window"]),
    interpretation: z.string().min(1).max(2000),
  })
  .strict();

const GapwiseActivityWindowSchema = z
  .object({
    startTime: minute,
    endTime: minute,
    maxActivityMinutes: z.number().int().min(0).max(1440),
    source: z.enum(["primary_timeline", "leave_by_fallback"]),
  })
  .strict();

export const PlanFeasibilityOutputSchema = z
  .object({
    revision,
    generatedAt: isoDateTime,
    term: TermSchema,
    weekday: WeekdaySchema.nullable(),
    date: calendarDate.nullable(),
    requestedBlock: z
      .object({
        startTime: minute,
        endTime: minute,
        durationMinutes: z.number().int().min(1).max(1440),
        location: z
          .object({
            buildingCode: z.string().max(240).nullable(),
            room: z.string().max(240).nullable(),
            validated: z.literal(false),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    feasible: z.boolean(),
    validationLevel: z.enum([
      "conflict",
      "gapwise_transition_validated",
      "gapwise_transition_rejected",
      "temporal_only",
    ]),
    conflicts: z.array(DecisionBoundarySchema).max(400),
    flexiblePersonalItems: z.array(FlexiblePersonalSummarySchema).max(200),
    previousBoundary: DecisionBoundarySchema.nullable(),
    nextBoundary: DecisionBoundarySchema.nullable(),
    gapPlan: GapPlanSchema.nullable(),
    gapwiseActivityWindow: GapwiseActivityWindowSchema.nullable(),
    reasons: z.array(z.string().max(1000)).max(24),
    warnings: z.array(z.string().max(1000)).max(24),
  })
  .strict();

const DecisionDaySchema = z
  .object({
    weekday: WeekdaySchema,
    academicMeetingCount: z.number().int().min(0).max(400),
    academicMinutes: z.number().int().min(0).max(20_000),
    fixedPersonalCount: z.number().int().min(0).max(200),
    fixedPersonalMinutes: z.number().int().min(0).max(20_000),
    firstStart: minute.nullable(),
    lastEnd: minute.nullable(),
    gapCount: z.number().int().min(0).max(200),
    totalGapMinutes: z.number().int().min(0).max(20_000),
    totalGapwiseActivityMinutes: z.number().int().min(0).max(20_000),
    unresolvedRouteCount: z.number().int().min(0).max(200),
    bestGap: GapPlanSchema.nullable(),
    warnings: z.array(z.string().max(1000)).max(12),
  })
  .strict();

export const DecisionContextOutputSchema = z
  .object({
    revision,
    generatedAt: isoDateTime,
    term: TermSchema,
    permissions: AiPermissionsSchema,
    hardConstraintSummary: z
      .object({
        academicMeetingCount: z.number().int().min(0).max(400),
        reservedAssessmentWindowCount: z.number().int().min(0).max(400),
        fixedPersonalCount: z.number().int().min(0).max(200),
      })
      .strict(),
    days: z.array(DecisionDaySchema).length(7),
    topGapOpportunities: z.array(GapPlanSchema).max(8),
    gapPlanGroups: z.array(GapPlanGroupSchema).max(200),
    dataQualityFlags: z.array(ScheduleDataFlagSchema).max(40),
    actionItems: z.array(DecisionActionItemSchema).max(12),
    gapPreferences: GapPreferencesSchema.nullable(),
    routingPreferences: RoutingPreferencesSchema.nullable(),
    limitations: z.array(z.string().max(1000)).max(12),
  })
  .strict();

export const PreferencesOutputSchema = z
  .object({
    revision,
    permissions: AiPermissionsSchema,
    gapPreferences: GapPreferencesSchema.nullable(),
    routingPreferences: RoutingPreferencesSchema.nullable(),
  })
  .strict();

export const QueueActionOutputSchema = z
  .object({
    queued: z.boolean(),
    actionId: z.string().uuid(),
    status: z.string().min(1).max(64),
  })
  .strict();
