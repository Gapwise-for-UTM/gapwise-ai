import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { canonicalMcpResourceUrl, getRuntimeConfig, supabaseIssuer } from "@/src/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // RFC 9728 identifies the protected resource itself, not this metadata route.
  // Production aliases deliberately converge on the first-party Gapwise hostname
  // so OAuth clients never persist a temporary Vercel alias as the resource ID.
  const config = getRuntimeConfig();
  const resourceUrl = canonicalMcpResourceUrl(request.url, config.aiOrigin);
  return protectedResourceHandler({ authServerUrls: [supabaseIssuer(config)], resourceUrl })(request);
}

export async function OPTIONS() {
  return metadataCorsOptionsRequestHandler()();
}
