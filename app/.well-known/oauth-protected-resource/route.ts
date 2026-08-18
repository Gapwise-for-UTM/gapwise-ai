import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { supabaseIssuer } from "@/src/config";

const handler = protectedResourceHandler({ authServerUrls: [supabaseIssuer()] });
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
