# Client setup (after deployment)

## Claude
Add the production MCP URL as a custom connector in Claude Settings → Connectors. Authenticate when prompted. Claude supports remote Streamable HTTP MCP and OAuth; users can enable/disable individual tools.

## ChatGPT
Create a custom MCP app in developer mode using the production MCP endpoint and OAuth authentication where the user's ChatGPT plan/workspace supports it. Scan tools after authentication, then test read and write tools separately.

## Other clients
Use the same Streamable HTTP endpoint. Do not create provider-specific servers unless a client has a standards incompatibility that cannot be solved with metadata/configuration alone.
