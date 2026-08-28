import { describe, expect, it, vi } from "vitest";
import {
  auditToolInvocation,
  buildToolAuditEvent,
  emitToolAuditEvent,
  TOOL_AUDIT_EVENT_TYPE,
} from "@/src/audit/tool-audit";

describe("privacy-preserving MCP tool audit events", () => {
  it("emits only the allowlisted metadata shape", () => {
    const callerWithForbiddenExtras = {
      userId: "3f3354ec-f8d7-4d4c-9b63-b8c46df53659",
      clientId: "chatgpt-gapwise",
      accessToken: "secret-bearer-token",
      args: { date: "2026-09-04", course: "CSC110" },
      structuredContent: { timetable: "private" },
      prompt: "private conversation text",
    };

    const event = buildToolAuditEvent(
      "get_my_day",
      "success",
      callerWithForbiddenExtras as Parameters<typeof buildToolAuditEvent>[2],
    );

    expect(Object.keys(event).sort()).toEqual(
      ["callerRef", "clientId", "event", "outcome", "tool"].sort(),
    );
    expect(event).toEqual({
      event: TOOL_AUDIT_EVENT_TYPE,
      tool: "get_my_day",
      callerRef: expect.stringMatching(/^[a-f0-9]{24}$/u),
      clientId: "chatgpt-gapwise",
      outcome: "success",
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(callerWithForbiddenExtras.userId);
    expect(serialized).not.toContain(callerWithForbiddenExtras.accessToken);
    expect(serialized).not.toContain("2026-09-04");
    expect(serialized).not.toContain("CSC110");
    expect(serialized).not.toContain("private");
  });

  it("uses a stable pseudonymous caller reference without retaining raw user identity", () => {
    const first = buildToolAuditEvent("get_my_week", "success", {
      userId: "user-a-high-entropy-id",
      clientId: "client-a",
    });
    const retry = buildToolAuditEvent("get_my_week", "delegation_error", {
      userId: "user-a-high-entropy-id",
      clientId: "client-a",
    });
    const other = buildToolAuditEvent("get_my_week", "success", {
      userId: "user-b-high-entropy-id",
      clientId: "client-a",
    });

    expect(first.callerRef).toBe(retry.callerRef);
    expect(first.callerRef).not.toBe(other.callerRef);
    expect(first.callerRef).not.toContain("user-a-high-entropy-id");
  });

  it("keeps unauthenticated audit events free of caller and OAuth metadata", () => {
    expect(buildToolAuditEvent("get_my_day", "auth_required")).toEqual({
      event: TOOL_AUDIT_EVENT_TYPE,
      tool: "get_my_day",
      callerRef: null,
      clientId: null,
      outcome: "auth_required",
    });
  });

  it("never lets an observability failure break the caller path", () => {
    const throwingSink = vi.fn(() => {
      throw new Error("logging unavailable");
    });
    const event = buildToolAuditEvent("update_gap_preferences", "success", {
      userId: "user-a",
      clientId: "client-a",
    });

    expect(() => emitToolAuditEvent(event, throwingSink)).not.toThrow();
    expect(throwingSink).toHaveBeenCalledOnce();
  });

  it("passes the constructed allowlisted event to the configured sink", () => {
    const sink = vi.fn();
    auditToolInvocation(
      "delete_personal_item",
      "delegation_error",
      { userId: "user-a", clientId: "client-a" },
      sink,
    );

    expect(sink).toHaveBeenCalledWith({
      event: TOOL_AUDIT_EVENT_TYPE,
      tool: "delete_personal_item",
      callerRef: expect.stringMatching(/^[a-f0-9]{24}$/u),
      clientId: "client-a",
      outcome: "delegation_error",
    });
  });
});
