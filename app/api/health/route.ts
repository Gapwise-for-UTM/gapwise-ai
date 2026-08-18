import { getRuntimeConfig, runtimeConfigStatus } from "@/src/config";
import { parseDataKey } from "@/src/crypto/envelope";

export async function GET() {
  const status = runtimeConfigStatus();
  if (!status.configured) {
    return Response.json(
      { status: "misconfigured", configured: false, missing: status.missing },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    parseDataKey(getRuntimeConfig().aiDataKey);
  } catch {
    return Response.json(
      { status: "misconfigured", configured: false, error: "invalid_encryption_key" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { status: "ok", configured: true, service: "gapwise-ai", protocol: "mcp-streamable-http" },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
