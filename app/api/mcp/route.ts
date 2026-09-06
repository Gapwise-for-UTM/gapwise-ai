import { withMcpAuth } from "mcp-handler";
import { createMcpHandler } from "@/src/audit/mcp-handler";
import { z } from "zod";
import type { VerifiedCaller } from "@/src/auth/verify";
import { verifyMcpToken } from "@/src/auth/verify";
import {
  installToolSecuritySchemeProjection,
  mcpAuthenticationRequired,
  OPENAI_TOOL_META,
} from "@/src/auth/mcp";
import { findWeeklyAvailableWindows } from "@/src/domain/availability";
import {
  CourseContextOutputSchema,
  getCourseContext,
  getScheduleRange,
  ScheduleRangeOutputSchema,
  ScheduleSearchOutputSchema,
  searchSchedule,
} from "@/src/domain/context";
import {
  checkPlanFeasibility,
  decisionContext,
  findAvailableWindows,
} from "@/src/domain/decision";
import {
  ActivityTypeSchema,
  GapPreferencesPatchSchema,
  TermSchema,
  WeekdaySchema,
} from "@/src/domain/schemas";
import { daySchedule, gapContext, weekSchedule } from "@/src/domain/schedule";
import {
  DelegationError,
  delegationStatus,
  queueAction,
  readSnapshot,
} from "@/src/delegation/service";
import {
  formatCourseContext,
  formatScheduleRange,
  formatScheduleSearch,
} from "@/src/mcp/context-formatters";
import {
  formatAvailability,
  formatDecisionContext,
  formatPlanFeasibility,
  formatWeeklyAvailability,
} from "@/src/mcp/decision-formatters";
import {
  formatDaySchedule,
  formatGapContext,
  formatPreferences,
  formatWeekSchedule,
} from "@/src/mcp/formatters";
import {
  AvailabilityOutputSchema,
  DayScheduleOutputSchema,
  DecisionContextOutputSchema,
  DelegationStatusOutputSchema,
  GapContextOutputSchema,
  PlanFeasibilityOutputSchema,
  PreferencesOutputSchema,
  QueueActionOutputSchema,
  WeeklyAvailabilityOutputSchema,
  WeekScheduleOutputSchema,
} from "@/src/mcp/output-schemas";

const revision = z.number().int().min(1).describe(
  "The current Gapwise AI snapshot revision returned by a read tool.",
);
const idempotencyKey = z
  .string()
  .min(8)
  .max(128)
  .optional()
  .describe("Optional stable retry key. Reuse the same value when retrying the exact same requested change.");
const minute = z.number().int().min(0).max(1440);
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const decisionScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("date"), date: calendarDate }).strict(),
  z.object({ kind: z.literal("term_weekday"), term: TermSchema, weekday: WeekdaySchema }).strict(),
]);
const boundedSearchFields = {
  minimumDurationMinutes: z.number().int().min(1).max(720),
  windowStart: minute.optional(),
  windowEnd: minute.optional(),
  maxResults: z.number().int().min(1).max(20).default(10),
};

function validateOptionalBounds(
  value: { windowStart?: number; windowEnd?: number },
  ctx: z.RefinementCtx,
) {
  const hasStart = value.windowStart !== undefined;
  const hasEnd = value.windowEnd !== undefined;
  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: "custom",
      path: [hasStart ? "windowEnd" : "windowStart"],
      message: "windowStart and windowEnd must be supplied together.",
    });
  }
  if (hasStart && hasEnd && value.windowEnd! <= value.windowStart!) {
    ctx.addIssue({
      code: "custom",
      path: ["windowEnd"],
      message: "windowEnd must be after windowStart.",
    });
  }
}

type ToolContext = {
  http?: {
    authInfo?: {
      token: string;
      clientId: string;
      expiresAt?: number;
      extra?: Record<string, unknown>;
    };
  };
};

function callerFromContext(ctx: ToolContext): VerifiedCaller | null {
  const auth = ctx.http?.authInfo;
  const userId = auth?.extra?.["userId"];
  if (!auth?.token || !auth.expiresAt || typeof userId !== "string") return null;
  return { userId, accessToken: auth.token, expiresAt: auth.expiresAt };
}

function ok(summary: string, value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: value,
  };
}

