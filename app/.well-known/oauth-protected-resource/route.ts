import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { supabaseIssuer } from "@/src/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return protectedResourceHandler({ authServerUrls: [supabaseIssuer()] })(request);
}

export async function OPTIONS() {
  return metadataCorsOptionsRequestHandler()();
}
