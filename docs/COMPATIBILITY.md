# Client compatibility target

The service targets one standards-oriented remote MCP endpoint.

| Client | Target transport | Auth | Writes |
|---|---|---|---|
| ChatGPT | Streamable HTTP | OAuth | Where the user's ChatGPT plan/workspace permits custom MCP write actions |
| Claude / Claude Desktop | Streamable HTTP | OAuth | Supported by remote connector tool calls subject to Claude approval/settings |
| Claude mobile | Existing remote connector | OAuth | Uses connectors previously added through Claude web/desktop |
| Other MCP clients | Streamable HTTP | OAuth or standards-compatible bearer flow | Depends on client |

No provider-specific database or scheduling logic is allowed. Compatibility adapters may alter metadata/configuration only.
