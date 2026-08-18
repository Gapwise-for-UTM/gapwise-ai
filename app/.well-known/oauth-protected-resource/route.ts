import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { supabaseIssuer } from "@/src/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // RFC 9728 identifies the protected resource itself, not the metadata route.
  // Construct the MCP URL explicitly so proxy/share query parameters can never
  // leak into OAuth resource metadata.
  const resourceUrl = new URL("/api/mcp", request.url).toString();
  return protectedResourceHandler({ authServerUrls: [supabaseIssuer()], resourceUrl })(request);
}

export async function OPTIONS() {
  return metadataCorsOptionsRequestHandler()();
}
