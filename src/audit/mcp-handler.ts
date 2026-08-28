import type { McpServer } from "@modelcontextprotocol/server";
import {
  createMcpHandler as createBaseMcpHandler,
  type McpHandlerOptions,
} from "mcp-handler";
import { installToolAuditRegistration } from "@/src/audit/tool-registration";

type InitializeServer = (server: McpServer) => void | Promise<void>;

/**
 * Gapwise AI's MCP handler factory. It installs the metadata-only tool audit
 * boundary before any live tool is registered, then delegates to mcp-handler.
 */
export function createMcpHandler(
  initializeServer: InitializeServer,
  options: McpHandlerOptions = {},
) {
  return createBaseMcpHandler((server) => {
    installToolAuditRegistration(server);
    return initializeServer(server);
  }, options);
}
