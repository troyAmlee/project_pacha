import { formatDurationMinutes, formatNavigationDistance } from "../utils";

export function formatRoutingProviderLabel(source) {
  if (source === "graphhopper") {
    return "GraphHopper";
  }

  if (source === "valhalla") {
    return "Valhalla";
  }

  if (source === "osrm") {
    return "OSRM";
  }

  return null;
}

export function buildDirectionSections({ route, routedRoute, routedToStart, t }) {
  const sections = [];
  const toStartSteps = normalizeDirectionSteps("to-start", routedToStart?.steps, t);
  const routeSteps = normalizeDirectionSteps("route", routedRoute?.steps, t);

  if (toStartSteps.length) {
    sections.push({
      key: "to-start",
      leg: "to-start",
      summary: formatDirectionSummary(routedToStart?.distanceMiles, routedToStart?.durationMinutes),
      steps: toStartSteps,
      title: t("directions.sectionToStart")
    });
  }

  if (routeSteps.length) {
    sections.push({
      key: "route",
      leg: "route",
      summary: formatDirectionSummary(
        routedRoute?.distanceMiles ?? route?.distanceMiles,
        routedRoute?.durationMinutes
      ),
      steps: routeSteps,
      title: t("directions.sectionRoute")
    });
  }

  if (!sections.length && route?.path?.length >= 2) {
    sections.push({
      key: "saved-line",
      leg: "route",
      summary: formatDirectionSummary(route.distanceMiles),
      steps: [
        {
          detail: t("directions.detailFallback"),
          distanceLabel: formatNavigationDistance(0.005),
          instruction: t("directions.stepSavedStart", { start: route.start }),
          key: "saved-line-start",
          kind: "depart",
          originalIndex: -1
        },
        {
          detail: t("directions.detailSavedFollow"),
          distanceLabel: formatNavigationDistance(route.distanceMiles),
          instruction: t("directions.stepSavedFollow"),
          key: "saved-line-follow",
          kind: "straight",
          originalIndex: -2
        },
        {
          detail: t("directions.detailSavedFinish"),
          distanceLabel: formatNavigationDistance(0),
          instruction: t("directions.stepSavedArrive"),
          key: "saved-line-arrive",
          kind: "arrive",
          originalIndex: -3
        }
      ],
      title: t("directions.sectionSaved")
    });
  }

  return sections;
}

function normalizeDirectionSteps(leg, steps, t) {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && (step.instruction || step.voiceInstruction))
    .map((step, index) => {
      const instruction = cleanDirectionText(step.instruction || step.voiceInstruction);
      const streetName = cleanDirectionText(step.name);
      const distanceLabel = formatNavigationDistance(step.distanceMiles);
      const durationLabel = step.durationMinutes
        ? formatDurationMinutes(step.durationMinutes)
        : "";
      const detailParts = [];

      if (streetName && !/unnamed/i.test(streetName)) {
        detailParts.push(t("directions.detailVia", { street: streetName }));
      }

      if (durationLabel) {
        detailParts.push(durationLabel);
      }

      return {
        detail: detailParts.join(" · ") || t("directions.detailContinue"),
        distanceLabel,
        instruction,
        key: `${leg}-${index}-${step.type || "step"}`,
        kind: getDirectionStepKind(step, instruction),
        originalIndex: index
      };
    });
}

function formatDirectionSummary(distanceMiles, durationMinutes) {
  const parts = [];

  if (Number.isFinite(Number(distanceMiles)) && Number(distanceMiles) > 0) {
    parts.push(formatNavigationDistance(distanceMiles));
  }

  if (Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0) {
    parts.push(formatDurationMinutes(durationMinutes));
  }

  return parts.join(" - ");
}

function cleanDirectionText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDirectionStepKind(step, instruction) {
  const type = String(step.type || "").toLowerCase();
  const text = `${step.modifier || ""} ${instruction}`.toLowerCase();

  if (type.includes("arrive") || /arrive|destination|finish/.test(text)) {
    return "arrive";
  }

  if (type.includes("depart") || /start|depart/.test(text)) {
    return "depart";
  }

  if (/left/.test(text)) {
    return "left";
  }

  if (/right/.test(text)) {
    return "right";
  }

  return "straight";
}
