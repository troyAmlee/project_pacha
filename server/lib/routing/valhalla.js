import { normalizeOsrmRoute } from "./shared.js";

export async function fetchValhallaRoute(points, profile, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(buildValhallaRouteUrl(options.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildValhallaRouteBody(points, profile)),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.routes?.[0]) {
      throw new Error(
        payload?.message || payload?.error || "Valhalla could not calculate that path."
      );
    }

    return normalizeOsrmRoute(payload.routes[0], profile, "valhalla");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchValhallaTraceRoute(points, profile, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(buildValhallaTraceRouteUrl(options.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildValhallaTraceRouteBody(points, profile)),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.matchings?.[0]) {
      throw new Error(
        payload?.message || payload?.error || "Valhalla could not match that trace."
      );
    }

    return normalizeOsrmRoute(payload.matchings[0], profile, "valhalla");
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildValhallaRouteUrl(baseUrl) {
  return new URL("/route", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function buildValhallaTraceRouteUrl(baseUrl) {
  return new URL("/trace_route", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function buildValhallaRouteBody(points, profile) {
  const costing = toValhallaCosting(profile);
  const body = {
    locations: points.map(([lat, lng], index) => ({
      lat: Number(lat.toFixed(6)),
      lon: Number(lng.toFixed(6)),
      type: index === 0 || index === points.length - 1 ? "break" : "through"
    })),
    costing,
    units: "miles",
    format: "osrm",
    shape_format: "geojson",
    banner_instructions: true,
    voice_instructions: true
  };

  if (costing === "bicycle") {
    body.costing_options = {
      bicycle: {
        use_roads: 0.35,
        use_hills: 0.35,
        avoid_bad_surfaces: 0.25
      }
    };
  }

  return body;
}

function buildValhallaTraceRouteBody(points, profile) {
  const body = buildValhallaRouteBody(points, profile);

  body.shape = body.locations.map((location, index) => ({
    lat: location.lat,
    lon: location.lon,
    type: index === 0 || index === body.locations.length - 1 ? "break" : "via"
  }));
  delete body.locations;
  body.shape_match = "map_snap";

  return body;
}

function toValhallaCosting(profile) {
  if (profile === "foot") {
    return "pedestrian";
  }

  if (profile === "car" || profile === "driving") {
    return "auto";
  }

  return "bicycle";
}
