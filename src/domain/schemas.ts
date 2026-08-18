import { z } from "zod";

const shortText = z.string().min(1).max(240);
const optionalShortText = z.string().max(240).nullable();
const minute = z.number().int().min(0).max(24 * 60);
const isoDateTime = z.string().datetime({ offset: true });
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const TermSchema = z.enum(["Fall", "Winter", "Summer"]);
export const WeekdaySchema = z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
export const ActivityTypeSchema = z.enum(["LEC", "TUT", "PRA", "OTHER"]);
export const MeetingLocationTypeSchema = z.enum(["physical", "tba", "online", "unknown"]);

export const MeetingSchema = z
  .object({
    id: shortText,
    courseCode: shortText,
    activityType: ActivityTypeSchema,
    sectionCode: shortText,
    courseName: shortText,
    startTime: minute,
    endTime: minute,
    weekday: WeekdaySchema,
    buildingCode: optionalShortText,
    room: optionalShortText,
    term: TermSchema,
    locationUnknown: z.boolean(),
    locationType: MeetingLocationTypeSchema.optional(),
    dateRange: z
      .object({
        startDate: calendarDate,
        endDate: calendarDate.nullable(),
      })
      .strict()
      .optional(),
    excludedDates: z.array(calendarDate).max(100).optional(),
    recurrenceIntervalWeeks: z.number().int().min(1).max(52).optional(),
  })
  .strict()
  .refine((meeting) => meeting.endTime > meeting.startTime, {
    message: "Meeting endTime must be after startTime.",
  });

export const PersonalCategorySchema = z.enum([
  "Study",
  "Food",
  "Exercise",
  "Club",
  "Work",
  "Commute",
  "Appointment",
  "Break",
  "Personal",
  "Other",
]);

