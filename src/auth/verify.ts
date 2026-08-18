import type { AuthInfo } from "@modelcontextprotocol/server";
import { canonicalMcpResourceUrl, getRuntimeConfig } from "@/src/config";

export type VerifiedCaller = {
  userId: string;
  accessToken: string;
  expiresAt: number;
};

type JwtClaims = {
  aud?: unknown;
  client_id?: unknown;
  exp?: unknown;
  resource?: unknown;
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

export function oauthClientIdFromAccessToken(token: string): string | null {
  const value = jwtClaims(token)?.client_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function accessTokenTargetsResource(token: string, expectedResource: string): boolean {
  const claims = jwtClaims(token);
  if (!claims) return false;
  return (
    claimContains(claims.resource, expectedResource) ||
    claimContains(claims.aud, expectedResource)
  );
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
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const caller = await verifySupabaseAccessToken(bearerToken);
  if (!caller) return undefined;

  // MCP access must come from a Supabase OAuth client token. Ordinary Gapwise
  // browser sessions use the browser delegation API and do not carry client_id.
  const clientId = oauthClientIdFromAccessToken(bearerToken);
  if (!clientId) return undefined;

  // Bind OAuth bearer tokens to this exact MCP protected resource. Supabase's
  // normal user-session audience remains untouched; OAuth issuance adds the
  // canonical resource claim through the custom access-token hook.
  const config = getRuntimeConfig();
  const expectedResource = canonicalMcpResourceUrl(request.url, config.aiOrigin);
  if (!accessTokenTargetsResource(bearerToken, expectedResource)) return undefined;

  return {
    token: bearerToken,
    clientId,
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
