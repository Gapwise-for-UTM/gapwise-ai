import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptJson } from "@/src/crypto/envelope";
import { AiActionSchema, type AiSnapshot } from "@/src/domain/schemas";
import type { VerifiedCaller } from "@/src/auth/verify";

const TEST_AI_KEY = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

const db = vi.hoisted(() => ({
  completeActionRow: vi.fn(),
  deleteAllActions: vi.fn(),
  deleteDelegation: vi.fn(),
  getActionByIdempotencyKey: vi.fn(),
  getDelegation: vi.fn(),
  insertAction: vi.fn(),
  insertDelegation: vi.fn(),
  listQueuedActions: vi.fn(),
  updateDelegationCas: vi.fn(),
}));

vi.mock("@/src/config", () => ({
  getRuntimeConfig: () => ({ aiDataKey: TEST_AI_KEY }),
}));

vi.mock("@/src/db/supabase-rest", () => ({
  RestRequestError: class RestRequestError extends Error {
    constructor(public readonly status: number) {
      super(`Supabase request failed with status ${status}.`);
    }
  },
  ...db,
}));

import {
  publishSnapshot,
  queueAction,
  readSnapshot,
  revokeDelegation,
} from "@/src/delegation/service";

const caller: VerifiedCaller = {
  userId: "11111111-1111-4111-8111-111111111111",
  accessToken: "test-token",
  expiresAt: 4_000_000_000,
};

function snapshot(overrides: Partial<AiSnapshot> = {}): AiSnapshot {
  return {
    schemaVersion: 1,
    revision: 4,
    generatedAt: "2026-08-30T00:00:00.000Z",
    permissions: {
      readSchedule: true,
      readPersonal: true,
      writePersonal: false,
      readGapPlans: false,
      readGapPreferences: false,
      writeGapPreferences: false,
      readRoutingPreferences: false,
    },
    schedule: [],
    personalItems: [],
    gapPlans: [],
    gapPreferences: null,
    routingPreferences: null,
    ...overrides,
  };
}

function delegationRow(value: AiSnapshot, encryptedForUserId = caller.userId) {
  const encrypted = encryptJson(
    TEST_AI_KEY,
    "snapshot",
    encryptedForUserId,
    value.revision,
    value,
  );
  return {
    user_id: encryptedForUserId,
    enabled: true,
    revision: value.revision,
    permissions: value.permissions,
    snapshot_schema_version: 1,
    crypto_version: encrypted.cryptoVersion,
    snapshot_ciphertext: encrypted.ciphertext,
    snapshot_nonce: encrypted.nonce,
    created_at: "2026-08-30T00:00:00.000Z",
    updated_at: "2026-08-30T00:00:00.000Z",
  };
}