const FixedPersonalItemSchema = z
  .object({
    id: shortText,
    title: shortText,
    category: PersonalCategorySchema,
    term: TermSchema,
    weekday: WeekdaySchema,
    startTime: minute,
    endTime: minute,
    locationBuildingCode: optionalShortText.optional(),
    locationRoom: optionalShortText.optional(),
    locationText: optionalShortText.optional(),
    color: z.string().max(32).optional(),
    flexibility: z.object({ kind: z.literal("fixed") }).strict(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict()
  .refine((item) => item.endTime > item.startTime, {
    message: "Personal item endTime must be after startTime.",
  });

const FlexiblePersonalItemSchema = z
  .object({
    id: shortText,
    title: shortText,
    category: PersonalCategorySchema,
    term: TermSchema,
    weekday: WeekdaySchema,
    locationBuildingCode: optionalShortText.optional(),
    locationRoom: optionalShortText.optional(),
    locationText: optionalShortText.optional(),
    color: z.string().max(32).optional(),
    flexibility: z
      .object({
        kind: z.literal("flexible"),
        durationMinutes: z.number().int().min(1).max(24 * 60),
        windowStart: minute.optional(),
        windowEnd: minute.optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.windowStart === undefined ||
          value.windowEnd === undefined ||
          value.windowEnd > value.windowStart,
        { message: "Flexible personal item window is invalid." },
      ),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

export const PersonalItemSchema = z.union([FixedPersonalItemSchema, FlexiblePersonalItemSchema]);

const GapPreferencesBaseSchema = z
  .object({
    setupMinutes: z.number().int().min(0).max(120),
    packUpMinutes: z.number().int().min(0).max(120),
    lunchWindowStart: minute,
    lunchWindowEnd: minute,
    mealDurationMinutes: z.number().int().min(1).max(240),
    willingToLeaveCampus: z.boolean(),
    oneWayHomeCommuteMinutes: z.number().int().min(1).max(360).nullable(),
    minimumHomeStayMinutes: z.number().int().min(0).max(720),
    homeTurnaroundMinutes: z.number().int().min(0).max(180),
    riskTolerance: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const GapPreferencesSchema = GapPreferencesBaseSchema.refine(
  (value) => value.lunchWindowEnd > value.lunchWindowStart,
  { message: "Lunch window is invalid." },
);

export const RoutingPreferencesSchema = z
  .object({
    mode: z.enum(["fastest", "prefer-indoor", "step-free"]),
    walkingSpeedMps: z.number().min(0.2).max(3),
    transitionBufferMinutes: z.number().int().min(0).max(60),
    avoidStairs: z.boolean(),
    preferIndoor: z.boolean(),
    dayOrigin: z.enum(["commute", "residence"]),
    residenceBuildingCode: optionalShortText,
    commuteMode: z.enum(["transit", "parking", "pickup"]).nullable(),
    campusAccessPointId: optionalShortText,
  })
  .strict();

const GapActionSchema = z.enum([
  "tight-transition",
  "quick-reset",
  "focus-sprint",
  "meal-window",
  "study-block",
  "deep-work-block",
  "flexible-long-gap",
  "leave-campus-candidate",
  "go-home",
  "location-dependent",
]);
const GapTagSchema = z.enum([
  "same-room",
  "same-building",
  "nearby-route",
  "lunch-time",
  "route-verified",
  "route-estimated",
  "route-unavailable",
  "location-unknown",
  "high-transition-risk",
  "indoor-route",
  "step-free-route",
  "good-for-commuting",
]);
const GapTimelineSchema = z
  .object({
    kind: z.enum(["setup", "activity", "travel", "buffer", "flex"]),
    label: z.string().min(1).max(240),
    minutes: z.number().int().min(0).max(24 * 60),
  })
  .strict();
const GapRecommendationSchema = z
  .object({
    id: z.string().min(1).max(240),
    action: GapActionSchema,
    title: z.string().min(1).max(240),
    summary: z.string().min(1).max(1000),
    score: z.number().finite(),
    activityMinutes: z.number().int().min(0).max(24 * 60),
    reasons: z.array(z.string().max(1000)).max(16),
    tags: z.array(GapTagSchema).max(16),
    timeline: z.array(GapTimelineSchema).max(16),
  })
  .strict();
const GapAssessmentSchema = z
  .object({
    primary: GapRecommendationSchema,
    alternatives: z.array(GapRecommendationSchema).max(2),
    confidence: z.number().min(0).max(1),
    confidenceLabel: z.enum(["high", "medium", "low"]),
    travelMinutes: z.number().int().min(0).max(24 * 60).nullable(),
    bufferMinutes: z.number().int().min(0).max(24 * 60),
    leaveByMinutes: z.number().int().min(-24 * 60).max(48 * 60),
    arrivalMinutes: z.number().int().min(-24 * 60).max(48 * 60).nullable(),
    fallback: z.boolean(),
    routeStatus: z.enum(["routed", "approximate", "same-room", "unavailable"]),
    routeAccuracy: z.enum([
      "Verified indoor + outdoor route",
      "Verified outdoor route, indoor estimate",
      "Mapped campus path, indoor estimate",
      "Approximate building-to-building estimate",
      "Location unavailable",
    ]),
    warnings: z.array(z.string().max(1000)).max(24),
  })
  .strict();
export const GapPlanSchema = z
  .object({
    id: z.string().min(1).max(500),
    term: TermSchema,
    weekday: WeekdaySchema,
    startTime: minute,
    endTime: minute,
    durationMinutes: z.number().int().min(1).max(24 * 60),
    previousMeetingId: shortText,
    nextMeetingId: shortText,
    assessment: GapAssessmentSchema,
  })
  .strict()
  .refine((gap) => gap.endTime > gap.startTime && gap.durationMinutes === gap.endTime - gap.startTime, {
    message: "Gap plan timing is inconsistent.",
  });

export const AiPermissionsSchema = z
  .object({
    readSchedule: z.literal(true),
    readPersonal: z.boolean(),
    writePersonal: z.boolean(),
    readGapPlans: z.boolean(),
    readGapPreferences: z.boolean(),
    writeGapPreferences: z.boolean(),
    readRoutingPreferences: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.writePersonal && !value.readPersonal) {
      ctx.addIssue({ code: "custom", path: ["writePersonal"], message: "Write requires readPersonal." });
    }
    if (value.writeGapPreferences && !value.readGapPreferences) {
      ctx.addIssue({
        code: "custom",
        path: ["writeGapPreferences"],
        message: "Write requires readGapPreferences.",
      });
    }
  });

export const AiSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().min(1),
    generatedAt: isoDateTime,
    permissions: AiPermissionsSchema,
    schedule: z.array(MeetingSchema).max(400),
    personalItems: z.array(PersonalItemSchema).max(200),
    gapPlans: z.array(GapPlanSchema).max(200),
    gapPreferences: GapPreferencesSchema.nullable(),
    routingPreferences: RoutingPreferencesSchema.nullable(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (!snapshot.permissions.readPersonal && snapshot.personalItems.length > 0) {
      ctx.addIssue({ code: "custom", path: ["personalItems"], message: "Personal access is disabled." });
    }
    if (!snapshot.permissions.readGapPlans && snapshot.gapPlans.length > 0) {
      ctx.addIssue({ code: "custom", path: ["gapPlans"], message: "Gap-plan access is disabled." });
    }
    if (!snapshot.permissions.readGapPreferences && snapshot.gapPreferences !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["gapPreferences"],
        message: "Gap preference access is disabled.",
      });
    }
    if (!snapshot.permissions.readRoutingPreferences && snapshot.routingPreferences !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["routingPreferences"],
        message: "Routing preference access is disabled.",
      });
    }
  });

const PersonalItemDraftBase = z
  .object({
    title: shortText,
    category: PersonalCategorySchema,
    term: TermSchema,
    weekday: WeekdaySchema,
    locationBuildingCode: optionalShortText.optional(),
    locationRoom: optionalShortText.optional(),
    locationText: optionalShortText.optional(),
    color: z.string().max(32).optional(),
  })
  .strict();

export const FixedPersonalItemDraftSchema = PersonalItemDraftBase.extend({
  startTime: minute,
  endTime: minute,
  flexibility: z.object({ kind: z.literal("fixed") }).strict(),
})
  .strict()
  .refine((item) => item.endTime > item.startTime, {
    message: "Personal item endTime must be after startTime.",
  });

export const FlexiblePersonalItemDraftSchema = PersonalItemDraftBase.extend({
  flexibility: z
    .object({
      kind: z.literal("flexible"),
      durationMinutes: z.number().int().min(1).max(24 * 60),
      windowStart: minute.optional(),
      windowEnd: minute.optional(),
    })
    .strict()
    .refine(
      (value) =>
        value.windowStart === undefined ||
        value.windowEnd === undefined ||
        value.windowEnd > value.windowStart,
      { message: "Flexible personal item window is invalid." },
    ),
}).strict();

export const PersonalItemDraftSchema = z.union([
  FixedPersonalItemDraftSchema,
  FlexiblePersonalItemDraftSchema,
]);

export const PersonalItemPatchSchema = z
  .object({
    title: shortText.optional(),
    category: PersonalCategorySchema.optional(),
    term: TermSchema.optional(),
    weekday: WeekdaySchema.optional(),
    startTime: minute.optional(),
    endTime: minute.optional(),
    locationBuildingCode: optionalShortText.optional(),
    locationRoom: optionalShortText.optional(),
    locationText: optionalShortText.optional(),
    color: z.string().max(32).nullable().optional(),
    flexibility: z
      .union([
        z.object({ kind: z.literal("fixed") }).strict(),
        z
          .object({
            kind: z.literal("flexible"),
            durationMinutes: z.number().int().min(1).max(24 * 60),
            windowStart: minute.optional(),
            windowEnd: minute.optional(),
          })
          .strict(),
      ])
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one change is required." });

export const GapPreferencesPatchSchema = GapPreferencesBaseSchema.partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one change is required." });

export const AiActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      schemaVersion: z.literal(1),
      kind: z.literal("create_personal_item"),
      expectedRevision: z.number().int().min(1),
      item: PersonalItemDraftSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      kind: z.literal("update_personal_item"),
      expectedRevision: z.number().int().min(1),
      itemId: shortText,
      patch: PersonalItemPatchSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      kind: z.literal("delete_personal_item"),
      expectedRevision: z.number().int().min(1),
      itemId: shortText,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      kind: z.literal("update_gap_preferences"),
      expectedRevision: z.number().int().min(1),
      patch: GapPreferencesPatchSchema,
    })
    .strict(),
]);

export const CompleteActionSchema = z
  .object({
    status: z.enum(["applied", "rejected"]),
    resultCode: z.string().min(1).max(64).optional(),
  })
  .strict();

export type AiPermissions = z.infer<typeof AiPermissionsSchema>;
export type AiSnapshot = z.infer<typeof AiSnapshotSchema>;
export type AiAction = z.infer<typeof AiActionSchema>;
export type PersonalItem = z.infer<typeof PersonalItemSchema>;
export type GapPreferences = z.infer<typeof GapPreferencesSchema>;
