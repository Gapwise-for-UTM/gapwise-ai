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
    personalItems: z.array(PersonalItemSchema),
    gapPlans: z.array(GapPlanSchema),
  })
  .strict();

export const WeekScheduleOutputSchema = z
  .object({
    term: TermSchema,
    revision,
    meetings: z.array(MeetingSchema),
    personalItems: z.array(PersonalItemSchema),
    gapPlans: z.array(GapPlanSchema),
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
        fixedPersonalCount: z.number().int().min(0).max(200),
      })
      .strict(),
    days: z.array(DecisionDaySchema).length(5),
    topGapOpportunities: z.array(GapPlanSchema).max(8),
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
