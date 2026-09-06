import { describe, expect, it } from "vitest";
import { findWeeklyAvailableWindows } from "@/src/domain/availability";
import type { AiSnapshot } from "@/src/domain/schemas";
import { validateAiActionSemantics } from "@/src/domain/write-safety";

const gapAssessment = (activityMinutes: number, leaveByMinutes: number) => ({
  primary: {
    id: "study",
    action: "study-block" as const,
    title: "Focused study",
    summary: "Use the validated activity envelope.",
    score: 90,
    activityMinutes,
    reasons: ["Gapwise protected transition time."],
    tags: ["route-verified" as const],
    timeline: [
      { kind: "activity" as const, label: "Focused study", minutes: activityMinutes },
      { kind: "travel" as const, label: "Travel", minutes: 10 },
      { kind: "buffer" as const, label: "Buffer", minutes: 10 },
    ],
  },
  alternatives: [],
  confidence: 0.9,
  confidenceLabel: "high" as const,
  travelMinutes: 10,
  bufferMinutes: 10,
  leaveByMinutes,
  arrivalMinutes: leaveByMinutes + 10,
  fallback: false,
  routeStatus: "routed" as const,
  routeAccuracy: "Verified indoor + outdoor route" as const,
  warnings: [],
});

const snapshot: AiSnapshot = {
  schemaVersion: 1,
  revision: 4,
  generatedAt: "2026-08-19T03:00:00.000Z",
  permissions: {
    readSchedule: true,
    readPersonal: true,
    writePersonal: true,
    readGapPlans: true,
    readGapPreferences: false,
    writeGapPreferences: false,
    readRoutingPreferences: false,
  },
  schedule: [
    {
      id: "mon-1",
      courseCode: "MAT157H5",
      activityType: "LEC",
      sectionCode: "0101",
      courseName: "Analysis I",
      startTime: 600,
      endTime: 660,
      weekday: "Monday",
      buildingCode: "MN",
      room: "1210",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
    },
    {
      id: "mon-2",
      courseCode: "CSC110Y5",
      activityType: "LEC",
      sectionCode: "0101",
      courseName: "Foundations of Computer Science",
      startTime: 780,
      endTime: 840,
      weekday: "Monday",
      buildingCode: "DH",
      room: "2010",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
    },
    {
      id: "tue-1",
      courseCode: "MAT157H5",
      activityType: "LEC",
      sectionCode: "0101",
      courseName: "Analysis I",
      startTime: 600,
      endTime: 660,
      weekday: "Tuesday",
      buildingCode: "MN",
      room: "1210",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
    },
    {
      id: "tue-2",
      courseCode: "CSC110Y5",
      activityType: "PRA",
      sectionCode: "0106",
      courseName: "Foundations of Computer Science",
      startTime: 900,
      endTime: 960,
      weekday: "Tuesday",
      buildingCode: "DH",
      room: "2010",
      term: "Fall",
      locationUnknown: false,
      isReservedAssessmentWindow: false,
    },
  ],
  personalItems: [],
  gapPlans: [
    {
      id: "mon-gap",
      term: "Fall",
      weekday: "Monday",
      startTime: 660,
      endTime: 780,
      durationMinutes: 120,
      previousMeetingId: "mon-1",
      nextMeetingId: "mon-2",
      assessment: gapAssessment(100, 760),
    },
    {
      id: "tue-gap",
      term: "Fall",
      weekday: "Tuesday",
      startTime: 660,
      endTime: 900,
      durationMinutes: 240,
      previousMeetingId: "tue-1",
      nextMeetingId: "tue-2",
      assessment: gapAssessment(220, 880),
    },
  ],
  gapPreferences: null,
  routingPreferences: null,
};

describe("weekly Gapwise opportunities", () => {
  it("searches the whole term week in one call", () => {
    const result = findWeeklyAvailableWindows(snapshot, {
      term: "Fall",
      minimumDurationMinutes: 90,
      maxResults: 10,
    });

    expect(result.status).toBe("available_windows_found");
    expect(result.windows.map((window) => window.weekday)).toEqual(["Tuesday", "Monday"]);
    expect(result.windows[0]?.usableActivityMinutes).toBe(220);
    expect(result.windows[1]?.usableActivityMinutes).toBe(100);
  });

  it("does not treat raw gap minutes as usable when Gapwise protects transition time", () => {
    const result = findWeeklyAvailableWindows(snapshot, {
      term: "Fall",
      minimumDurationMinutes: 110,
      maxResults: 10,
    });

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.weekday).toBe("Tuesday");
    expect(result.windows[0]?.rawDurationMinutes).toBe(240);
    expect(result.windows[0]?.usableActivityMinutes).toBe(220);
    expect(result.windows.some((window) => window.weekday === "Monday")).toBe(false);
  });
});

describe("legacy personal-item semantic write safety", () => {
  it("rejects an AI-created fixed item that overlaps an academic class", () => {
    const result = validateAiActionSemantics(snapshot, {
      schemaVersion: 1,
      kind: "create_personal_item",
      expectedRevision: 4,
      item: {
        title: "Bad study block",
        category: "Study",
        term: "Fall",
        weekday: "Monday",
        startTime: 630,
        endTime: 690,
        flexibility: { kind: "fixed" },
      },
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("hard_conflict");
  });

  it("rejects a fixed item that would consume Gapwise-protected transition time", () => {
    const result = validateAiActionSemantics(snapshot, {
      schemaVersion: 1,
      kind: "create_personal_item",
      expectedRevision: 4,
      item: {
        title: "Overlong study block",
        category: "Study",
        term: "Fall",
        weekday: "Monday",
        startTime: 665,
        endTime: 765,
        flexibility: { kind: "fixed" },
      },
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe("gapwise_transition_violation");
  });

  it("allows a fixed item inside the authoritative Gapwise activity envelope", () => {
    const result = validateAiActionSemantics(snapshot, {
      schemaVersion: 1,
      kind: "create_personal_item",
      expectedRevision: 4,
      item: {
        title: "Safe study block",
        category: "Study",
        term: "Fall",
        weekday: "Monday",
        startTime: 665,
        endTime: 755,
        flexibility: { kind: "fixed" },
      },
    });

    expect(result).toEqual({ allowed: true, validationLevel: "gapwise_transition_validated" });
  });

  it("allows a conflict-free edge-of-day fixed item but marks it temporal-only", () => {
    const result = validateAiActionSemantics(snapshot, {
      schemaVersion: 1,
      kind: "create_personal_item",
      expectedRevision: 4,
      item: {
        title: "After-class review",
        category: "Study",
        term: "Fall",
        weekday: "Monday",
        startTime: 900,
        endTime: 950,
        flexibility: { kind: "fixed" },
      },
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.validationLevel).toBe("temporal_only");
  });
});