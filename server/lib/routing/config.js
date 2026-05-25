export const DEFAULT_GRAPHHOPPER_BASE_URL = "https://graphhopper.com/api/1";
export const DEFAULT_VALHALLA_BASE_URL = "https://valhalla1.openstreetmap.de";
export const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
export const BIKE_SAFE_PATH_DETAILS = [
  "road_class",
  "road_environment",
  "road_access",
  "surface",
  "bike_network"
];

export class RoutingProviderError extends Error {
  constructor(message, { provider, statusCode = 502 } = {}) {
    super(message);
    this.name = "RoutingProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export function getRoutingProviderOrder({
  requestedProfile,
  routingProvider,
  allowOsrmBikeFallback
}) {
  const primary = normalizeRoutingProvider(routingProvider);
  const baseOrder = [primary, "graphhopper", "valhalla", "osrm"].filter(
    (provider, index, list) => list.indexOf(provider) === index
  );

  if (requestedProfile === "bike" && !allowOsrmBikeFallback) {
    return baseOrder.filter((provider) => provider !== "osrm");
  }

  return baseOrder;
}

export function readRoutingConfig(env = process.env) {
  return {
    allowOsrmBikeFallback: env.ALLOW_OSRM_BIKE_FALLBACK === "true",
    graphHopperApiKey: env.GRAPHHOPPER_API_KEY || "",
    graphHopperBaseUrl: env.GRAPHHOPPER_BASE_URL || DEFAULT_GRAPHHOPPER_BASE_URL,
    osrmBaseUrl: env.OSRM_BASE_URL || DEFAULT_OSRM_BASE_URL,
    osrmBikeProfile: env.OSRM_BIKE_PROFILE || "bike",
    routingProvider: env.ROUTING_PROVIDER || "graphhopper",
    routingTimeoutMs: getEnvNumber(env.ROUTING_TIMEOUT_MS, 7000),
    valhallaBaseUrl: env.VALHALLA_BASE_URL || DEFAULT_VALHALLA_BASE_URL
  };
}

export function buildGraphHopperRouteUrl({ baseUrl, apiKey }) {
  const url = new URL("/api/1/route", normalizeGraphHopperOrigin(baseUrl));
  url.searchParams.set("key", apiKey);
  return url;
}

export function buildGraphHopperRouteBody(points, profile) {
  const body = {
    profile: toGraphHopperProfile(profile),
    points: points.map(toLngLat),
    instructions: true,
    calc_points: true,
    points_encoded: false,
    locale: "en"
  };

  if (profile === "bike") {
    body.snap_preventions = ["motorway", "trunk", "ferry"];
    body.details = BIKE_SAFE_PATH_DETAILS;
    body.custom_model = buildBikeFriendlyCustomModel();
  }

  return body;
}

export function buildGraphHopperMatchUrl({ baseUrl, apiKey, profile }) {
  const url = new URL("/api/1/match", normalizeGraphHopperOrigin(baseUrl));
  url.searchParams.set("key", apiKey);
  url.searchParams.set("profile", toGraphHopperProfile(profile));
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "true");

  for (const detail of BIKE_SAFE_PATH_DETAILS) {
    url.searchParams.append("details", detail);
  }

  return url;
}

export function buildGpxTrack(points) {
  const trackPoints = points
    .map(
      ([lat, lng]) =>
        `<trkpt lat="${escapeXmlNumber(lat)}" lon="${escapeXmlNumber(lng)}"></trkpt>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="north-star-ridebook"><trk><trkseg>${trackPoints}</trkseg></trk></gpx>`;
}

export function buildBikeFriendlyCustomModel() {
  return {
    priority: [
      { if: "road_class == MOTORWAY || road_class == TRUNK", multiply_by: "0" },
      { if: "road_class == PRIMARY", multiply_by: "0.35" },
      { if: "road_class == SECONDARY", multiply_by: "0.55" },
      { if: "road_class == CYCLEWAY || bike_network != MISSING", multiply_by: "1.4" },
      {
        if: "road_class == PATH || road_class == LIVING_STREET || road_class == RESIDENTIAL",
        multiply_by: "1.15"
      }
    ],
    distance_influence: 90
  };
}

function normalizeRoutingProvider(value) {
  const provider = String(value || "").toLowerCase();
  return ["graphhopper", "valhalla", "osrm"].includes(provider) ? provider : "graphhopper";
}

function normalizeGraphHopperOrigin(baseUrl) {
  const url = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (url.pathname.endsWith("/api/1/")) {
    return `${url.origin}/`;
  }
  return url;
}

function toGraphHopperProfile(profile) {
  if (profile === "foot") {
    return "foot";
  }

  if (profile === "car" || profile === "driving") {
    return "car";
  }

  return "bike";
}

function toLngLat([lat, lng]) {
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function escapeXmlNumber(value) {
  return String(Number(value.toFixed(6)));
}

function getEnvNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
