import { createHash } from "node:crypto";

export const TOOL_AUDIT_EVENT_TYPE = "gapwise.mcp.tool" as const;

export type ToolAuditOutcome =
  | "success"
  | "delegation_error"
  | "internal_error"
  | "auth_required";

export type ToolAuditEvent = Readonly<{
  event: typeof TOOL_AUDIT_EVENT_TYPE;
  tool: string;
  callerRef: string | null;
  clientId: string | null;
  outcome: ToolAuditOutcome;
}>;

export type CallerMetadata = {
  userId: string;
  clientId?: string | null;
};

export type AuditSink = (event: ToolAuditEvent) => void | Promise<void>;

function callerReference(userId: string): string {
  return createHash("sha256")
    .update(`gapwise-ai-audit-v1:${userId}`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

export function buildToolAuditEvent(
  tool: string,
  outcome: ToolAuditOutcome,
  caller?: CallerMetadata | null,
): ToolAuditEvent {
  return Object.freeze({
    event: TOOL_AUDIT_EVENT_TYPE,
    tool,
    callerRef: caller ? callerReference(caller.userId) : null,
    clientId: caller?.clientId ?? null,
    outcome,
  });
}

const vercelLogSink: AuditSink = (event) => {
  console.info(event);
};

export function emitToolAuditEvent(event: ToolAuditEvent, sink: AuditSink = vercelLogSink): void {
  try {
    const result = sink(event);
    if (result && typeof result.then === "function") {
      void result.catch(() => {
        // Observability must never become a dependency of a user tool call.
      });
    }
  } catch {
    // Observability must never become a dependency of a user tool call.
  }
}

export function auditToolInvocation(
  tool: string,
  outcome: ToolAuditOutcome,
  caller?: CallerMetadata | null,
  sink?: AuditSink,
): void {
  emitToolAuditEvent(buildToolAuditEvent(tool, outcome, caller), sink);
}
