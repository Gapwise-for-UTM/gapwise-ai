import type { z } from "zod";
import {
  AvailabilityOutputSchema,
  DecisionContextOutputSchema,
  PlanFeasibilityOutputSchema,
} from "@/src/mcp/output-schemas";
import { withMcpDataBoundary } from "@/src/mcp/text-content";

type Availability = z.infer<typeof AvailabilityOutputSchema>;
type DecisionContext = z.infer<typeof DecisionContextOutputSchema>;
type PlanFeasibility = z.infer<typeof PlanFeasibilityOutputSchema>;

function clock(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function boundaryText(boundary: Availability["windows"][number]["previousBoundary"]): string {
  if (!boundary) return "none";
  const location = [boundary.buildingCode, boundary.room].filter(Boolean).join(" ");
  return `${boundary.source} ${boundary.label} ${clock(boundary.startTime)}–${clock(boundary.endTime)}${location ? ` at ${location}` : ""}`;
}

function gapPlanText(plan: NonNullable<Availability["windows"][number]["gapPlan"]>): string {
  const assessment = plan.assessment;
  const travel = assessment.travelMinutes === null ? "travel unavailable" : `${assessment.travelMinutes} min travel`;
  return `${assessment.primary.title} [${assessment.primary.action}], score ${assessment.primary.score}, ${assessment.primary.activityMinutes} activity min; ${travel}, ${assessment.bufferMinutes} min buffer, leave by ${clock(assessment.leaveByMinutes)}, route ${assessment.routeStatus}/${assessment.routeAccuracy}, confidence ${assessment.confidenceLabel} ${Math.round(assessment.confidence * 100)}%`;
}

export function formatAvailability(value: Availability): string {
  const scope = value.date
    ? `${value.date}${value.weekday ? ` (${value.weekday})` : ""}`
    : `${value.weekday ?? "no weekday"}, ${value.term}`;
  const lines = [
    `Gapwise availability for ${scope} — revision ${value.revision}, snapshot ${value.generatedAt}.`,
    `Status: ${value.status}. Minimum requested duration: ${value.minimumDurationMinutes} min.`,
  ];
  if (value.searchBounds) {
    lines.push(`Explicit search bounds: ${clock(value.searchBounds.startTime)}–${clock(value.searchBounds.endTime)}.`);
  } else {
    lines.push("No explicit day bounds were supplied, so Gapwise only returns windows bounded by delegated hard events; it does not assume wake/sleep or free time outside the scheduled day.");
  }
  if (!value.windows.length) {
    lines.push("No matching delegated availability window was found.");
    return withMcpDataBoundary(lines.join("\n"));
  }

  for (const [index, window] of value.windows.entries()) {
    lines.push(
      `Window ${index + 1}: ${clock(window.startTime)}–${clock(window.endTime)} (${window.durationMinutes} min).`,
      `  Previous boundary: ${boundaryText(window.previousBoundary)}.`,
      `  Next boundary: ${boundaryText(window.nextBoundary)}.`,
    );
    if (window.gapPlan) {
      lines.push(`  Authoritative Gapwise gap assessment: ${gapPlanText(window.gapPlan)}.`);
      if (window.gapPlan.assessment.warnings.length) {
        lines.push(`  Gap warnings: ${window.gapPlan.assessment.warnings.join(" ")}`);
      }
    } else {
      lines.push("  No exact delegated Gapwise gap assessment matches this whole window; do not invent travel/buffer facts.");
    }
    if (window.flexiblePersonalItems.length) {
      lines.push(
        `  Soft competing personal items: ${window.flexiblePersonalItems
          .map((item) => `${item.title} (${item.durationMinutes} min)`)
          .join(", ")}.`,
      );
    }
  }
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatPlanFeasibility(value: PlanFeasibility): string {
  const scope = value.date
    ? `${value.date}${value.weekday ? ` (${value.weekday})` : ""}`
    : `${value.weekday ?? "no weekday"}, ${value.term}`;
  const lines = [
    `Gapwise feasibility check for ${scope} — revision ${value.revision}, snapshot ${value.generatedAt}.`,
    `Proposed block: ${clock(value.requestedBlock.startTime)}–${clock(value.requestedBlock.endTime)} (${value.requestedBlock.durationMinutes} min).`,
    `Result: ${value.feasible ? "feasible" : "not feasible"}; validation level: ${value.validationLevel}.`,
  ];
  if (value.requestedBlock.location) {
    lines.push(
      `Requested location: ${[value.requestedBlock.location.buildingCode, value.requestedBlock.location.room].filter(Boolean).join(" ") || "unspecified"}; route validation: no.`,
    );
  }
  if (value.conflicts.length) {
    lines.push(
      "Hard conflicts:",
      ...value.conflicts.map(
        (item) =>
          `- ${item.source} ${item.label}: ${clock(item.startTime)}–${clock(item.endTime)}${item.buildingCode ? ` at ${item.buildingCode}${item.room ? ` ${item.room}` : ""}` : ""}.`,
      ),
    );
  }
  lines.push(`Previous hard boundary: ${boundaryText(value.previousBoundary)}.`);
  lines.push(`Next hard boundary: ${boundaryText(value.nextBoundary)}.`);
  if (value.gapPlan) {
    lines.push(`Surrounding authoritative Gapwise gap assessment: ${gapPlanText(value.gapPlan)}.`);
  } else {
    lines.push("No delegated Gapwise gap assessment contains this proposed block, so transition safety is not validated beyond timetable overlap checks.");
  }
  if (value.reasons.length) lines.push("Reasons:", ...value.reasons.map((reason) => `- ${reason}`));
  if (value.flexiblePersonalItems.length) {
    lines.push(
      `Soft competing personal items: ${value.flexiblePersonalItems.map((item) => `${item.title} (${item.durationMinutes} min)`).join(", ")}.`,
    );
  }
  if (value.warnings.length) lines.push("Warnings:", ...value.warnings.map((warning) => `- ${warning}`));
  return withMcpDataBoundary(lines.join("\n"));
}

export function formatDecisionContext(value: DecisionContext): string {
  const lines = [
    `Gapwise decision context for ${value.term} — revision ${value.revision}, snapshot ${value.generatedAt}.`,
    `Hard constraints: ${value.hardConstraintSummary.academicMeetingCount} academic meetings and ${value.hardConstraintSummary.fixedPersonalCount} delegated fixed personal items.`,
  ];

  for (const day of value.days) {
    const span =
      day.firstStart === null || day.lastEnd === null
        ? "no bounded scheduled day"
        : `${clock(day.firstStart)}–${clock(day.lastEnd)}`;
    lines.push(
      `${day.weekday}: ${day.academicMeetingCount} academic meetings (${day.academicMinutes} min), ${day.fixedPersonalCount} fixed personal items (${day.fixedPersonalMinutes} min), span ${span}, ${day.gapCount} delegated gaps (${day.totalGapMinutes} raw min / ${day.totalGapwiseActivityMinutes} Gapwise activity min), ${day.unresolvedRouteCount} unavailable transitions.`,
    );
    if (day.bestGap) {
      lines.push(`  Best delegated gap: ${clock(day.bestGap.startTime)}–${clock(day.bestGap.endTime)} — ${gapPlanText(day.bestGap)}.`);
    }
    if (day.warnings.length) lines.push(`  Warnings: ${day.warnings.join(" ")}`);
  }

  if (value.topGapOpportunities.length) {
    lines.push("Top delegated gap opportunities:");
    for (const plan of value.topGapOpportunities) {
      lines.push(`- ${plan.weekday} ${clock(plan.startTime)}–${clock(plan.endTime)}: ${gapPlanText(plan)}.`);
    }
  }
  if (value.gapPreferences) lines.push(`Delegated gap preferences: ${JSON.stringify(value.gapPreferences)}`);
  if (value.routingPreferences) {
    lines.push(`Delegated routing preferences: ${JSON.stringify(value.routingPreferences)}`);
  }
  if (value.limitations.length) lines.push("Planning limitations:", ...value.limitations.map((item) => `- ${item}`));
  lines.push(
    "Use the decision context to choose which exact Gapwise availability/gap/feasibility tools to call next. Do not replace authoritative Gapwise route, buffer, leave-by, recurrence, or conflict facts with model estimates.",
  );
  return withMcpDataBoundary(lines.join("\n"));
}
