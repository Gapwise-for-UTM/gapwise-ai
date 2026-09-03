import type { McpServer } from "@modelcontextprotocol/server";
import {
  createMcpHandler as createBaseMcpHandler,
  type McpHandlerOptions,
} from "mcp-handler";
import { installToolAuditRegistration } from "@/src/audit/tool-registration";
import { registerPublicCampusTools } from "@/src/mcp/public-campus-tools";

type InitializeServer = (server: McpServer) => void | Promise<void>;

/**
 * Gapwise AI's MCP handler factory. It installs the metadata-only tool audit
 * boundary, registers the stateless public UTM campus-intelligence surface,
 * then delegates to the caller for permissioned/private tool registration.
 *
 * Public campus tools carry no OAuth security metadata and never read private
 * Gapwise state. Private tools remain responsible for their explicit OAuth
 * metadata and caller checks.
 */
export function createMcpHandler(
  initializeServer: InitializeServer,
  options: McpHandlerOptions = {},
) {
  return createBaseMcpHandler((server) => {
    installToolAuditRegistration(server);
    registerPublicCampusTools(server);
    return initializeServer(server);
  }, options);
}
