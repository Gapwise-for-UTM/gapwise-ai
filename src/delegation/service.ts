import { randomUUID } from "node:crypto";
import { getRuntimeConfig } from "@/src/config";
import { decryptJson, encryptJson } from "@/src/crypto/envelope";
import {
  AiActionSchema,
  AiPermissionsSchema,
  AiSnapshotSchema,
  CompleteActionSchema,
  type AiAction,
  type AiSnapshot,
} from "@/src/domain/schemas";
import {
  RestRequestError,
  completeActionRow,
  deleteAllActions,
  deleteDelegation,
  getActionByIdempotencyKey,
  getDelegation,
  insertAction,
  insertDelegation,
  listQueuedActions,
  updateDelegationCas,
} from "@/src/db/supabase-rest";
import type { VerifiedCaller } from "@/src/auth/verify";

export type DelegationErrorCode =
  | "not_enabled"
  | "conflict"
  | "forbidden"
  | "not_found"
  | "too_many_actions"
  | "invalid_data";

export class DelegationError extends Error {
  constructor(
    public readonly code: DelegationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export async function delegationStatus(caller: VerifiedCaller) {
  const row = await getDelegation(caller);
  if (!row || !row.enabled) return { enabled: false as const };
  const permissions = AiPermissionsSchema.safeParse(row.permissions);
  if (!permissions.success) throw new DelegationError("invalid_data", "Stored AI permissions are invalid.");
  return {
    enabled: true as const,
    revision: row.revision,
    permissions: permissions.data,
    updatedAt: row.updated_at,
  };
}

export async function publishSnapshot(caller: VerifiedCaller, value: unknown) {
  const parsed = AiSnapshotSchema.safeParse(value);
  if (!parsed.success) throw new DelegationError("invalid_data", "AI snapshot is invalid.");
  const snapshot = parsed.data;
  const current = await getDelegation(caller);
  const config = getRuntimeConfig();

  if (!current) {
    if (snapshot.revision !== 1) {
      throw new DelegationError("conflict", "The first AI snapshot must use revision 1.");
    }
    const encrypted = encryptJson(config.aiDataKey, "snapshot", caller.userId, 1, snapshot);
    try {
      const row = await insertDelegation(caller, {
        user_id: caller.userId,
        enabled: true,
        revision: 1,
        permissions: snapshot.permissions,
        snapshot_schema_version: 1,
        crypto_version: encrypted.cryptoVersion,
        snapshot_ciphertext: encrypted.ciphertext,
        snapshot_nonce: encrypted.nonce,
      });
      return { enabled: true as const, revision: row.revision, updatedAt: row.updated_at };
    } catch (error) {
      if (error instanceof RestRequestError && error.status === 409) {
        throw new DelegationError("conflict", "AI delegation changed concurrently. Refresh and retry.");
      }
      throw error;
    }
  }

  if (!current.enabled || snapshot.revision !== current.revision + 1) {
    throw new DelegationError(
      "conflict",
      `Expected snapshot revision ${current.revision + 1}. Refresh delegation state before publishing.`,
    );
  }

  const encrypted = encryptJson(
    config.aiDataKey,
    "snapshot",
    caller.userId,
    snapshot.revision,
    snapshot,
  );
  const updated = await updateDelegationCas(caller, current.revision, {
    enabled: true,
    revision: snapshot.revision,
    permissions: snapshot.permissions,
    snapshot_schema_version: 1,
    crypto_version: encrypted.cryptoVersion,
    snapshot_ciphertext: encrypted.ciphertext,
    snapshot_nonce: encrypted.nonce,
  });
  if (!updated) {
    throw new DelegationError("conflict", "AI delegation changed concurrently. Refresh and retry.");
  }
  return { enabled: true as const, revision: updated.revision, updatedAt: updated.updated_at };
}

export async function readSnapshot(caller: VerifiedCaller): Promise<AiSnapshot> {
  const row = await getDelegation(caller);
  if (!row || !row.enabled) throw new DelegationError("not_enabled", "AI access is not enabled in Gapwise.");
  if (row.crypto_version !== 1 || row.snapshot_schema_version !== 1) {
    throw new DelegationError("invalid_data", "Stored AI snapshot version is unsupported.");
  }
  const config = getRuntimeConfig();
  let value: unknown;
  try {
    value = decryptJson(config.aiDataKey, "snapshot", caller.userId, row.revision, {
      ciphertext: row.snapshot_ciphertext,
      nonce: row.snapshot_nonce,
    });
  } catch {
    throw new DelegationError("invalid_data", "Stored AI snapshot could not be authenticated.");
  }
  const parsed = AiSnapshotSchema.safeParse(value);
  if (!parsed.success || parsed.data.revision !== row.revision) {
    throw new DelegationError("invalid_data", "Stored AI snapshot is inconsistent.");
  }
  const storedPermissions = AiPermissionsSchema.safeParse(row.permissions);
  if (!storedPermissions.success || JSON.stringify(storedPermissions.data) !== JSON.stringify(parsed.data.permissions)) {
    throw new DelegationError("invalid_data", "Stored AI permission metadata is inconsistent.");
  }
  return parsed.data;
}

export async function revokeDelegation(caller: VerifiedCaller) {
  await deleteAllActions(caller);
  await deleteDelegation(caller);
  return { enabled: false as const };
}

function requirePermission(snapshot: AiSnapshot, action: AiAction) {
  if (
    (action.kind === "create_personal_item" ||
      action.kind === "update_personal_item" ||
      action.kind === "delete_personal_item") &&
    !snapshot.permissions.writePersonal
  ) {
    throw new DelegationError("forbidden", "Gapwise has not granted AI permission to edit personal items.");
  }
  if (action.kind === "update_gap_preferences" && !snapshot.permissions.writeGapPreferences) {
    throw new DelegationError("forbidden", "Gapwise has not granted AI permission to edit gap preferences.");
  }
  if (
    (action.kind === "update_personal_item" || action.kind === "delete_personal_item") &&
    !snapshot.personalItems.some((item) => item.id === action.itemId)
  ) {
    throw new DelegationError("not_found", "That personal timetable item is not in the delegated snapshot.");
  }
}

export async function queueAction(
  caller: VerifiedCaller,
  value: unknown,
  requestedIdempotencyKey?: string,
) {
  const parsed = AiActionSchema.safeParse(value);
  if (!parsed.success) throw new DelegationError("invalid_data", "AI action is invalid.");
  const action = parsed.data;
  const snapshot = await readSnapshot(caller);
  if (action.expectedRevision !== snapshot.revision) {
    throw new DelegationError(
      "conflict",
      `The timetable changed. Read the current schedule and retry using revision ${snapshot.revision}.`,
    );
  }
  requirePermission(snapshot, action);

  const outstanding = await listQueuedActions(caller, 50);
  if (outstanding.length >= 50) {
    throw new DelegationError("too_many_actions", "Too many AI changes are already waiting for Gapwise.");
  }

  const idempotencyKey = requestedIdempotencyKey?.trim() || randomUUID();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw new DelegationError("invalid_data", "Idempotency key is invalid.");
  }
  const existing = await getActionByIdempotencyKey(caller, idempotencyKey);
  if (existing) {
    return { queued: existing.status === "queued", actionId: existing.id, status: existing.status };
  }

  const config = getRuntimeConfig();
  const encrypted = encryptJson(
    config.aiDataKey,
    "action",
    caller.userId,
    action.expectedRevision,
    action,
  );
  try {
    const row = await insertAction(caller, {
      user_id: caller.userId,
      idempotency_key: idempotencyKey,
      expected_revision: action.expectedRevision,
      action_schema_version: 1,
      crypto_version: encrypted.cryptoVersion,
      action_ciphertext: encrypted.ciphertext,
      action_nonce: encrypted.nonce,
      status: "queued",
    });
    return { queued: true as const, actionId: row.id, status: row.status };
  } catch (error) {
    if (error instanceof RestRequestError && error.status === 409) {
      const duplicate = await getActionByIdempotencyKey(caller, idempotencyKey);
      if (duplicate) {
        return { queued: duplicate.status === "queued", actionId: duplicate.id, status: duplicate.status };
      }
    }
    throw error;
  }
}

export async function pendingActions(caller: VerifiedCaller) {
  const rows = await listQueuedActions(caller, 50);
  const config = getRuntimeConfig();
  return rows.map((row) => {
    if (row.crypto_version !== 1 || row.action_schema_version !== 1) {
      throw new DelegationError("invalid_data", "Stored AI action version is unsupported.");
    }
    let value: unknown;
    try {
      value = decryptJson(config.aiDataKey, "action", caller.userId, row.expected_revision, {
        ciphertext: row.action_ciphertext,
        nonce: row.action_nonce,
      });
    } catch {
      throw new DelegationError("invalid_data", "Stored AI action could not be authenticated.");
    }
    const parsed = AiActionSchema.safeParse(value);
    if (!parsed.success || parsed.data.expectedRevision !== row.expected_revision) {
      throw new DelegationError("invalid_data", "Stored AI action is inconsistent.");
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      action: parsed.data,
    };
  });
}

export async function completeAction(caller: VerifiedCaller, actionId: string, value: unknown) {
  if (!/^[0-9a-f-]{36}$/iu.test(actionId)) {
    throw new DelegationError("invalid_data", "Action ID is invalid.");
  }
  const parsed = CompleteActionSchema.safeParse(value);
  if (!parsed.success) throw new DelegationError("invalid_data", "Action completion is invalid.");
  const row = await completeActionRow(
    caller,
    actionId,
    parsed.data.status,
    parsed.data.resultCode ?? null,
  );
  if (!row) throw new DelegationError("not_found", "Queued action was not found.");
  return { actionId: row.id, status: row.status, completedAt: row.completed_at };
}
