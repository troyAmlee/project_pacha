// Mapbox Search Box API integration (suggest + retrieve).
// Replaces the prior Geocoding v6 call so place-name / POI queries
// (e.g. "Upper Midwest American Indian Center") return real hits, not
// just street addresses. Calls go directly from the browser with the
// existing VITE_MAPBOX_TOKEN. Results are biased to the Twin Cities so
// "Main St" doesn't surface Manila first.
//
// Search Box is a two-step flow:
//   1. /suggest returns lightweight suggestions (no coords) for autocomplete
//   2. /retrieve resolves a suggestion's mapbox_id to coordinates
// Both calls share a session_token so Mapbox bills them as one session.

const SUGGEST_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/suggest";
const RETRIEVE_ENDPOINT = "https://api.mapbox.com/search/searchbox/v1/retrieve";
const TWIN_CITIES_BBOX = [-93.6, 44.7, -92.8, 45.2]; // [minLng, minLat, maxLng, maxLat]
const DEFAULT_LIMIT = 6;
const DEFAULT_TYPES = "poi,address,street,place,locality,neighborhood,postcode";

export function createSearchSession() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const value = c === "0" ? r : (r & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function searchSuggestions(query, options = {}) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 3) return [];

  const token = (import.meta.env?.VITE_MAPBOX_TOKEN || "").trim();
  if (!token) {
    throw new Error("Mapbox token is not configured.");
  }

  const sessionToken = options.sessionToken || createSearchSession();

  const params = new URLSearchParams({
    q: trimmed,
    session_token: sessionToken,
    access_token: token,
    limit: String(options.limit ?? DEFAULT_LIMIT),
    language: options.language ?? "en",
    types: options.types ?? DEFAULT_TYPES,
    bbox: (options.bbox ?? TWIN_CITIES_BBOX).join(",")
  });

  if (options.proximity) {
    const [lat, lng] = options.proximity;
    params.set("proximity", `${lng},${lat}`);
  }

  const response = await fetch(`${SUGGEST_ENDPOINT}?${params.toString()}`, {
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Search failed (${response.status}).`);
  }

  const payload = await response.json();
  return (payload?.suggestions ?? [])
    .map((suggestion) => normalizeSuggestion(suggestion, sessionToken))
    .filter(Boolean);
}

export async function retrieveSuggestion(suggestion, options = {}) {
  if (!suggestion?.mapboxId) {
    throw new Error("Suggestion is missing mapboxId.");
  }
  if (!suggestion?.sessionToken) {
    throw new Error("Suggestion is missing sessionToken.");
  }

  const token = (import.meta.env?.VITE_MAPBOX_TOKEN || "").trim();
  if (!token) {
    throw new Error("Mapbox token is not configured.");
  }

  const params = new URLSearchParams({
    session_token: suggestion.sessionToken,
    access_token: token,
    language: options.language ?? "en"
  });

  const url = `${RETRIEVE_ENDPOINT}/${encodeURIComponent(suggestion.mapboxId)}?${params.toString()}`;
  const response = await fetch(url, { signal: options.signal });

  if (!response.ok) {
    throw new Error(`Retrieve failed (${response.status}).`);
  }

  const payload = await response.json();
  const feature = payload?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new Error("Retrieved feature has no coordinates.");
  }

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Retrieved feature has invalid coordinates.");
  }

  const props = feature.properties ?? {};
  return {
    ...suggestion,
    primary: suggestion.primary || props.name || "Result",
    secondary:
      suggestion.secondary ||
      props.full_address ||
      props.place_formatted ||
      "",
    point: [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
  };
}

function normalizeSuggestion(suggestion, sessionToken) {
  if (!suggestion?.mapbox_id) return null;

  const primary =
    suggestion.name || suggestion.name_preferred || suggestion.address || "Result";
  const secondary =
    suggestion.full_address && suggestion.full_address !== primary
      ? suggestion.full_address
      : suggestion.place_formatted && suggestion.place_formatted !== primary
        ? suggestion.place_formatted
        : suggestion.feature_type
          ? toReadableType(suggestion.feature_type)
          : "";

  return {
    id: suggestion.mapbox_id,
    mapboxId: suggestion.mapbox_id,
    sessionToken,
    primary,
    secondary,
    featureType: suggestion.feature_type ?? null,
    point: null
  };
}

function toReadableType(featureType) {
  return String(featureType).replace(/_/g, " ");
}
