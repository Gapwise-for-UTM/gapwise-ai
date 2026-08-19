import { checkPlanFeasibility } from "@/src/domain/decision";
import type { AiAction, AiSnapshot, PersonalItem } from "@/src/domain/schemas";

type Term = AiSnapshot["schedule"][number]["term"];
type Weekday = AiSnapshot["schedule"][number]["weekday"];

type FixedCandidate = {
  term: Term;
  weekday: Weekday;
  startTime: number;
  endTime: number;
  locationBuildingCode: string | null;
  locationRoom: string | null;
};

type WriteSafetyResult =
  | {
      allowed: true;
      validationLevel: "not_applicable" | "temporal_only" | "gapwise_transition_validated";
      warning?: string;
    }
  | {
      allowed: false;
      code: "invalid_personal_item" | "hard_conflict" | "gapwise_transition_violation";
      message: string;
    };

function fixedTimes(value: PersonalItem): { startTime: number; endTime: number } | null {
  if (value.flexibility.kind !== "fixed") return null;
  if (!("startTime" in value) || !("endTime" in value)) return null;
  if (typeof value.startTime !== "number" || typeof value.endTime !== "number") return null;
  return { startTime: value.startTime, endTime: value.endTime };
}

function fixedCandidateFromCreate(
  action: Extract<AiAction, { kind: "create_personal_item" }>,
): FixedCandidate | null {
  if (action.item.flexibility.kind !== "fixed") return null;
  if (!("startTime" in action.item) || !("endTime" in action.item)) return null;
  if (typeof action.item.startTime !== "number" || typeof action.item.endTime !== "number") return null;
  return {
    term: action.item.term,
    weekday: action.item.weekday,
    startTime: action.item.startTime,
    endTime: action.item.endTime,
    locationBuildingCode: action.item.locationBuildingCode ?? null,
    locationRoom: action.item.locationRoom ?? null,
  };
}

function fixedCandidateFromUpdate(
  snapshot: AiSnapshot,
  action: Extract<AiAction, { kind: "update_personal_item" }>,
): FixedCandidate | null | "invalid" {
  const current = snapshot.personalItems.find((item) => item.id === action.itemId);
  if (!current) return "invalid";

  const flexibility = action.patch.flexibility ?? current.flexibility;
  if (flexibility.kind !== "fixed") return null;

  const currentTimes = fixedTimes(current);
  const startTime = action.patch.startTime ?? currentTimes?.startTime;
  const endTime = action.patch.endTime ?? currentTimes?.endTime;
  if (startTime === undefined || endTime === undefined || endTime <= startTime) return "invalid";

  return {
    term: action.patch.term ?? current.term,
    weekday: action.patch.weekday ?? current.weekday,
    startTime,
    endTime,
    locationBuildingCode:
      action.patch.locationBuildingCode !== undefined
        ? action.patch.locationBuildingCode
        : current.locationBuildingCode ?? null,
    locationRoom:
      action.patch.locationRoom !== undefined ? action.patch.locationRoom : current.locationRoom ?? null,
  };
}

function safetyForFixedCandidate(
  snapshot: AiSnapshot,
  candidate: FixedCandidate,
  excludePersonalItemId?: string,
): WriteSafetyResult {
  const validationSnapshot = excludePersonalItemId
    ? {
        ...snapshot,
        personalItems: snapshot.personalItems.filter((item) => item.id !== excludePersonalItemId),
        gapPlans: snapshot.gapPlans.filter(
          (plan) =>
            plan.previousMeetingId !== excludePersonalItemId &&
            plan.nextMeetingId !== excludePersonalItemId,
        ),
      }
    : snapshot;

  const result = checkPlanFeasibility(validationSnapshot, {
    scope: { kind: "term_weekday", term: candidate.term, weekday: candidate.weekday },
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    locationBuildingCode: candidate.locationBuildingCode,
    locationRoom: candidate.locationRoom,
  });

  if (result.validationLevel === "conflict") {
    const labels = result.conflicts.map((conflict) => conflict.label).join(", ");
    return {
      allowed: false,
      code: "hard_conflict",
      message: labels
        ? `The proposed personal item overlaps delegated hard timetable boundaries: ${labels}.`
        : "The proposed personal item overlaps a delegated hard timetable boundary.",
    };
  }

  if (result.validationLevel === "gapwise_transition_rejected") {
    return {
      allowed: false,
      code: "gapwise_transition_violation",
      message:
        result.reasons.join(" ") ||
        "The proposed personal item violates Gapwise's deterministic transition constraints.",
    };
  }

  if (result.validationLevel === "gapwise_transition_validated") {
    return { allowed: true, validationLevel: "gapwise_transition_validated" };
  }

  return {
    allowed: true,
    validationLevel: "temporal_only",
    warning:
      "The proposed fixed item has no delegated hard conflict, but no matching Gapwise gap assessment validates its surrounding transition.",
  };
}

export function validateAiActionSemantics(snapshot: AiSnapshot, action: AiAction): WriteSafetyResult {
  if (action.kind === "create_personal_item") {
    const candidate = fixedCandidateFromCreate(action);
    return candidate
      ? safetyForFixedCandidate(snapshot, candidate)
      : { allowed: true, validationLevel: "not_applicable" };
  }

  if (action.kind === "update_personal_item") {
    const candidate = fixedCandidateFromUpdate(snapshot, action);
    if (candidate === "invalid") {
      return {
        allowed: false,
        code: "invalid_personal_item",
        message:
          "The proposed personal-item update does not produce a valid fixed item. Switching a flexible item to fixed requires a valid start and end time.",
      };
    }
    return candidate
      ? safetyForFixedCandidate(snapshot, candidate, action.itemId)
      : { allowed: true, validationLevel: "not_applicable" };
  }

  return { allowed: true, validationLevel: "not_applicable" };
}
