import type { AuthInfo } from "@modelcontextprotocol/server";
import { getRuntimeConfig, supabaseIssuer } from "@/src/config";
import { MCP_REQUIRED_SCOPES, MCP_RESOURCE_URL } from "@/src/auth/mcp";

export type VerifiedCaller = {
  userId: string;
  accessToken: string;
  expiresAt: number;
};

type JwtClaims = {
  aud?: unknown;
  client_id?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
  scope?: unknown;
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

function claimContains(value: unknown, expected: string): boolean {
  if (typeof value === "string") return value === expected;
  return Array.isArray(value) && value.some((item) => item === expected);
}

function oauthScopes(value: unknown): string[] {
  if (typeof value === "string") {
    return [...new Set(value.split(/\s+/u).map((scope) => scope.trim()).filter(Boolean))];
  }
  if (Array.isArray(value)) {
    return [
      ...new Set(value.filter((scope): scope is string => typeof scope === "string" && scope.length > 0)),
    ];
  }
  return [];
}

export function oauthClientIdFromAccessToken(token: string): string | null {
  const value = jwtClaims(token)?.client_id;
  return typeof value === "string" && value.length > 0 ? value : null;
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

  // Supabase's user endpoint validates the token cryptographically. We then
  // enforce resource-server claims independently instead of trusting decoded
  // JWT payload data on its own.
  const claims = jwtClaims(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = claims?.exp;
  if (claims?.iss !== supabaseIssuer(config)) return null;
  if (!Number.isSafeInteger(expiresAt) || (expiresAt as number) <= now) return null;
  if (claims?.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || (claims.nbf as number) > now)) {
    return null;
  }
  if (typeof claims?.sub !== "string" || claims.sub !== body.id) return null;

  return { userId: body.id, accessToken: token, expiresAt: expiresAt as number };
}

export async function verifyMcpToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const caller = await verifySupabaseAccessToken(bearerToken);
  if (!caller) return undefined;

  // MCP access must come from a Supabase OAuth-client token. Ordinary Gapwise
  // browser sessions use the browser delegation API and do not carry client_id.
  const claims = jwtClaims(bearerToken);
  const clientId = oauthClientIdFromAccessToken(bearerToken);
  if (!clientId || !claims) return undefined;

  // The Supabase custom access-token hook replaces the OAuth token audience
  // with the exact protected MCP resource only for an approved user/client pair.
  // Missing/wrong audiences therefore fail closed before any tool runs.
  if (!claimContains(claims.aud, MCP_RESOURCE_URL)) return undefined;

  const scopes = oauthScopes(claims.scope);
  if (!MCP_REQUIRED_SCOPES.every((scope) => scopes.includes(scope))) return undefined;

  return {
    token: bearerToken,
    clientId,
    scopes,
    expiresAt: caller.expiresAt,
    extra: { userId: caller.userId },
  };
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/iu.exec(header);
  return match?.[1] ?? null;
}

export async function authenticateRequest(request: Request): Promise<VerifiedCaller | null> {
  const token = bearerFromRequest(request);
  return token ? verifySupabaseAccessToken(token) : null;
}
