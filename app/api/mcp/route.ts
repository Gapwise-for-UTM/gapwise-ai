import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { VerifiedCaller } from "@/src/auth/verify";
import { verifyMcpToken } from "@/src/auth/verify";
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

function callerFromContext(ctx: {
  http?: { authInfo?: { token: string; clientId: string; expiresAt?: number } };
}): VerifiedCaller {
  const auth = ctx.http?.authInfo;
  if (!auth?.token || !auth.clientId || !auth.expiresAt) {
    throw new Error("Authenticated caller context is missing.");
  }
  return { userId: auth.clientId, accessToken: auth.token, expiresAt: auth.expiresAt };
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
      },
      async (_args, ctx) => {
        try {
          const value = await delegationStatus(callerFromContext(ctx));
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
          "Return exact source-backed academic meetings plus explicitly delegated personal timetable items for one calendar date. Never guesses missing meetings or locations. Academic meetings are read-only.",
        inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ date }, ctx) => {
        try {
          const snapshot = await readSnapshot(callerFromContext(ctx));
          const value = daySchedule(snapshot, date);
          return ok(
            `Gapwise returned ${value.meetings.length} academic meeting(s) and ${value.personalItems.length} delegated personal item(s) for ${date}.`,
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
          "Return the compact normalized Gapwise timetable for one academic term, including delegated personal items when permitted. Academic meetings remain source-backed and read-only.",
        inputSchema: z.object({ term: TermSchema }).strict(),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ term }, ctx) => {
        try {
          const snapshot = await readSnapshot(callerFromContext(ctx));
          const value = weekSchedule(snapshot, term);
          return ok(
            `Gapwise returned ${value.meetings.length} academic meeting(s) and ${value.personalItems.length} delegated personal item(s) for ${term}.`,
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
        title: "Get my Gapwise gap context",
        description:
          "Return the exact delegated schedule boundaries and planning preferences for a requested gap. Until Gapwise's deterministic public routing API is connected, route-dependent usable-time and leave-by fields are explicitly null rather than invented.",
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
      },
      async (args, ctx) => {
        try {
          const snapshot = await readSnapshot(callerFromContext(ctx));
          const value = gapContext(snapshot, args);
          return ok(
            "Gapwise returned exact schedule boundaries and preferences. Routing-dependent advice is unavailable until the shared deterministic Gapwise API is connected.",
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
      },
      async (_args, ctx) => {
        try {
          const snapshot = await readSnapshot(callerFromContext(ctx));
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
      },
      async ({ expectedRevision, item, idempotencyKey: key }, ctx) => {
        try {
          const result = await queueAction(
            callerFromContext(ctx),
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
      },
      async ({ expectedRevision, itemId, patch, idempotencyKey: key }, ctx) => {
        try {
          const result = await queueAction(
            callerFromContext(ctx),
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
      },
      async ({ expectedRevision, itemId, idempotencyKey: key }, ctx) => {
        try {
          const result = await queueAction(
            callerFromContext(ctx),
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
      },
      async ({ expectedRevision, patch, idempotencyKey: key }, ctx) => {
        try {
          const result = await queueAction(
            callerFromContext(ctx),
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
      "Use Gapwise tools as the source of truth for the user's delegated timetable. Never invent missing classes, rooms, routes, or write permissions. Academic meetings are read-only. After a write is queued, read again before making dependent changes because Gapwise applies queued actions against revisions.",
    verboseLogs: false,
  },
);

// Supabase OAuth currently exposes only standard scopes (openid/email/profile/phone),
// so Gapwise's fine-grained permissions live in the encrypted delegation snapshot instead
// of pretending a custom `gapwise:ai` OAuth scope exists.
const authenticated = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authenticated as GET, authenticated as POST };
