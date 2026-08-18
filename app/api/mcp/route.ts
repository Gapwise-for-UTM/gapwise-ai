import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { VerifiedCaller } from "@/src/auth/verify";
import { verifyMcpToken } from "@/src/auth/verify";
import { mcpAuthenticationRequired, OPENAI_TOOL_META } from "@/src/auth/mcp";
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

const revision = z.number().int().min(1).describe(
  "The current Gapwise AI snapshot revision returned by a read tool.",
);
const idempotencyKey = z
  .string()
  .min(8)
  .max(128)
  .optional()
  .describe("Optional stable retry key. Reuse the same value when retrying the exact same requested change.");

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
          "Return exact source-backed academic meetings, explicitly delegated personal items, and deterministic Gapwise gap assessments for one calendar date when those permissions are enabled. Never guesses missing meetings, locations, routes, or gap recommendations. Academic meetings are read-only.",
        inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ date }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = daySchedule(snapshot, date);
          return ok(
            `Gapwise returned ${value.meetings.length} academic meeting(s), ${value.personalItems.length} delegated personal item(s), and ${value.gapPlans.length} deterministic gap plan(s) for ${date}.`,
            value,
          );
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
          "Return the compact normalized Gapwise timetable for one academic term plus deterministic Gapwise gap assessments and delegated personal items when permitted. Academic meetings remain source-backed and read-only.",
        inputSchema: z.object({ term: TermSchema }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async ({ term }, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = weekSchedule(snapshot, term);
          return ok(
            `Gapwise returned ${value.meetings.length} academic meeting(s), ${value.personalItems.length} delegated personal item(s), and ${value.gapPlans.length} deterministic gap plan(s) for ${term}.`,
            value,
          );
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
          "Return Gapwise's precomputed deterministic assessment for an exact delegated gap when gap-plan sharing is enabled. The assessment preserves Gapwise routing truth, confidence, travel/buffer time, leave-by/arrival time, ranked recommendations, reasons, tags, and timeline. If no matching delegated plan exists, say so rather than inventing one.",
        inputSchema: z
          .object({
            term: TermSchema,
            weekday: WeekdaySchema,
            startTime: z.number().int().min(0).max(1440),
            endTime: z.number().int().min(0).max(1440),
          })
          .strict()
          .refine((value) => value.endTime > value.startTime, {
            message: "endTime must be after startTime",
          }),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: OPENAI_TOOL_META,
      },
      async (args, ctx) => {
        const caller = callerFromContext(ctx);
        if (!caller) return mcpAuthenticationRequired();
        try {
          const snapshot = await readSnapshot(caller);
          const value = gapContext(snapshot, args);
          return ok(
            value.gapPlan
              ? "Gapwise returned its deterministic gap assessment for this exact window. Treat the embedded route status/confidence and recommendation reasons as authoritative Gapwise output."
              : `Gapwise did not return a deterministic assessment for this window (${value.planningStatus}). Do not invent route or usable-time facts.`,
            value,
          );
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
          "Return only planning/routing preferences the user explicitly allowed Gapwise to share with AI.",
        inputSchema: z.object({}).strict(),
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
          return ok("Gapwise returned the currently delegated AI planning preferences.", value);
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
          "Queue creation of a personal timetable item in Gapwise. Requires explicit write permission and the current snapshot revision. This cannot create or modify an ACORN academic class.",
        inputSchema: z
          .object({ expectedRevision: revision, item: PersonalItemDraftSchema, idempotencyKey })
          .strict(),
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
          "Queue changes to an existing delegated personal timetable item by stable ID. Requires explicit write permission and a current revision. Academic classes cannot be targeted.",
        inputSchema: z
          .object({
            expectedRevision: revision,
            itemId: z.string().min(1).max(240),
            patch: PersonalItemPatchSchema,
            idempotencyKey,
          })
          .strict(),
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
          "Queue deletion of an existing delegated personal timetable item. This is destructive and requires explicit write permission plus the current revision. Academic classes cannot be targeted.",
        inputSchema: z
          .object({
            expectedRevision: revision,
            itemId: z.string().min(1).max(240),
            idempotencyKey,
          })
          .strict(),
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
  },
  {
    serverInfo: { name: "gapwise-ai", version: "0.1.0" },
    capabilities: { tools: {} },
    instructions:
      "Use Gapwise tools as the source of truth for the user's delegated timetable and gap assessments. Never invent missing classes, rooms, routes, gap-plan facts, or write permissions. Academic meetings are read-only. When a delegated deterministic gap assessment exists, preserve its route status/confidence and treat its travel/buffer/leave-by/recommendation fields as authoritative Gapwise output. After a write is queued, read again before making dependent changes because Gapwise applies queued actions against revisions.",
    verboseLogs: false,
  },
);

// Keep MCP discovery and tools/list available to unauthenticated clients so
// ChatGPT/Claude can scan the server and discover OAuth metadata. Individual
// tools fail closed with an in-band `mcp/www_authenticate` challenge until a
// valid, resource-bound Supabase OAuth token has been attached by the wrapper.
const authenticated = withMcpAuth(handler, verifyMcpToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authenticated as GET, authenticated as POST };
