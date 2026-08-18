import type { AuthInfo } from "@modelcontextprotocol/server";
import { getRuntimeConfig } from "@/src/config";

export type VerifiedCaller = {
  userId: string;
  accessToken: string;
  expiresAt: number;
};

type JwtClaims = {
  client_id?: unknown;
  exp?: unknown;
  sub?: unknown;
};

function jwtClaims(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessToken(token: string): Promise<VerifiedCaller | null> {
  if (!token || token.length > 16_384) return null;
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/iu.test(body.id)) return null;

  // Claims are read only after Supabase has accepted the token above.
  const claims = jwtClaims(token);
  const expiresAt = claims?.exp;
  if (!Number.isSafeInteger(expiresAt) || (expiresAt as number) <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  if (typeof claims?.sub === "string" && claims.sub !== body.id) return null;

  return { userId: body.id, accessToken: token, expiresAt: expiresAt as number };
}

export async function verifyMcpToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const caller = await verifySupabaseAccessToken(bearerToken);
  if (!caller) return undefined;

  // MCP access must come from a Supabase OAuth client token. Ordinary Gapwise
  // browser sessions use the browser delegation API and do not carry client_id.
  const claims = jwtClaims(bearerToken);
  if (typeof claims?.client_id !== "string" || claims.client_id.length < 1) return undefined;

  return {
    token: bearerToken,
    clientId: claims.client_id,
    scopes: [],
    expiresAt: caller.expiresAt,
    extra: { userId: caller.userId },
  };
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([^\s]+)$/u.exec(header);
  return match?.[1] ?? null;
}

export async function authenticateRequest(request: Request): Promise<VerifiedCaller | null> {
  const token = bearerFromRequest(request);
  return token ? verifySupabaseAccessToken(token) : null;
}
