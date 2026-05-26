// Forward-geocodes a free-text query through the Mapbox Geocoding v6 API.
// Calls go directly from the browser (same pattern as map tile requests),
// using the existing VITE_MAPBOX_TOKEN. Results are biased to the Twin
// Cities so a search for "Main St" doesn't surface Manila first.

const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";
const TWIN_CITIES_BBOX = [-93.6, 44.7, -92.8, 45.2]; // [minLng, minLat, maxLng, maxLat]
const DEFAULT_LIMIT = 5;

export async function geocodeAddress(query, options = {}) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 3) return [];

  const token = (import.meta.env?.VITE_MAPBOX_TOKEN || "").trim();
  if (!token) {
    throw new Error("Mapbox token is not configured.");
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(options.limit ?? DEFAULT_LIMIT),
    bbox: (options.bbox ?? TWIN_CITIES_BBOX).join(","),
    language: options.language ?? "en",
    access_token: token
  });

  if (options.proximity) {
    const [lat, lng] = options.proximity;
    params.set("proximity", `${lng},${lat}`);
  }

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status}).`);
  }

  const payload = await response.json();
  return (payload?.features ?? [])
    .map((feature) => normalizeFeature(feature))
    .filter(Boolean);
}

function normalizeFeature(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const props = feature.properties ?? {};
  const primary = props.name || props.place_formatted || props.full_address || "Result";
  const secondary =
    props.full_address && props.full_address !== primary
      ? props.full_address
      : props.place_formatted && props.place_formatted !== primary
        ? props.place_formatted
        : "";

  return {
    id: feature.id || `${lat.toFixed(5)},${lng.toFixed(5)}`,
    primary,
    secondary,
    point: [Number(lat.toFixed(6)), Number(lng.toFixed(6))]
  };
}
