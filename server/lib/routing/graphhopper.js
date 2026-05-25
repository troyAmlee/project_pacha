import {
  buildGraphHopperMatchUrl,
  buildGraphHopperRouteBody,
  buildGraphHopperRouteUrl,
  buildGpxTrack,
  RoutingProviderError
} from "./config.js";

const UNSAFE_BIKE_ROAD_CLASSES = new Set(["MOTORWAY", "TRUNK"]);

export async function fetchGraphHopperRoute(points, profile, options) {
  const path = await requestGraphHopperJson({
    providerAction: "route",
    url: buildGraphHopperRouteUrl({
      baseUrl: options.baseUrl,
      apiKey: requireGraphHopperKey(options.apiKey)
    }),
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs,
    requestOptions: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildGraphHopperRouteBody(points, profile, {
          useCustomModel: options.useCustomModel
        })
      )
    }
  });

  if (profile === "bike") {
    validateBikeFriendlyPath(path);
  }

  return normalizeGraphHopperPath(path, profile);
}

export async function fetchGraphHopperMatch(points, profile, options) {
  const path = await requestGraphHopperJson({
    providerAction: "match",
    url: buildGraphHopperMatchUrl({
      baseUrl: options.baseUrl,
      apiKey: requireGraphHopperKey(options.apiKey),
      profile
    }),
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs,
    requestOptions: {
      method: "POST",
      headers: { "Content-Type": "application/gpx+xml" },
      body: buildGpxTrack(points)
    }
  });

  if (profile === "bike") {
    validateBikeFriendlyPath(path);
  }

  return normalizeGraphHopperPath(path, profile);
}

export function normalizeGraphHopperPath(path, profile) {
  const coordinates = Array.isArray(path.points?.coordinates) ? path.points.coordinates : [];
  const normalizedPath = coordinates.map(([lng, lat]) => [
    Number(lat.toFixed(6)),
    Number(lng.toFixed(6))
  ]);

  return {
    source: "graphhopper",
    profile,
    path: normalizedPath,
    distanceMiles: Number(metersToMiles(path.distance || 0).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(Number(path.time || 0) / 60000)),
    steps: (path.instructions ?? []).map((instruction) =>
      normalizeGraphHopperInstruction(instruction, normalizedPath)
    )
  };
}

export function validateBikeFriendlyPath(path) {
  const roadClassDetails = path.details?.road_class ?? [];

  for (const detail of roadClassDetails) {
    const roadClass = String(detail[2] || "").toUpperCase();

    if (UNSAFE_BIKE_ROAD_CLASSES.has(roadClass)) {
      throw new RoutingProviderError(`GraphHopper bike route used ${roadClass}.`, {
        provider: "graphhopper",
        statusCode: 502
      });
    }
  }
}

async function requestGraphHopperJson({
  providerAction,
  url,
  requestOptions,
  fetchImpl,
  timeoutMs
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...requestOptions,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.paths?.[0]) {
      throw new RoutingProviderError(
        payload?.message || `GraphHopper could not calculate that ${providerAction}.`,
        { provider: "graphhopper", statusCode: response.status || 502 }
      );
    }

    return payload.paths[0];
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeGraphHopperInstruction(instruction, path) {
  const pointIndex = Math.max(0, Number(instruction.interval?.[0]) || 0);
  const text = instruction.text || buildFallbackInstruction(instruction);

  return {
    distanceMiles: Number(metersToMiles(instruction.distance || 0).toFixed(2)),
    durationMinutes: Math.max(1, Math.round(Number(instruction.time || 0) / 60000)),
    instruction: text,
    location: path[pointIndex] ?? null,
    modifier: toModifier(instruction.sign),
    name: instruction.street_name ?? "",
    type: toInstructionType(instruction.sign),
    voiceInstruction: text
  };
}

function requireGraphHopperKey(apiKey) {
  if (!apiKey) {
    throw new RoutingProviderError("GRAPHHOPPER_API_KEY is required for GraphHopper routing.", {
      provider: "graphhopper",
      statusCode: 500
    });
  }

  return apiKey;
}

function toInstructionType(sign) {
  if (sign === 4) {
    return "arrive";
  }

  if (sign === 2 || sign === 3) {
    return "turn";
  }

  if (sign === -2 || sign === -3) {
    return "turn";
  }

  return "continue";
}

function toModifier(sign) {
  if (sign === 2 || sign === 3) {
    return "right";
  }

  if (sign === -2 || sign === -3) {
    return "left";
  }

  return "";
}

function buildFallbackInstruction(instruction) {
  return instruction.street_name ? `Continue onto ${instruction.street_name}` : "Continue";
}

function metersToMiles(value) {
  return Number(value) / 1609.344;
}