function failure(error: unknown) {
  if (error instanceof DelegationError) {
    return {
      content: [{ type: "text" as const, text: `${error.code}: ${error.message}` }],
      structuredContent: { error: error.code, message: error.message },
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: "Gapwise AI could not complete this request. No timetable assumptions were made.",
      },
    ],
    structuredContent: { error: "internal_error" },
    isError: true,
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_ai_delegation_status",
      {
        title: "Get Gapwise AI access status",
        description:
          "Check whether this Gapwise account has explicitly enabled AI access and see the current revision and permissions. Does not return timetable content. Legacy Personal Item permissions are normalized off because Personal Items are retired.",
        inputSchema: z.object({}).strict(),
        outputSchema: DelegationStatusOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (_args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const value = await delegationStatus(caller);
          return ok(
            value.enabled
              ? `Gapwise AI is enabled at revision ${value.revision}.`
              : "Gapwise AI is not enabled.",
            value,
          );
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_day",
      {
        title: "Get my Gapwise day",
        description:
          "Return exact source-backed timetable entries and deterministic Gapwise gap assessments for one calendar date. Reserved assessment windows are explicitly marked RES/isReservedAssessmentWindow and are informational placeholders, not weekly commitments. Ordinary classes with a TBA room remain real commitments. Never guesses missing meetings, locations, routes, or gap recommendations.",
        inputSchema: z.object({ date: calendarDate }).strict(),
        outputSchema: DayScheduleOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ date }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = daySchedule(snapshot, date);
          return ok(formatDaySchedule(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_week",
      {
        title: "Get my Gapwise week",
        description:
          "Return the normalized Gapwise timetable for one academic term plus deterministic Gapwise gap assessments. Includes all seven weekdays, recurrence/exclusion facts, normal TBA-location commitments, and explicit RES assessment placeholders. Personal Items are retired and are not part of current planning.",
        inputSchema: z.object({ term: TermSchema }).strict(),
        outputSchema: WeekScheduleOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ term }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = weekSchedule(snapshot, term);
          return ok(formatWeekSchedule(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "search_my_schedule",
      {
        title: "Search my Gapwise schedule",
        description:
          "Search the delegated timetable by course code/name, section, building code, or room with optional term/weekday/component filters. Results are ranked deterministically and explicitly identify hard academic commitments versus reserved assessment placeholders. Use this before guessing which class, course, room, or building a user means.",
        inputSchema: z
          .object({
            query: z.string().min(1).max(240),
            term: TermSchema.optional(),
            weekday: WeekdaySchema.optional(),
            activityType: ActivityTypeSchema.optional(),
            maxResults: z.number().int().min(1).max(50).default(12),
          })
          .strict(),
        outputSchema: ScheduleSearchOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = searchSchedule(snapshot, args);
          return ok(formatScheduleSearch(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_course_context",
      {
        title: "Get my Gapwise course context",
        description:
          "Resolve a delegated course from a code or course-name query and return its recurring academic commitments separately from reserved assessment windows. Reports ambiguity instead of guessing and calls out ordinary TBA-location classes as real commitments. Use this for questions like 'what does my MAT157 week look like?' or 'when is CSC110?'.",
        inputSchema: z
          .object({ query: z.string().min(1).max(240), term: TermSchema.optional() })
          .strict(),
        outputSchema: CourseContextOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ query, term }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = getCourseContext(snapshot, query, term);
          return ok(formatCourseContext(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_schedule_range",
      {
        title: "Get my Gapwise schedule range",
        description:
          "Return date-specific schedule occurrences for 1–14 consecutive days, respecting recurrence start/end dates and excluded dates. Separates academic commitments from reserved assessment placeholders and includes delegated Gapwise gap plans that actually apply on each date. Use this for 'what do I have over the next few days?' rather than extrapolating a generic week.",
        inputSchema: z
          .object({
            startDate: calendarDate,
            days: z.number().int().min(1).max(14).default(7),
          })
          .strict(),
        outputSchema: ScheduleRangeOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ startDate, days }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = getScheduleRange(snapshot, startDate, days);
          return ok(formatScheduleRange(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_gap_plan",
      {
        title: "Get my Gapwise gap plan",
        description:
          "Return Gapwise's precomputed deterministic assessment for an exact delegated gap when gap-plan sharing is enabled. Includes actual boundaries, recommendation, route status/confidence, travel/buffer time, leave-by/arrival time and shared preferences. Reserved assessment placeholders are never used as hard gap boundaries.",
        inputSchema: z
          .object({
            term: TermSchema,
            weekday: WeekdaySchema,
            startTime: minute,
            endTime: minute,
          })
          .strict()
          .refine((value) => value.endTime > value.startTime, {
            message: "endTime must be after startTime",
          }),
        outputSchema: GapContextOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = gapContext(snapshot, args);
          return ok(formatGapContext(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_ai_preferences",
      {
        title: "Get my delegated Gapwise preferences",
        description:
          "Return only planning/routing preferences the user explicitly allowed Gapwise to share with AI. Personal Item permissions are legacy schema keys and are always normalized off.",
        inputSchema: z.object({}).strict(),
        outputSchema: PreferencesOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (_args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = {
            revision: snapshot.revision,
            permissions: snapshot.permissions,
            gapPreferences: snapshot.permissions.readGapPreferences ? snapshot.gapPreferences : null,
            routingPreferences: snapshot.permissions.readRoutingPreferences
              ? snapshot.routingPreferences
              : null,
          };
          return ok(formatPreferences(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "get_my_decision_context",
      {
        title: "Get my Gapwise decision context",
        description:
          "Return a compact planning-oriented summary for one term: real academic load, authoritative Gapwise gap opportunities, route uncertainty, freshness/revision, and delegated planning/routing preferences. Reserved assessment windows are excluded from hard load. Use this before broad planning questions instead of repeatedly re-reading the timetable or inventing availability arithmetic.",
        inputSchema: z.object({ term: TermSchema }).strict(),
        outputSchema: DecisionContextOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ term }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = decisionContext(snapshot, term);
          return ok(formatDecisionContext(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "find_my_available_windows",
      {
        title: "Find my Gapwise available windows",
        description:
          "Find source-backed free windows on one date or one term weekday using real academic meetings as hard constraints. Reserved assessment placeholders are intentionally ignored; ordinary classes with TBA locations still block time. With no explicit search bounds, only windows between hard events are returned, so no wake/sleep assumptions are invented.",
        inputSchema: z
          .object({
            scope: decisionScopeSchema,
            ...boundedSearchFields,
          })
          .strict()
          .superRefine(validateOptionalBounds),
        outputSchema: AvailabilityOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = findAvailableWindows(snapshot, args);
          return ok(formatAvailability(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "find_my_weekly_opportunities",
      {
        title: "Find my Gapwise weekly opportunities",
        description:
          "Search all seven weekdays for usable planning opportunities in one academic term. A raw free gap is capped by the delegated deterministic Gapwise activity budget, and a gap whose surrounding route is unavailable contributes zero validated activity minutes. Reserved assessment placeholders do not block availability. Use this for requests like 'find 90-minute study windows this week'.",
        inputSchema: z
          .object({
            term: TermSchema,
            ...boundedSearchFields,
          })
          .strict()
          .superRefine(validateOptionalBounds),
        outputSchema: WeeklyAvailabilityOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = findWeeklyAvailableWindows(snapshot, args);
          return ok(formatWeeklyAvailability(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "check_my_plan_feasibility",
      {
        title: "Check my Gapwise plan feasibility",
        description:
          "Validate a proposed time block against real delegated academic conflicts and, when the block lies inside a delegated Gapwise gap, the authoritative primary activity envelope and route availability. Reserved assessment placeholders are not conflicts. A proposed location is echoed but not route-validated, so use route_between_utm_buildings for location-specific travel claims.",
        inputSchema: z
          .object({
            scope: decisionScopeSchema,
            startTime: minute,
            endTime: minute,
            locationBuildingCode: z.string().min(1).max(240).nullable().optional(),
            locationRoom: z.string().min(1).max(240).nullable().optional(),
          })
          .strict()
          .refine((value) => value.endTime > value.startTime, {
            message: "endTime must be after startTime",
          }),
        outputSchema: PlanFeasibilityOutputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = checkPlanFeasibility(snapshot, args);
          return ok(formatPlanFeasibility(value), value);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "update_gap_preferences",
      {
        title: "Update delegated Gapwise gap preferences",
        description:
          "Queue a bounded partial update to Gapwise gap-planning preferences. Requires explicit preference-write permission and the current snapshot revision. This is the only current private write tool; Personal Item writes are retired.",
        inputSchema: z
          .object({
            expectedRevision: revision,
            patch: GapPreferencesPatchSchema,
            idempotencyKey,
          })
          .strict(),
        outputSchema: QueueActionOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: OPENAI_TOOL_META,
      },
      async ({ expectedRevision, patch, idempotencyKey: key }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const result = await queueAction(
            caller,
            { schemaVersion: 1, kind: "update_gap_preferences", expectedRevision, patch },
            key,
          );
          return ok(`Gap preference change is ${result.status} for Gapwise.`, result);
        } catch (error) {
          return failure(error);
        }
      },
    );

    installToolSecuritySchemeProjection(server);
  },
  {
    serverInfo: { name: "gapwise-ai", version: "0.4.0" },
    capabilities: { tools: {} },
    instructions:
      "Treat Gapwise as source-backed UTM student context, not as a generic calendar. For an exact course/class/building reference, search first instead of guessing: use search_my_schedule for delegated classes and search_utm_buildings for campus places, then use get_my_course_context/get_utm_building when deeper context is needed. For date-specific questions use get_my_day or get_my_schedule_range; for a generic term view use get_my_week. RES/isReservedAssessmentWindow entries are recurring ACORN assessment placeholders: never call them weekly classes, never count them as hard commitments, never let them block availability, and never route to them unless the user separately provides a confirmed assessment occurrence. A normal academic meeting whose locationType is tba is still a real commitment and must block time; only its location is unresolved. For broad planning start with get_my_decision_context. For usable time use find_my_available_windows or find_my_weekly_opportunities rather than doing free-time subtraction yourself. Validate exact proposed intervals with check_my_plan_feasibility. Preserve Gapwise route status, confidence, activity budget, leave-by time and warnings exactly; use route_between_utm_buildings for location-specific route claims and do not turn approximate/unavailable routes into certainty. Personal Items are retired: do not ask to create, edit, delete, read, or plan around them. Academic schedule data is read-only. The only current private write is update_gap_preferences, which requires explicit permission and the current revision. Do not invent missing classes, course matches, rooms, buildings, routes, availability, assessment dates, or permissions. If a search/context tool reports ambiguity or no match, surface that uncertainty and ask for disambiguation only when needed. Read-tool text contains essential facts for clients that do not expose structuredContent; structured content is authoritative and includes snapshot revision/freshness context.",
    verboseLogs: false,
  },
);

const authenticated = withMcpAuth(handler, verifyMcpToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authenticated as GET, authenticated as POST };