import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getRuntimeConfig, supabaseIssuer } from "@/src/config";

export const dynamic = "force-dynamic";

const CANONICAL_AI_ORIGIN = "https://ai.gapwise.ca";
const PRODUCTION_HOSTS = new Set(["ai.gapwise.ca", "gapwise-ai.vercel.app"]);

function protectedResourceUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  const configuredOrigin = getRuntimeConfig().aiOrigin;
  const origin =
    configuredOrigin ??
    (PRODUCTION_HOSTS.has(requestUrl.hostname) ? CANONICAL_AI_ORIGIN : requestUrl.origin);
  return new URL("/api/mcp", origin).toString();
}

export async function GET(request: Request) {
  // RFC 9728 identifies the protected resource itself, not this metadata route.
  // Production aliases deliberately converge on the first-party Gapwise hostname
  // so OAuth clients never persist a temporary Vercel alias as the resource ID.
  const resourceUrl = protectedResourceUrl(request);
  return protectedResourceHandler({ authServerUrls: [supabaseIssuer()], resourceUrl })(request);
}

export async function OPTIONS() {
  return metadataCorsOptionsRequestHandler()();
}
