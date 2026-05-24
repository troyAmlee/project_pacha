const OSM_TILE_CONFIG = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  source: "osm"
};

const CARTO_VOYAGER_TILE_CONFIG = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  source: "carto-voyager"
};

const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '<strong><a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noreferrer">Improve this map</a></strong>';

let warnedAboutMissingToken = false;
let warnedAboutInvalidStyle = false;

export function getMapTileConfig({ navigationMode = false } = {}) {
  const mapbox = buildMapboxTileConfig();

  if (mapbox) {
    return mapbox;
  }

  return navigationMode ? CARTO_VOYAGER_TILE_CONFIG : OSM_TILE_CONFIG;
}

function buildMapboxTileConfig() {
  const token = readEnv("VITE_MAPBOX_TOKEN");
  const styleUrl = readEnv("VITE_MAPBOX_STYLE_URL");

  if (!token || !styleUrl) {
    if (!warnedAboutMissingToken && (token || styleUrl)) {
      warnedAboutMissingToken = true;
      console.warn(
        "Mapbox is partially configured. Set both VITE_MAPBOX_TOKEN and VITE_MAPBOX_STYLE_URL to enable Mapbox tiles."
      );
    }
    return null;
  }

  const parsed = parseMapboxStyle(styleUrl);

  if (!parsed) {
    if (!warnedAboutInvalidStyle) {
      warnedAboutInvalidStyle = true;
      console.warn(
        "VITE_MAPBOX_STYLE_URL must look like mapbox://styles/<user>/<style-id>. Falling back to OpenStreetMap tiles."
      );
    }
    return null;
  }

  const tilePath = `https://api.mapbox.com/styles/v1/${encodeURIComponent(parsed.username)}/${encodeURIComponent(parsed.styleId)}/tiles/512/{z}/{x}/{y}`;
  const url = `${tilePath}?access_token=${encodeURIComponent(token)}`;

  return {
    url,
    attribution: MAPBOX_ATTRIBUTION,
    tileSize: 512,
    zoomOffset: -1,
    source: "mapbox"
  };
}

function parseMapboxStyle(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  const protocolMatch = trimmed.match(/^mapbox:\/\/styles\/([^/]+)\/([^/?#]+)/i);

  if (protocolMatch) {
    return { username: protocolMatch[1], styleId: protocolMatch[2] };
  }

  const httpsMatch = trimmed.match(/\/styles\/v1\/([^/]+)\/([^/?#]+)/i);

  if (httpsMatch) {
    return { username: httpsMatch[1], styleId: httpsMatch[2] };
  }

  return null;
}

function readEnv(name) {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const value = env ? env[name] : undefined;
  return typeof value === "string" ? value.trim() : value;
}
