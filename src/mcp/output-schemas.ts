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
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
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
