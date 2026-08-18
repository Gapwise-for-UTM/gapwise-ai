import { authenticateRequest } from "@/src/auth/verify";
import { getRuntimeConfig } from "@/src/config";
import { DelegationError } from "@/src/delegation/service";

const MAX_JSON_BYTES = 1024 * 1024;

function allowedOrigin(request: Request): string | null | false {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const config = getRuntimeConfig();
  return origin === config.gapwiseAppOrigin ? origin : false;
}

export function corsHeaders(request: Request): Headers | null {
  const origin = allowedOrigin(request);
  if (origin === false) return null;
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return headers;
}

export function optionsResponse(request: Request, methods: string[]): Response {
  const headers = corsHeaders(request);
  if (!headers) return new Response(null, { status: 403 });
  headers.set("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
  headers.set("Access-Control-Max-Age", "600");
  return new Response(null, { status: 204, headers });
}

export function jsonResponse(request: Request, value: unknown, status = 200): Response {
  const headers = corsHeaders(request);
  if (!headers) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers });
}

export async function readJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_JSON_BYTES) throw new Error("request_too_large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error("request_too_large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

export async function browserCaller(request: Request) {
  const headers = corsHeaders(request);
  if (!headers) return { response: Response.json({ error: "origin_not_allowed" }, { status: 403 }) } as const;
  const caller = await authenticateRequest(request);
  if (!caller) return { response: jsonResponse(request, { error: "unauthorized" }, 401) } as const;
  return { caller } as const;
}

export function apiError(request: Request, error: unknown): Response {
  if (error instanceof DelegationError) {
    const status =
      error.code === "not_enabled" || error.code === "not_found"
        ? 404
        : error.code === "forbidden"
          ? 403
          : error.code === "conflict"
            ? 409
            : error.code === "too_many_actions"
              ? 429
              : 400;
    return jsonResponse(request, { error: error.code, message: error.message }, status);
  }
  if (error instanceof Error && error.message === "request_too_large") {
    return jsonResponse(request, { error: "request_too_large" }, 413);
  }
  if (error instanceof Error && error.message === "invalid_json") {
    return jsonResponse(request, { error: "invalid_json" }, 400);
  }
  return jsonResponse(request, { error: "internal_error" }, 500);
}
