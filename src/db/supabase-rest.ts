import { getRuntimeConfig } from "@/src/config";
import type { VerifiedCaller } from "@/src/auth/verify";

export type DelegationRow = {
  user_id: string;
  enabled: boolean;
  revision: number;
  permissions: unknown;
  snapshot_schema_version: number;
  crypto_version: number;
  snapshot_ciphertext: string;
  snapshot_nonce: string;
  created_at: string;
  updated_at: string;
};

export type ActionRow = {
  id: string;
  user_id: string;
  idempotency_key: string;
  expected_revision: number;
  action_schema_version: number;
  crypto_version: number;
  action_ciphertext: string;
  action_nonce: string;
  status: "queued" | "applied" | "rejected";
  result_code: string | null;
  created_at: string;
  completed_at: string | null;
};

export class RestRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Supabase request failed with status ${status}.`);
  }
}

async function rest<T>(caller: VerifiedCaller, path: string, init: RequestInit = {}): Promise<T> {
  const config = getRuntimeConfig();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${caller.accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new RestRequestError(response.status);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const ownerFilter = (userId: string) => `user_id=eq.${encodeURIComponent(userId)}`;

export async function getDelegation(caller: VerifiedCaller): Promise<DelegationRow | null> {
  const rows = await rest<DelegationRow[]>(
    caller,
    `ai_delegations?select=*&${ownerFilter(caller.userId)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function insertDelegation(
  caller: VerifiedCaller,
  row: Omit<DelegationRow, "created_at" | "updated_at">,
): Promise<DelegationRow> {
  const rows = await rest<DelegationRow[]>(caller, "ai_delegations?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!rows[0]) throw new Error("Delegation insert returned no row.");
  return rows[0];
}

export async function updateDelegationCas(
  caller: VerifiedCaller,
  expectedRevision: number,
  patch: Partial<Pick<DelegationRow, "enabled" | "revision" | "permissions" | "snapshot_schema_version" | "crypto_version" | "snapshot_ciphertext" | "snapshot_nonce">>,
): Promise<DelegationRow | null> {
  const rows = await rest<DelegationRow[]>(
    caller,
    `ai_delegations?select=*&${ownerFilter(caller.userId)}&revision=eq.${expectedRevision}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );
  return rows[0] ?? null;
}

export async function deleteDelegation(caller: VerifiedCaller): Promise<void> {
  await rest<void>(caller, `ai_delegations?${ownerFilter(caller.userId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function deleteAllActions(caller: VerifiedCaller): Promise<void> {
  await rest<void>(caller, `ai_pending_actions?${ownerFilter(caller.userId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function insertAction(
  caller: VerifiedCaller,
  row: Omit<ActionRow, "id" | "created_at" | "completed_at" | "result_code">,
): Promise<ActionRow> {
  const rows = await rest<ActionRow[]>(caller, "ai_pending_actions?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!rows[0]) throw new Error("Action insert returned no row.");
  return rows[0];
}

export async function getActionByIdempotencyKey(
  caller: VerifiedCaller,
  idempotencyKey: string,
): Promise<ActionRow | null> {
  const rows = await rest<ActionRow[]>(
    caller,
    `ai_pending_actions?select=*&${ownerFilter(caller.userId)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function listQueuedActions(
  caller: VerifiedCaller,
  limit = 50,
): Promise<ActionRow[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  return rest<ActionRow[]>(
    caller,
    `ai_pending_actions?select=*&${ownerFilter(caller.userId)}&status=eq.queued&order=created_at.asc&limit=${safeLimit}`,
  );
}

export async function completeActionRow(
  caller: VerifiedCaller,
  actionId: string,
  status: "applied" | "rejected",
  resultCode: string | null,
): Promise<ActionRow | null> {
  const rows = await rest<ActionRow[]>(
    caller,
    `ai_pending_actions?select=*&${ownerFilter(caller.userId)}&id=eq.${encodeURIComponent(actionId)}&status=eq.queued`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status,
        result_code: resultCode,
        completed_at: new Date().toISOString(),
      }),
    },
  );
  return rows[0] ?? null;
}
