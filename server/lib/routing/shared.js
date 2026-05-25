export function normalizeOsrmRoute(route, profile, source) {
  const path = (route.geometry?.coordinates ?? []).map(([lng, lat]) => [
    Number(lat.toFixed(6)),
    Number(lng.toFixed(6))
  ]);

  return {
    source,
    profile,
    path,
    distanceMiles: Number(metersToMiles(route.distance || 0).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(Number(route.duration || 0) / 60)),
    steps: (route.legs ?? []).flatMap((leg) =>
      (leg.steps ?? []).map((step) => {
        const [lng, lat] = step.maneuver?.location ?? [];

        return {
          distanceMiles: Number(metersToMiles(step.distance || 0).toFixed(2)),
          durationMinutes: Math.max(1, Math.round(Number(step.duration || 0) / 60)),
          instruction: buildStepInstruction(step),
          location:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
              : null,
          modifier: step.maneuver?.modifier ?? "",
          name: step.name ?? "",
          type: step.maneuver?.type ?? "",
          voiceInstruction: buildStepVoiceInstruction(step)
        };
      })
    )
  };
}

export function metersToMiles(value) {
  return Number(value) / 1609.344;
}

function buildStepInstruction(step) {
  const modifier = step.maneuver?.modifier;
  const type = step.maneuver?.type;
  const roadName = step.name ? ` onto ${step.name}` : "";

  if (step.maneuver?.instruction) {
    return step.maneuver.instruction;
  }

  if (type === "arrive") {
    return "Arrive at destination";
  }

  if (type === "depart") {
    return `Start${roadName}`;
  }

  if (modifier) {
    return `${toInstructionVerb(modifier)}${roadName}`;
  }

  return roadName ? `Continue${roadName}` : "Continue";
}

function buildStepVoiceInstruction(step) {
  return (
    step.voiceInstructions?.[0]?.announcement ||
    step.maneuver?.instruction ||
    buildStepInstruction(step)
  );
}

function toInstructionVerb(modifier) {
  return modifier
    .split(" ")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
