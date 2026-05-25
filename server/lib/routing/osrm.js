import { normalizeOsrmRoute } from "./shared.js";

export async function fetchOsrmRoute(points, profile, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(
      buildOsrmRouteUrl(points, profile, options),
      { signal: controller.signal }
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.code !== "Ok" || !payload.routes?.[0]) {
      throw new Error(payload?.message || "Routing service could not calculate that path.");
    }

    return normalizeOsrmRoute(payload.routes[0], profile, "osrm");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchOsrmMatch(points, profile, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(
      buildOsrmMatchUrl(points, profile, options),
      { signal: controller.signal }
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.code !== "Ok" || !payload.matchings?.[0]) {
      throw new Error(payload?.message || "OSRM could not match that trace.");
    }

    return normalizeOsrmRoute(payload.matchings[0], profile, "osrm");
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOsrmRouteUrl(points, profile, options) {
  const coordinates = points
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(";");
  const url = new URL(
    `/route/v1/${toOsrmProfile(profile, options.osrmBikeProfile)}/${coordinates}`,
    options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`
  );

  url.searchParams.set("alternatives", "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "true");
  url.searchParams.set("generate_hints", "false");

  return url;
}

function buildOsrmMatchUrl(points, profile, options) {
  const coordinates = points
    .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(";");
  const url = new URL(
    `/match/v1/${toOsrmProfile(profile, options.osrmBikeProfile)}/${coordinates}`,
    options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`
  );

  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "true");
  url.searchParams.set("generate_hints", "false");

  return url;
}

function toOsrmProfile(profile, osrmBikeProfile) {
  if (profile === "foot") {
    return "foot";
  }

  if (profile === "car" || profile === "driving") {
    return "driving";
  }

  return osrmBikeProfile;
}
