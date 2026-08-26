import { createMcpHandler, withMcpAuth } from "mcp-handler";
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
  checkPlanFeasibility,
  decisionContext,
  findAvailableWindows,
} from "@/src/domain/decision";
import {
  GapPreferencesPatchSchema,
  PersonalItemDraftSchema,
  PersonalItemPatchSchema,
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
          "Check whether this Gapwise account has explicitly enabled AI access and see the current revision and permissions. Does not return timetable content.",
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
          "Return exact source-backed academic meetings, explicitly delegated personal items, and deterministic Gapwise gap assessments for one calendar date when those permissions are enabled. The text result contains the actual meeting/course/section/time/location facts as well as structured output. Never guesses missing meetings, locations, routes, or gap recommendations. Academic meetings are read-only.",
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
          "Return the normalized Gapwise timetable for one academic term plus deterministic Gapwise gap assessments and delegated personal items when permitted. The text result itemizes the actual course codes, sections, times and locations so MCP clients that do not surface structuredContent still receive the timetable. Academic meetings remain source-backed and read-only.",
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
      "get_my_gap_plan",
      {
        title: "Get my Gapwise gap plan",
        description:
          "Return Gapwise's precomputed deterministic assessment for an exact delegated gap when gap-plan sharing is enabled. The text result includes the actual boundaries, recommendation, route status/confidence, travel/buffer time, leave-by/arrival time and shared preferences as well as structured output. If no matching delegated plan exists, say so rather than inventing one.",
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
          "Return only planning/routing preferences the user explicitly allowed Gapwise to share with AI. The readable text and structured output contain the same permission-filtered facts.",
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
          "Return a compact planning-oriented summary for one term: hard schedule load, delegated fixed personal constraints, authoritative Gapwise gap opportunities, route uncertainty, freshness/revision, and any delegated planning/routing preferences. Use this before broad planning questions instead of repeatedly re-reading the entire timetable or inventing availability arithmetic.",
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
          "Find source-backed free windows on one date or one term weekday using delegated academic meetings and, when permitted, fixed personal items as hard constraints. Flexible personal items are returned as soft competing constraints. With no explicit search bounds, Gapwise only returns windows between delegated hard events and does not assume wake/sleep or free time outside the scheduled day. Use this instead of calculating free time yourself.",
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
          "Search all seven weekdays for usable planning opportunities in one academic term. This is Gapwise-aware: a raw free gap is capped by the delegated deterministic Gapwise activity budget, and a gap whose surrounding route is unavailable contributes zero validated activity minutes. Results without a delegated gap assessment are explicitly temporal-only. Use this for requests like 'find 90-minute study windows this week' instead of calling every weekday or doing timetable arithmetic yourself.",
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
          "Validate a proposed personal time block against delegated hard timetable conflicts and, when the block lies inside a delegated Gapwise gap, the authoritative primary activity envelope and route availability. This is read-only and does not create anything. A proposed location is echoed but not route-validated by this tool, so never claim arbitrary-location travel safety from this result alone. Call this before proposing a concrete personal block.",
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
      "create_personal_item",
      {
        title: "Create a personal Gapwise timetable item",
        description:
          "Queue creation of a personal timetable item in Gapwise. Requires explicit write permission and the current snapshot revision. Academic classes cannot be created or modified. Fixed-item writes are independently revalidated at the service layer against delegated hard conflicts and known Gapwise transition/activity-envelope violations even if a client skipped the read-only feasibility tool.",
        inputSchema: z
          .object({ expectedRevision: revision, item: PersonalItemDraftSchema, idempotencyKey })
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
      async ({ expectedRevision, item, idempotencyKey: key }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const result = await queueAction(
            caller,
            { schemaVersion: 1, kind: "create_personal_item", expectedRevision, item },
            key,
          );
          return ok(`Personal timetable item change is ${result.status} for Gapwise.`, result);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "update_personal_item",
      {
        title: "Update a personal Gapwise timetable item",
        description:
          "Queue changes to an existing delegated personal timetable item by stable ID. Requires explicit write permission and a current revision. Academic classes cannot be targeted. Any resulting fixed-item schedule is independently checked for delegated hard conflicts and known Gapwise transition/activity-envelope violations before queueing.",
        inputSchema: z
          .object({
            expectedRevision: revision,
            itemId: z.string().min(1).max(240),
            patch: PersonalItemPatchSchema,
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
      async ({ expectedRevision, itemId, patch, idempotencyKey: key }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const result = await queueAction(
            caller,
            { schemaVersion: 1, kind: "update_personal_item", expectedRevision, itemId, patch },
            key,
          );
          return ok(`Personal timetable item change is ${result.status} for Gapwise.`, result);
        } catch (error) {
          return failure(error);
        }
      },
    );

    server.registerTool(
      "delete_personal_item",
      {
        title: "Delete a personal Gapwise timetable item",
        description:
          "Queue deletion of an existing delegated personal timetable item. This is destructive and requires explicit write permission plus the current snapshot revision. Academic classes cannot be targeted.",
        inputSchema: z
          .object({
            expectedRevision: revision,
            itemId: z.string().min(1).max(240),
            idempotencyKey,
          })
          .strict(),
        outputSchema: QueueActionOutputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: OPENAI_TOOL_META,
      },
      async ({ expectedRevision, itemId, idempotencyKey: key }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const result = await queueAction(
            caller,
            { schemaVersion: 1, kind: "delete_personal_item", expectedRevision, itemId },
            key,
          );
          return ok(`Personal timetable item deletion is ${result.status} for Gapwise.`, result);
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
          "Queue a bounded partial update to Gapwise gap-planning preferences. Requires explicit preference-write permission and the current snapshot revision.",
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
    serverInfo: { name: "gapwise-ai", version: "0.3.0" },
    capabilities: { tools: {} },
    instructions:
      "Use Gapwise tools as the source of truth for the user's delegated timetable, availability and deterministic gap assessments. For broad planning questions, start with get_my_decision_context. For requests to find a usable block across the whole academic week, use find_my_weekly_opportunities; for one date/weekday use find_my_available_windows. Do not do free-time subtraction yourself. Before proposing a concrete personal block, use check_my_plan_feasibility on the exact interval. Fixed personal-item writes are also semantically revalidated server-side, so never bypass or argue with a conflict/transition rejection. Read-tool text content deliberately includes essential structured facts for cross-client compatibility. Never invent missing classes, rooms, routes, availability, gap-plan facts, or write permissions. Academic meetings are read-only. When a delegated deterministic gap assessment exists, preserve its route status/confidence and treat its travel/buffer/leave-by/recommendation/activity-budget fields as authoritative Gapwise output. check_my_plan_feasibility does not validate arbitrary proposed locations, so do not claim location-specific route safety from it. After a write is queued, read again before making dependent changes because Gapwise applies queued actions against revisions.",
    verboseLogs: false,
  },
);

const authenticated = withMcpAuth(handler, verifyMcpToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authenticated as GET, authenticated as POST };
