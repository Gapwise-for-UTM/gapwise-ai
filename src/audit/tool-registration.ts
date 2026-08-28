import type { McpServer } from "@modelcontextprotocol/server";
import {
  auditToolInvocation,
  type AuditSink,
  type CallerMetadata,
  type ToolAuditOutcome,
} from "@/src/audit/tool-audit";

type AuditAuthInfo = {
  token?: unknown;
  clientId?: unknown;
  expiresAt?: unknown;
  extra?: Record<string, unknown>;
};

type AuditToolContext = {
  http?: {
    authInfo?: AuditAuthInfo;
  };
};

type ToolHandler = (args: unknown, context: AuditToolContext) => unknown | Promise<unknown>;
type RegisterTool = (name: string, config: unknown, callback: ToolHandler) => unknown;

type ToolResultLike = {
  isError?: unknown;
  structuredContent?: unknown;
};

function callerMetadataFromContext(context: AuditToolContext): CallerMetadata | null {
  const auth = context.http?.authInfo;
  const userId = auth?.extra?.["userId"];
  if (
    typeof auth?.token !== "string" ||
    typeof auth.expiresAt !== "number" ||
    typeof userId !== "string"
  ) {
    return null;
  }

  return {
    userId,
    clientId: typeof auth.clientId === "string" ? auth.clientId : null,
  };
}

function resultOutcome(result: unknown): ToolAuditOutcome {
  if (!result || typeof result !== "object") return "success";

  const value = result as ToolResultLike;
  if (value.isError !== true) return "success";

  const structured =
    value.structuredContent && typeof value.structuredContent === "object"
      ? (value.structuredContent as Record<string, unknown>)
      : null;
  const error = structured?.["error"];

  if (error === "authentication_required") return "auth_required";
  if (error === "internal_error") return "internal_error";
  return "delegation_error";
}

/**
 * Wrap every subsequently registered MCP tool with one metadata-only audit boundary.
 * The wrapper never reads tool arguments or response content beyond the coarse error
 * discriminator needed to classify the outcome.
 */
export function installToolAuditRegistration(server: McpServer, sink?: AuditSink): void {
  const mutableServer = server as unknown as { registerTool: RegisterTool };
  const registerTool = mutableServer.registerTool.bind(server);

  mutableServer.registerTool = (name, config, callback) =>
    registerTool(name, config, async (args, context) => {
      const caller = callerMetadataFromContext(context);
      try {
        const result = await callback(args, context);
        auditToolInvocation(name, resultOutcome(result), caller, sink);
        return result;
      } catch (error) {
        auditToolInvocation(name, "internal_error", caller, sink);
        throw error;
      }
    });
}
