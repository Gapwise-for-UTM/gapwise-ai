import { describe, expect, it } from "vitest";
import { AiActionSchema, AiPermissionsSchema, AiSnapshotSchema } from "@/src/domain/schemas";

const permissions = {
  readSchedule: true as const,
  readPersonal: true,
  writePersonal: true,
  readGapPlans: true,
  readGapPreferences: true,
  writeGapPreferences: true,
  readRoutingPreferences: true,
};

const meeting = {
  id: "CSC110-LEC0101-Monday-600",
  courseCode: "CSC110Y5",
  activityType: "LEC" as const,
  sectionCode: "LEC0101",
  courseName: "Foundations of Computer Science",
  startTime: 600,
  endTime: 660,
  weekday: "Monday" as const,
  buildingCode: "MN",
  room: "1210",
  term: "Fall" as const,
  locationUnknown: false,
  locationType: "physical" as const,
};

const gapPlan = {
  id: "gap-1",
  term: "Fall" as const,
  weekday: "Monday" as const,
  startTime: 660,
  endTime: 780,
  durationMinutes: 120,
  previousMeetingId: meeting.id,
  nextMeetingId: "MAT157-LEC0101-Monday-780",
  assessment: {
    primary: {
      id: "productivity-study-block",
      action: "study-block" as const,
      title: "Focused study",
      summary: "Enough for one meaningful study session without rushing the transition.",
      score: 89,
      activityMinutes: 95,
      reasons: ["15 min is protected for travel and transition risk."],
      tags: ["route-verified" as const],
      timeline: [
        { kind: "activity" as const, label: "Focused study", minutes: 95 },
        { kind: "travel" as const, label: "Travel", minutes: 10 },
        { kind: "buffer" as const, label: "Buffer", minutes: 5 },
      ],
    },
    alternatives: [],
    confidence: 0.95,
    confidenceLabel: "high" as const,
    travelMinutes: 10,
    bufferMinutes: 5,
    leaveByMinutes: 765,
    arrivalMinutes: 775,
    fallback: false,
    routeStatus: "routed" as const,
    routeAccuracy: "Verified indoor + outdoor route" as const,
    warnings: [],
  },
};

describe("delegation schemas", () => {
  it("accepts a minimized source-backed snapshot with deterministic Gapwise plans", () => {
    const result = AiSnapshotSchema.safeParse({
      schemaVersion: 1,
      revision: 1,
      generatedAt: "2026-08-18T16:30:00.000Z",
      permissions,
      schedule: [meeting],
      personalItems: [],
      gapPlans: [gapPlan],
      gapPreferences: null,
      routingPreferences: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects delegated gap plans when their permission is disabled", () => {
    const result = AiSnapshotSchema.safeParse({
      schemaVersion: 1,
      revision: 1,
      generatedAt: "2026-08-18T16:30:00.000Z",
      permissions: { ...permissions, readGapPlans: false },
      schedule: [meeting],
      personalItems: [],
      gapPlans: [gapPlan],
      gapPreferences: null,
      routingPreferences: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects undeclared meeting fields such as notes", () => {
    const result = AiSnapshotSchema.safeParse({
      schemaVersion: 1,
      revision: 1,
      generatedAt: "2026-08-18T16:30:00.000Z",
      permissions,
      schedule: [{ ...meeting, notes: "do not delegate this" }],
      personalItems: [],
      gapPlans: [],
      gapPreferences: null,
      routingPreferences: null,
    });
    expect(result.success).toBe(false);
  });

  it("requires read permission when write permission is enabled", () => {
    expect(
      AiPermissionsSchema.safeParse({ ...permissions, readPersonal: false, writePersonal: true }).success,
    ).toBe(false);
  });

  it("has no action kind capable of editing academic meetings", () => {
    expect(
      AiActionSchema.safeParse({
        schemaVersion: 1,
        kind: "update_academic_meeting",
        expectedRevision: 1,
        meetingId: meeting.id,
        patch: { startTime: 700 },
      }).success,
    ).toBe(false);
  });
});
