import type { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import { installToolAuditRegistration } from "@/src/audit/tool-registration";
import type { ToolAuditEvent } from "@/src/audit/tool-audit";

type AuditContext = {
  http?: {
    authInfo?: {
      token?: string;
      clientId?: string;
      expiresAt?: number;
      extra?: Record<string, unknown>;
    };
  };
};

type ToolHandler = (...args: unknown[]) => unknown | Promise<unknown>;
type TestServer = {
  registerTool(name: string, config: unknown, callback: ToolHandler): unknown;
};

const authenticatedContext: AuditContext = {
  http: {
    authInfo: {
      token: "opaque-bearer-token",
      clientId: "chatgpt-gapwise",
      expiresAt: 1_800_000_000,
      extra: { userId: "user-a-high-entropy-id" },
    },
  },
};

function wrappedHandler(
  implementation: ToolHandler,
  sink: (event: ToolAuditEvent) => void,
  config: unknown = { inputSchema: {} },
): ToolHandler {
  let captured: ToolHandler | null = null;
  const server: TestServer = {
    registerTool: vi.fn((_name, _config, callback) => {
      captured = callback;
      return {};
    }),
  };

  installToolAuditRegistration(server as unknown as McpServer, sink);
  server.registerTool("get_my_day", config, implementation);
  expect(captured).not.toBeNull();
  return captured!;
}

describe("MCP tool audit registration", () => {
  it("emits success metadata without retaining arguments or response content", async () => {
    const sink = vi.fn<(event: ToolAuditEvent) => void>();
    const handler = wrappedHandler(
      async (args) => ({
        content: [{ type: "text", text: "private timetable response" }],
        structuredContent: { args, course: "CSC110", date: "2026-09-04" },
      }),
      sink,
    );

    await handler({ course: "CSC110", date: "2026-09-04", token: "secret" }, authenticatedContext);

    expect(sink).toHaveBeenCalledOnce();
    const event = sink.mock.calls[0]![0];
    expect(event).toEqual({
      event: "gapwise.mcp.tool",
      tool: "get_my_day",
      callerRef: expect.stringMatching(/^[a-f0-9]{24}$/u),
      clientId: "chatgpt-gapwise",
      outcome: "success",
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("CSC110");
    expect(serialized).not.toContain("2026-09-04");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("private timetable response");
    expect(serialized).not.toContain("opaque-bearer-token");
    expect(serialized).not.toContain("user-a-high-entropy-id");
  });

  it("preserves the SDK no-input-schema callback form", async () => {
    const sink = vi.fn<(event: ToolAuditEvent) => void>();
    const implementation = vi.fn(async (context: unknown) => ({
      structuredContent: { ok: Boolean((context as AuditContext).http) },
    }));
    const handler = wrappedHandler(implementation, sink, {});

    const result = await handler(authenticatedContext);

    expect(implementation).toHaveBeenCalledOnce();
    expect(implementation).toHaveBeenCalledWith(authenticatedContext);
    expect(result).toEqual({ structuredContent: { ok: true } });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "get_my_day",
        clientId: "chatgpt-gapwise",
        outcome: "success",
      }),
    );
  });

  it("classifies authentication challenges without caller metadata", async () => {
    const sink = vi.fn<(event: ToolAuditEvent) => void>();
    const handler = wrappedHandler(
      async () => ({
        isError: true,
        structuredContent: { error: "authentication_required" },
      }),
      sink,
    );

    await handler({}, {});

    expect(sink).toHaveBeenCalledWith({
      event: "gapwise.mcp.tool",
      tool: "get_my_day",
      callerRef: null,
      clientId: null,
      outcome: "auth_required",
    });
  });

  it("classifies delegated failures without retaining the error payload", async () => {
    const sink = vi.fn<(event: ToolAuditEvent) => void>();
    const handler = wrappedHandler(
      async () => ({
        isError: true,
        structuredContent: {
          error: "permission_denied",
          message: "private failure detail",
        },
      }),
      sink,
    );

    await handler({}, authenticatedContext);

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "delegation_error", clientId: "chatgpt-gapwise" }),
    );
    expect(JSON.stringify(sink.mock.calls[0]![0])).not.toContain("private failure detail");
  });

  it("records uncaught callback failures and preserves the original failure behavior", async () => {
    const sink = vi.fn<(event: ToolAuditEvent) => void>();
    const handler = wrappedHandler(async () => {
      throw new Error("sensitive implementation detail");
    }, sink);

    await expect(handler({}, authenticatedContext)).rejects.toThrow("sensitive implementation detail");
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "internal_error", clientId: "chatgpt-gapwise" }),
    );
    expect(JSON.stringify(sink.mock.calls[0]![0])).not.toContain("sensitive implementation detail");
  });
});
