import type { z } from "zod";
import { checkPlanFeasibility } from "@/src/domain/decision";
import {
  AvailabilityOutputSchema,
  DecisionContextOutputSchema,
  WeeklyAvailabilityOutputSchema,
} from "@/src/mcp/output-schemas";
import { withMcpDataBoundary } from "@/src/mcp/text-content";

type Availability = z.infer<typeof AvailabilityOutputSchema>;
type WeeklyAvailability = z.infer<typeof WeeklyAvailabilityOutputSchema>;
type DecisionContext = z.infer<typeof DecisionContextOutputSchema>;
type PlanFeasibility = ReturnType<typeof checkPlanFeasibility>;

function clock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function boundaryText(boundary: Availability["windows"][number]["previousBoundary"]): string {
  if (!boundary) return "none";
  const location = [boundary.buildingCode, boundary.room].filter(Boolean).join(" ");
  return `${boundary.label} ${clock(boundary.startTime)}–${clock(boundary.endTime)}${location ? ` @ ${location}` : ""}`;
}

function gapPlanText(plan: NonNullable<Availability["windows"][number]["gapPlan"]>): string {
  const assessment = plan.assessment;
  const travel = assessment.travelMinutes === null ? "travel ?" : `${assessment.travelMinutes}m travel`;
  return `${assessment.primary.title} · ${assessment.primary.activityMinutes}m usable · ${travel} · ${assessment.bufferMinutes}m buffer · leave ${clock(assessment.leaveByMinutes)} · ${Math.round(assessment.confidence * 100)}% ${assessment.confidenceLabel}`;
}

export function formatAvailability(value: Availability): string {
  const scope = value.date
    ? `${value.date}${value.weekday ? ` (${value.weekday})` : ""}`
    : `${value.weekday ?? "no weekday"}, ${value.term}`;
  const lines = [
    `Gapwise availability · ${scope} · revision ${value.revision}.`,
    `Status: ${value.status}; minimum ${value.minimumDurationMinutes}m.`,
  ];
  if (!value.windows.length) {
    lines.push("No matching delegated availability window was found.");
    return withMcpDataBoundary(lines.join("\n"));
  }

  for (const window of value.windows) {
    const plan = window.gapPlan ? ` · ${gapPlanText(window.gapPlan)}` : " · temporal-only";
    lines.push(
      `- ${clock(window.startTime)}–${clock(window.endTime)} (${window.durationMinutes}m) · prev ${boundaryText(window.previousBoundary)} · next ${boundaryText(window.nextBoundary)}${plan}`,
    );
  }
  lines.push("Full boundaries, warnings, and authoritative gap details are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatWeeklyAvailability(value: WeeklyAvailability): string {
  const lines = [
    `Gapwise weekly availability · ${value.term} · revision ${value.revision}.`,
    `Status: ${value.status}; minimum ${value.minimumDurationMinutes}m usable.`,
  ];
  for (const window of value.windows) {
    lines.push(
      `- ${window.weekday} ${clock(window.startTime)}–${clock(window.endTime)} · ${window.rawDurationMinutes}m raw / ${window.usableActivityMinutes}m usable · ${window.planningValidation}`,
    );
  }
  if (!value.windows.length) lines.push("No matching weekly opportunity was found.");
  lines.push("Exact boundaries and gap validation evidence are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatPlanFeasibility(value: PlanFeasibility): string {
  const scope = value.date
    ? `${value.date}${value.weekday ? ` (${value.weekday})` : ""}`
    : `${value.weekday ?? "no weekday"}, ${value.term}`;
  const lines = [
    `Gapwise feasibility · ${scope} · revision ${value.revision}.`,
    `${clock(value.requestedBlock.startTime)}–${clock(value.requestedBlock.endTime)} (${value.requestedBlock.durationMinutes}m): ${value.feasible ? "feasible" : "not feasible"} · ${value.validationLevel}.`,
  ];
  if (value.conflicts.length) {
    lines.push(
      "Conflicts:",
      ...value.conflicts.map(
        (item) => `- ${item.label} ${clock(item.startTime)}–${clock(item.endTime)}`,
      ),
    );
  }
  if (value.gapPlan) lines.push(`Gap context: ${gapPlanText(value.gapPlan)}.`);
  if (value.reasons.length) lines.push(`Reason: ${value.reasons[0]}`);
  if (value.warnings.length) lines.push(`Warning: ${value.warnings[0]}`);
  lines.push("Full validation evidence is in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatDecisionContext(value: DecisionContext): string {
  const lines = [
    `Gapwise decision context · ${value.term} · revision ${value.revision}.`,
    `Hard load: ${value.hardConstraintSummary.academicMeetingCount} academic meeting(s); ${value.hardConstraintSummary.reservedAssessmentWindowCount} RES placeholder(s) excluded from hard load.`,
  ];

  for (const day of value.days) {
    if (!day.academicMeetingCount && !day.gapCount) continue;
    const span =
      day.firstStart === null || day.lastEnd === null
        ? "unbounded"
        : `${clock(day.firstStart)}–${clock(day.lastEnd)}`;
    lines.push(
      `- ${day.weekday}: ${day.academicMeetingCount} class(es), ${day.academicMinutes}m academic, span ${span}, ${day.gapCount} gap(s), ${day.totalGapwiseActivityMinutes}m usable gap time`,
    );
  }

  if (value.gapPlanGroups.length) {
    lines.push("Distinct gap plans:");
    for (const group of value.gapPlanGroups.slice(0, 8)) {
      const travel = group.travelMinutes === null ? "travel ?" : `${group.travelMinutes}m travel`;
      const warning = group.keyWarning ? ` · warning: ${group.keyWarning}` : "";
      lines.push(
        `- ${group.appliesTo.join("/")} ${clock(group.startTime)}–${clock(group.endTime)} · ${group.primaryTitle} · ${group.usableActivityMinutes}m usable · ${travel} · leave ${clock(group.leaveByMinutes)} · ${group.confidencePercent}%${warning}`,
      );
    }
  }

  if (value.dataQualityFlags.length) {
    lines.push("Data flags:", ...value.dataQualityFlags.slice(0, 6).map((flag) => `- ${flag.message}`));
  }
  if (value.actionItems.length) {
    lines.push("Action items:", ...value.actionItems.map((item) => `- ${item.message}`));
  }
  if (value.limitations.length) {
    lines.push(`Planning note: ${value.limitations[0]}`);
  }
  lines.push("Full preferences, raw gap plans, flags, and planning evidence are in structuredContent.");
  return withMcpDataBoundary(lines.join("\n"));
}