const legacyAssessment = {
  primary: {
    id: "study",
    action: "study-block" as const,
    title: "Study",
    summary: "Legacy delegated study plan.",
    score: 80,
    activityMinutes: 45,
    reasons: [],
    tags: [],
    timeline: [{ kind: "activity" as const, label: "Study", minutes: 45 }],
  },
  alternatives: [],
  confidence: 0.8,
  confidenceLabel: "high" as const,
  travelMinutes: 0,
  bufferMinutes: 0,
  leaveByMinutes: 720,
  arrivalMinutes: 720,
  fallback: false,
  routeStatus: "same-room" as const,
  routeAccuracy: "Verified indoor + outdoor route" as const,
  warnings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("delegation failure boundaries", () => {
  it("fails closed when no delegation exists", async () => {
    db.getDelegation.mockResolvedValue(null);

    await expect(readSnapshot(caller)).rejects.toMatchObject({
      code: "not_enabled",
    });
  });

  it("rejects ciphertext bound to a different user", async () => {
    const value = snapshot();
    db.getDelegation.mockResolvedValue(
      delegationRow(value, "22222222-2222-4222-8222-222222222222"),
    );

    await expect(readSnapshot(caller)).rejects.toMatchObject({
      code: "invalid_data",
    });
  });

  it("drops legacy gap plans whose boundaries are retired or reserved", async () => {
    const value = snapshot({
      permissions: {
        readSchedule: true,
        readPersonal: true,
        writePersonal: false,
        readGapPlans: true,
        readGapPreferences: false,
        writeGapPreferences: false,
        readRoutingPreferences: false,
      },
      schedule: [
        {
          id: "academic-a",
          courseCode: "CSC110Y5",
          activityType: "LEC",
          sectionCode: "LEC0101",
          courseName: "Foundations of Computer Science",
          startTime: 600,
          endTime: 660,
          weekday: "Monday",
          buildingCode: "MN",
          room: "1270",
          term: "Fall",
          locationUnknown: false,
          isReservedAssessmentWindow: false,
        },
        {
          id: "reserved",
          courseCode: "CSC110Y5",
          activityType: "LEC",
          sectionCode: "LEC0101",
          courseName: "Foundations of Computer Science",
          startTime: 780,
          endTime: 900,
          weekday: "Saturday",
          buildingCode: null,
          room: null,
          term: "Fall",
          locationUnknown: true,
          isReservedAssessmentWindow: true,
          locationType: "tba",
        },
        {
          id: "academic-b",
          courseCode: "MAT157H5",
          activityType: "LEC",
          sectionCode: "LEC0101",
          courseName: "Analysis I",
          startTime: 720,
          endTime: 780,
          weekday: "Monday",
          buildingCode: "MN",
          room: "1210",
          term: "Fall",
          locationUnknown: false,
          isReservedAssessmentWindow: false,
        },
      ],
      personalItems: [
        {
          id: "legacy-personal",
          title: "Old personal item",
          category: "Study",
          term: "Fall",
          weekday: "Monday",
          startTime: 680,
          endTime: 700,
          flexibility: { kind: "fixed" },
          createdAt: "2026-08-20T00:00:00.000Z",
          updatedAt: "2026-08-20T00:00:00.000Z",
        },
      ],
      gapPlans: [
        {
          id: "valid-academic-gap",
          term: "Fall",
          weekday: "Monday",
          startTime: 660,
          endTime: 720,
          durationMinutes: 60,
          previousMeetingId: "academic-a",
          nextMeetingId: "academic-b",
          assessment: legacyAssessment,
        },
        {
          id: "legacy-personal-gap",
          term: "Fall",
          weekday: "Monday",
          startTime: 660,
          endTime: 680,
          durationMinutes: 20,
          previousMeetingId: "academic-a",
          nextMeetingId: "legacy-personal",
          assessment: { ...legacyAssessment, primary: { ...legacyAssessment.primary, activityMinutes: 20 } },
        },
        {
          id: "reserved-boundary-gap",
          term: "Fall",
          weekday: "Saturday",
          startTime: 720,
          endTime: 780,
          durationMinutes: 60,
          previousMeetingId: "academic-b",
          nextMeetingId: "reserved",
          assessment: legacyAssessment,
        },
      ],
    });
    db.getDelegation.mockResolvedValue(delegationRow(value));

    const current = await readSnapshot(caller);
    expect(current.personalItems).toEqual([]);
    expect(current.permissions.readPersonal).toBe(false);
    expect(current.gapPlans.map((plan) => plan.id)).toEqual(["valid-academic-gap"]);
  });

  it("rejects personal writes when delegation is read-only", async () => {
    const value = snapshot();
    db.getDelegation.mockResolvedValue(delegationRow(value));

    await expect(
      queueAction(caller, {
        schemaVersion: 1,
        kind: "create_personal_item",
        expectedRevision: value.revision,
        item: {
          title: "Study",
          category: "Study",
          term: "Fall",
          weekday: "Monday",
          flexibility: { kind: "flexible", durationMinutes: 60 },
        },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    expect(db.listQueuedActions).not.toHaveBeenCalled();
    expect(db.insertAction).not.toHaveBeenCalled();
  });

  it("rejects stale supported writes before queueing them", async () => {
    const value = snapshot({
      permissions: {
        readSchedule: true,
        readPersonal: false,
        writePersonal: false,
        readGapPlans: false,
        readGapPreferences: true,
        writeGapPreferences: true,
        readRoutingPreferences: false,
      },
      gapPreferences: {
        setupMinutes: 5,
        packUpMinutes: 5,
        lunchWindowStart: 690,
        lunchWindowEnd: 840,
        mealDurationMinutes: 30,
        willingToLeaveCampus: false,
        oneWayHomeCommuteMinutes: 45,
        minimumHomeStayMinutes: 60,
        homeTurnaroundMinutes: 10,
        riskTolerance: "medium",
      },
    });
    db.getDelegation.mockResolvedValue(delegationRow(value));

    await expect(
      queueAction(caller, {
        schemaVersion: 1,
        kind: "update_gap_preferences",
        expectedRevision: value.revision - 1,
        patch: { riskTolerance: "low" },
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    expect(db.listQueuedActions).not.toHaveBeenCalled();
    expect(db.insertAction).not.toHaveBeenCalled();
  });

  it("does not expose an academic-meeting mutation action", () => {
    expect(
      AiActionSchema.safeParse({
        schemaVersion: 1,
        kind: "update_academic_meeting",
        expectedRevision: 4,
        meetingId: "course-1",
        patch: { room: "changed" },
      }).success,
    ).toBe(false);
  });

  it("deletes queued authority before deleting delegation state", async () => {
    db.deleteAllActions.mockResolvedValue(undefined);
    db.deleteDelegation.mockResolvedValue(undefined);

    await expect(revokeDelegation(caller)).resolves.toEqual({ enabled: false });
    expect(db.deleteAllActions).toHaveBeenCalledWith(caller);
    expect(db.deleteDelegation).toHaveBeenCalledWith(caller);
    expect(db.deleteAllActions.mock.invocationCallOrder[0]).toBeLessThan(
      db.deleteDelegation.mock.invocationCallOrder[0]!,
    );
  });

  it("re-delegates from revision 1 after revoked state is absent", async () => {
    const fresh = snapshot({ revision: 1 });
    db.getDelegation.mockResolvedValue(null);
    db.insertDelegation.mockImplementation(async (_caller: VerifiedCaller, row: Record<string, unknown>) => ({
      ...row,
      created_at: "2026-08-30T00:00:00.000Z",
      updated_at: "2026-08-30T00:00:00.000Z",
    }));

    await expect(publishSnapshot(caller, fresh)).resolves.toMatchObject({
      enabled: true,
      revision: 1,
    });
    expect(db.insertDelegation).toHaveBeenCalledWith(
      caller,
      expect.objectContaining({ user_id: caller.userId, enabled: true, revision: 1 }),
    );
  });
});
