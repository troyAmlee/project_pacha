# Hybrid Mapbox GraphHopper Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mapbox-styled maps and GraphHopper-first bike routing while preventing bike requests from falling back to car-like routes.

**Architecture:** Keep the current React Leaflet map component and swap only the tile provider to Mapbox Static Tiles. Move routing provider construction, provider ordering, GraphHopper requests, and response normalization into focused server modules that are called by the existing Express endpoints.

**Tech Stack:** React 18, Vite, React Leaflet, Express, Node built-in `fetch`, Node built-in `node:test`, GraphHopper Routing API, GraphHopper Map Matching API, Mapbox Static Tiles API.

---

## Sources

- GraphHopper Routing API: `POST /route`, query API key, `[lng, lat]` POST points, `points_encoded=false`, `details`, and `custom_model`.
- GraphHopper Map Matching API: `POST /match`, GPX request body, `profile`, `points_encoded=false`, and `details`.
- GraphHopper custom model docs: road attributes include `road_class`, `road_environment`, `road_access`, `surface`, and `bike_network`.
- Mapbox Static Tiles API: Leaflet can render raster tiles from a Mapbox Studio style with `https://api.mapbox.com/styles/v1/{username}/{style_id}/tiles/{tilesize}/{z}/{x}/{y}{@2x}?access_token=...`.

## File Structure

- Create `server/lib/routing/config.js`: environment parsing, provider order, GraphHopper route and match request builders, GPX serialization, provider error types.
- Create `server/lib/routing/graphhopper.js`: GraphHopper HTTP calls and response normalization into the app's existing route shape.
- Create `server/lib/routing/valhalla.js`: move existing Valhalla request builders and normalizer from `server/index.js`.
- Create `server/lib/routing/osrm.js`: move existing OSRM request builders and normalizer from `server/index.js`.
- Create `server/lib/routing/index.js`: provider orchestration for route and match requests.
- Modify `server/index.js`: import `fetchRoutedPath` and `fetchMatchedPath` from `server/lib/routing/index.js`; remove in-file provider implementations.
- Create `server/lib/routing/*.test.js`: Node test coverage for provider order, GraphHopper request construction, GPX construction, and response normalization.
- Create `client/src/mapConfig.js`: Mapbox tile URL and attribution helper with safe fallback when token is missing.
- Create `client/src/mapConfig.test.js`: Node test coverage for Mapbox URL construction.
- Modify `client/src/components/RouteMap.jsx`: use `getMapTileLayer` for standard and navigation maps.
- Modify `client/src/pages/RouteBuilderPage.jsx`: update "street matching" copy to "bike route matching".
- Modify `client/src/pages/RideScreenPage.jsx`: update `loadRoadRoute` and `loadRoadPathToStart` names to bike-oriented wording.
- Modify `package.json`: add a root `test` script using `node --test`.
- Modify `README.md`: document required Mapbox and GraphHopper environment variables.

Do not modify `server/data/store.json`; it is already dirty and unrelated.

---

### Task 1: Add Test Runner and Routing Config Tests

**Files:**
- Modify: `package.json`
- Create: `server/lib/routing/config.js`
- Create: `server/lib/routing/config.test.js`

- [ ] **Step 1: Add the root test script**

In `package.json`, change `scripts` to include `test`:

```json
"scripts": {
  "dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\"",
  "build": "npm run build --workspace client",
  "start": "npm run start --workspace server",
  "test": "node --test"
}
```

- [ ] **Step 2: Write failing provider-order and request-builder tests**

Create `server/lib/routing/config.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGraphHopperMatchUrl,
  buildGraphHopperRouteBody,
  buildGraphHopperRouteUrl,
  buildGpxTrack,
  getRoutingProviderOrder
} from "./config.js";

const points = [
  [44.9508, -93.2605],
  [44.9442, -93.3205]
];

test("bike routes prefer GraphHopper and never include OSRM by default", () => {
  assert.deepEqual(
    getRoutingProviderOrder({
      requestedProfile: "bike",
      routingProvider: "graphhopper",
      allowOsrmBikeFallback: false
    }),
    ["graphhopper", "valhalla"]
  );
});

test("bike routes can opt into OSRM fallback explicitly", () => {
  assert.deepEqual(
    getRoutingProviderOrder({
      requestedProfile: "bike",
      routingProvider: "graphhopper",
      allowOsrmBikeFallback: true
    }),
    ["graphhopper", "valhalla", "osrm"]
  );
});

test("non-bike routes can use OSRM fallback", () => {
  assert.deepEqual(
    getRoutingProviderOrder({
      requestedProfile: "driving",
      routingProvider: "graphhopper",
      allowOsrmBikeFallback: false
    }),
    ["graphhopper", "valhalla", "osrm"]
  );
});

test("GraphHopper route URL includes the key outside the JSON body", () => {
  const url = buildGraphHopperRouteUrl({
    baseUrl: "https://graphhopper.com/api/1",
    apiKey: "secret"
  });

  assert.equal(url.toString(), "https://graphhopper.com/api/1/route?key=secret");
});

test("GraphHopper bike body uses lng-lat points and bike-safe request options", () => {
  const body = buildGraphHopperRouteBody(points, "bike");

  assert.equal(body.profile, "bike");
  assert.deepEqual(body.points, [
    [-93.2605, 44.9508],
    [-93.3205, 44.9442]
  ]);
  assert.equal(body.points_encoded, false);
  assert.equal(body.instructions, true);
  assert.deepEqual(body.snap_preventions, ["motorway", "trunk", "ferry"]);
  assert.deepEqual(body.details, ["road_class", "road_environment", "road_access", "surface", "bike_network"]);
  assert.match(JSON.stringify(body.custom_model), /road_class == MOTORWAY/);
  assert.match(JSON.stringify(body.custom_model), /bike_network != MISSING/);
});

test("GraphHopper match URL carries bike profile and unencoded points option", () => {
  const url = buildGraphHopperMatchUrl({
    baseUrl: "https://graphhopper.com/api/1",
    apiKey: "secret",
    profile: "bike"
  });

  assert.equal(
    url.toString(),
    "https://graphhopper.com/api/1/match?key=secret&profile=bike&points_encoded=false&instructions=true&details=road_class&details=road_environment&details=road_access&details=surface&details=bike_network"
  );
});

test("GPX builder serializes lat-lng points for GraphHopper map matching", () => {
  assert.equal(
    buildGpxTrack(points),
    '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="north-star-ridebook"><trk><trkseg><trkpt lat="44.9508" lon="-93.2605"></trkpt><trkpt lat="44.9442" lon="-93.3205"></trkpt></trkseg></trk></gpx>'
  );
});
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
npm run test -- server/lib/routing/config.test.js
```

Expected: FAIL with an import error because `server/lib/routing/config.js` does not exist yet.

- [ ] **Step 4: Implement routing config helpers**

Create `server/lib/routing/config.js`:

```js
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
    .map(([lat, lng]) => `<trkpt lat="${escapeXmlNumber(lat)}" lon="${escapeXmlNumber(lng)}"></trkpt>`)
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
      { if: "road_class == PATH || road_class == LIVING_STREET || road_class == RESIDENTIAL", multiply_by: "1.15" }
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
```

- [ ] **Step 5: Run the tests**

Run:

```bash
npm run test -- server/lib/routing/config.test.js
```

Expected: PASS for all tests in `config.test.js`.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json server/lib/routing/config.js server/lib/routing/config.test.js
git commit -m "test: add routing provider config coverage"
```

---

### Task 2: Add GraphHopper Normalization and Client Module

**Files:**
- Create: `server/lib/routing/graphhopper.js`
- Create: `server/lib/routing/graphhopper.test.js`

- [ ] **Step 1: Write failing GraphHopper tests**

Create `server/lib/routing/graphhopper.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGraphHopperMatch,
  fetchGraphHopperRoute,
  normalizeGraphHopperPath,
  validateBikeFriendlyPath
} from "./graphhopper.js";

const samplePath = {
  distance: 3218.688,
  time: 780000,
  points: {
    type: "LineString",
    coordinates: [
      [-93.2605, 44.9508],
      [-93.2684, 44.9501],
      [-93.3205, 44.9442]
    ]
  },
  instructions: [
    {
      distance: 1609.344,
      time: 360000,
      text: "Continue onto Midtown Greenway",
      street_name: "Midtown Greenway",
      sign: 0,
      interval: [0, 1]
    },
    {
      distance: 1609.344,
      time: 420000,
      text: "Turn right onto Bryant Avenue",
      street_name: "Bryant Avenue",
      sign: 2,
      interval: [1, 2]
    }
  ],
  details: {
    road_class: [
      [0, 1, "CYCLEWAY"],
      [1, 2, "RESIDENTIAL"]
    ]
  }
};

test("normalizes GraphHopper route paths into the app route shape", () => {
  assert.deepEqual(normalizeGraphHopperPath(samplePath, "bike"), {
    source: "graphhopper",
    profile: "bike",
    path: [
      [44.9508, -93.2605],
      [44.9501, -93.2684],
      [44.9442, -93.3205]
    ],
    distanceMiles: 2,
    durationMinutes: 13,
    steps: [
      {
        distanceMiles: 1,
        durationMinutes: 6,
        instruction: "Continue onto Midtown Greenway",
        location: [44.9508, -93.2605],
        modifier: "",
        name: "Midtown Greenway",
        type: "continue",
        voiceInstruction: "Continue onto Midtown Greenway"
      },
      {
        distanceMiles: 1,
        durationMinutes: 7,
        instruction: "Turn right onto Bryant Avenue",
        location: [44.9501, -93.2684],
        modifier: "right",
        name: "Bryant Avenue",
        type: "turn",
        voiceInstruction: "Turn right onto Bryant Avenue"
      }
    ]
  });
});

test("bike validator rejects motorway and trunk details", () => {
  assert.throws(
    () =>
      validateBikeFriendlyPath({
        details: { road_class: [[0, 1, "MOTORWAY"]] }
      }),
    /bike route used MOTORWAY/
  );
});

test("bike validator allows bike network and local road details", () => {
  assert.doesNotThrow(() => validateBikeFriendlyPath(samplePath));
});

test("fetchGraphHopperRoute posts JSON and normalizes the first path", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    return jsonResponse({ paths: [samplePath] });
  };

  const result = await fetchGraphHopperRoute(
    [
      [44.9508, -93.2605],
      [44.9442, -93.3205]
    ],
    "bike",
    {
      apiKey: "secret",
      baseUrl: "https://graphhopper.com/api/1",
      fetchImpl,
      timeoutMs: 7000
    }
  );

  assert.equal(result.source, "graphhopper");
  assert.equal(calls[0].url, "https://graphhopper.com/api/1/route?key=secret");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.match(calls[0].options.body, /"profile":"bike"/);
});

test("fetchGraphHopperMatch posts GPX and normalizes the first path", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: url.toString(), options });
    return jsonResponse({ paths: [samplePath] });
  };

  const result = await fetchGraphHopperMatch(
    [
      [44.9508, -93.2605],
      [44.9442, -93.3205]
    ],
    "bike",
    {
      apiKey: "secret",
      baseUrl: "https://graphhopper.com/api/1",
      fetchImpl,
      timeoutMs: 7000
    }
  );

  assert.equal(result.source, "graphhopper");
  assert.match(calls[0].url, /\/match\?/);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/gpx+xml");
  assert.match(calls[0].options.body, /<trkpt lat="44.9508" lon="-93.2605">/);
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test -- server/lib/routing/graphhopper.test.js
```

Expected: FAIL with an import error because `graphhopper.js` does not exist.

- [ ] **Step 3: Implement GraphHopper module**

Create `server/lib/routing/graphhopper.js`:

```js
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
      body: JSON.stringify(buildGraphHopperRouteBody(points, profile))
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
```

- [ ] **Step 4: Run the tests**

Run:

```bash
npm run test -- server/lib/routing/graphhopper.test.js
```

Expected: PASS for all tests in `graphhopper.test.js`.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/lib/routing/graphhopper.js server/lib/routing/graphhopper.test.js
git commit -m "feat: add GraphHopper routing adapter"
```

---

### Task 3: Extract Existing Valhalla and OSRM Providers

**Files:**
- Create: `server/lib/routing/shared.js`
- Create: `server/lib/routing/valhalla.js`
- Create: `server/lib/routing/osrm.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create shared normalizer code**

Create `server/lib/routing/shared.js` by moving the existing route normalization helpers from `server/index.js`:

```js
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
```

- [ ] **Step 2: Move Valhalla provider code**

Create `server/lib/routing/valhalla.js` with the current Valhalla functions from `server/index.js`, updated to accept options:

```js
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
      throw new Error(payload?.message || payload?.error || "Valhalla could not calculate that path.");
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
      throw new Error(payload?.message || payload?.error || "Valhalla could not match that trace.");
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
        use_roads: 0,
        use_hills: 0.25,
        avoid_bad_surfaces: 0.65,
        bicycle_type: "hybrid"
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
```

- [ ] **Step 3: Move OSRM provider code**

Create `server/lib/routing/osrm.js`:

```js
import { normalizeOsrmRoute } from "./shared.js";

export async function fetchOsrmRoute(points, profile, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await (options.fetchImpl ?? fetch)(buildOsrmRouteUrl(points, profile, options), {
      signal: controller.signal
    });
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
    const response = await (options.fetchImpl ?? fetch)(buildOsrmMatchUrl(points, profile, options), {
      signal: controller.signal
    });
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
```

- [ ] **Step 4: Run the current tests**

Run:

```bash
npm run test -- server/lib/routing/config.test.js server/lib/routing/graphhopper.test.js
```

Expected: PASS. This confirms the extracted modules do not break existing new tests before Express is rewired.

- [ ] **Step 5: Commit**

Run:

```bash
git add server/lib/routing/shared.js server/lib/routing/valhalla.js server/lib/routing/osrm.js
git commit -m "refactor: extract existing routing providers"
```

---

### Task 4: Add Provider Orchestration and Wire Express Endpoints

**Files:**
- Create: `server/lib/routing/index.js`
- Create: `server/lib/routing/index.test.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing orchestration tests**

Create `server/lib/routing/index.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { fetchMatchedPath, fetchRoutedPath } from "./index.js";

const points = [
  [44.9508, -93.2605],
  [44.9442, -93.3205]
];

test("bike route tries GraphHopper before Valhalla", async () => {
  const calls = [];
  const result = await fetchRoutedPath(points, "bike", {
    routingProvider: "graphhopper",
    allowOsrmBikeFallback: false,
    providers: {
      graphhopper: async () => {
        calls.push("graphhopper");
        return { source: "graphhopper", path: points };
      },
      valhalla: async () => {
        calls.push("valhalla");
        return { source: "valhalla", path: points };
      },
      osrm: async () => {
        calls.push("osrm");
        return { source: "osrm", path: points };
      }
    }
  });

  assert.equal(result.source, "graphhopper");
  assert.deepEqual(calls, ["graphhopper"]);
});

test("bike route falls back to Valhalla but not OSRM", async () => {
  const calls = [];
  const result = await fetchRoutedPath(points, "bike", {
    routingProvider: "graphhopper",
    allowOsrmBikeFallback: false,
    providers: {
      graphhopper: async () => {
        calls.push("graphhopper");
        throw new Error("no graphhopper");
      },
      valhalla: async () => {
        calls.push("valhalla");
        return { source: "valhalla", path: points };
      },
      osrm: async () => {
        calls.push("osrm");
        return { source: "osrm", path: points };
      }
    }
  });

  assert.equal(result.source, "valhalla");
  assert.deepEqual(calls, ["graphhopper", "valhalla"]);
});

test("bike route reports provider failures when safe providers fail", async () => {
  await assert.rejects(
    () =>
      fetchRoutedPath(points, "bike", {
        routingProvider: "graphhopper",
        allowOsrmBikeFallback: false,
        providers: {
          graphhopper: async () => {
            throw new Error("no graphhopper");
          },
          valhalla: async () => {
            throw new Error("no valhalla");
          },
          osrm: async () => {
            return { source: "osrm", path: points };
          }
        }
      }),
    /Routing providers are unavailable/
  );
});

test("matching uses the same bike-safe provider order", async () => {
  const calls = [];
  const result = await fetchMatchedPath(points, "bike", {
    routingProvider: "graphhopper",
    allowOsrmBikeFallback: false,
    providers: {
      graphhopper: async () => {
        calls.push("graphhopper");
        throw new Error("no graphhopper");
      },
      valhalla: async () => {
        calls.push("valhalla");
        return { source: "valhalla", path: points };
      },
      osrm: async () => {
        calls.push("osrm");
        return { source: "osrm", path: points };
      }
    }
  });

  assert.equal(result.source, "valhalla");
  assert.deepEqual(calls, ["graphhopper", "valhalla"]);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run test -- server/lib/routing/index.test.js
```

Expected: FAIL with an import error because `server/lib/routing/index.js` does not exist.

- [ ] **Step 3: Implement provider orchestration**

Create `server/lib/routing/index.js`:

```js
import { getRoutingProviderOrder, readRoutingConfig } from "./config.js";
import { fetchGraphHopperMatch, fetchGraphHopperRoute } from "./graphhopper.js";
import { fetchOsrmMatch, fetchOsrmRoute } from "./osrm.js";
import { fetchValhallaRoute, fetchValhallaTraceRoute } from "./valhalla.js";

export async function fetchRoutedPath(points, profile, overrides = {}) {
  const config = { ...readRoutingConfig(), ...overrides };
  const providerOrder = getRoutingProviderOrder({
    requestedProfile: profile,
    routingProvider: config.routingProvider,
    allowOsrmBikeFallback: config.allowOsrmBikeFallback
  });

  return runProviderOrder({
    actionLabel: "Routing",
    points,
    profile,
    providerOrder,
    providers: config.providers ?? buildRouteProviders(config)
  });
}

export async function fetchMatchedPath(points, profile, overrides = {}) {
  const config = { ...readRoutingConfig(), ...overrides };
  const providerOrder = getRoutingProviderOrder({
    requestedProfile: profile,
    routingProvider: config.routingProvider,
    allowOsrmBikeFallback: config.allowOsrmBikeFallback
  });

  return runProviderOrder({
    actionLabel: "Map matching",
    points,
    profile,
    providerOrder,
    providers: config.providers ?? buildMatchProviders(config)
  });
}

function buildRouteProviders(config) {
  return {
    graphhopper: (points, profile) =>
      fetchGraphHopperRoute(points, profile, {
        apiKey: config.graphHopperApiKey,
        baseUrl: config.graphHopperBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    valhalla: (points, profile) =>
      fetchValhallaRoute(points, profile, {
        baseUrl: config.valhallaBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    osrm: (points, profile) =>
      fetchOsrmRoute(points, profile, {
        baseUrl: config.osrmBaseUrl,
        osrmBikeProfile: config.osrmBikeProfile,
        timeoutMs: config.routingTimeoutMs
      })
  };
}

function buildMatchProviders(config) {
  return {
    graphhopper: (points, profile) =>
      fetchGraphHopperMatch(points, profile, {
        apiKey: config.graphHopperApiKey,
        baseUrl: config.graphHopperBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    valhalla: (points, profile) =>
      fetchValhallaTraceRoute(points, profile, {
        baseUrl: config.valhallaBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    osrm: (points, profile) =>
      fetchOsrmMatch(points, profile, {
        baseUrl: config.osrmBaseUrl,
        osrmBikeProfile: config.osrmBikeProfile,
        timeoutMs: config.routingTimeoutMs
      })
  };
}

async function runProviderOrder({ actionLabel, points, profile, providerOrder, providers }) {
  const providerErrors = [];

  for (const providerName of providerOrder) {
    const provider = providers[providerName];

    if (!provider) {
      continue;
    }

    try {
      return await provider(points, profile);
    } catch (error) {
      providerErrors.push(
        `${providerName}: ${error instanceof Error ? error.message : "request failed"}`
      );
    }
  }

  throw new Error(`${actionLabel} providers are unavailable (${providerErrors.join("; ")}).`);
}
```

- [ ] **Step 4: Wire Express to the new routing module**

In `server/index.js`, add this import near the other local imports:

```js
import { fetchMatchedPath, fetchRoutedPath } from "./lib/routing/index.js";
```

Then delete these constants from `server/index.js` because `readRoutingConfig` owns them:

```js
const ROUTING_PROVIDER = process.env.ROUTING_PROVIDER || "valhalla";
const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || "https://valhalla1.openstreetmap.de";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const OSRM_BIKE_PROFILE = process.env.OSRM_BIKE_PROFILE || "bike";
const ROUTING_TIMEOUT_MS = getEnvNumber("ROUTING_TIMEOUT_MS", 7000);
const ROUTING_PROVIDER_OPTIONS = ["valhalla", "osrm"];
```

Delete the provider implementation block from `server/index.js`, starting at the old `async function fetchRoutedPath(points, profile)` and ending after `function getEnvNumber(name, fallback)`.

Keep route validation, route persistence, and all Express route handlers unchanged.

- [ ] **Step 5: Run tests and build**

Run:

```bash
npm run test -- server/lib/routing/config.test.js server/lib/routing/graphhopper.test.js server/lib/routing/index.test.js
npm run build
```

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add server/index.js server/lib/routing/index.js server/lib/routing/index.test.js
git commit -m "feat: route bikes through GraphHopper first"
```

---

### Task 5: Add Mapbox Tile Configuration

**Files:**
- Create: `client/src/mapConfig.js`
- Create: `client/src/mapConfig.test.js`

- [ ] **Step 1: Write failing Mapbox config tests**

Create `client/src/mapConfig.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getMapTileLayer } from "./mapConfig.js";

test("returns Mapbox Static Tiles config when token is configured", () => {
  const layer = getMapTileLayer({
    token: "pk.test",
    styleUrl: "mapbox/streets-v12"
  });

  assert.equal(
    layer.url,
    "https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=pk.test"
  );
  assert.equal(layer.tileSize, 256);
  assert.equal(layer.detectRetina, false);
  assert.match(layer.attribution, /Mapbox/);
  assert.match(layer.attribution, /OpenStreetMap/);
  assert.equal(layer.usingMapbox, true);
});

test("strips mapbox style URL prefix", () => {
  const layer = getMapTileLayer({
    token: "pk.test",
    styleUrl: "mapbox://styles/custom/style-id"
  });

  assert.equal(
    layer.url,
    "https://api.mapbox.com/styles/v1/custom/style-id/tiles/256/{z}/{x}/{y}@2x?access_token=pk.test"
  );
});

test("falls back to OpenStreetMap when token is missing", () => {
  const layer = getMapTileLayer({ token: "", styleUrl: "" });

  assert.equal(layer.url, "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
  assert.equal(layer.usingMapbox, false);
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test -- client/src/mapConfig.test.js
```

Expected: FAIL with an import error because `client/src/mapConfig.js` does not exist.

- [ ] **Step 3: Implement map config helper**

Create `client/src/mapConfig.js`:

```js
const OSM_TILE_LAYER = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  detectRetina: true,
  tileSize: 256,
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  usingMapbox: false
};

const MAPBOX_ATTRIBUTION =
  '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function getMapTileLayer({
  token = import.meta.env.VITE_MAPBOX_TOKEN,
  styleUrl = import.meta.env.VITE_MAPBOX_STYLE_URL || "mapbox/streets-v12"
} = {}) {
  if (!token) {
    return OSM_TILE_LAYER;
  }

  const stylePath = normalizeStylePath(styleUrl);

  return {
    attribution: MAPBOX_ATTRIBUTION,
    detectRetina: false,
    tileSize: 256,
    url: `https://api.mapbox.com/styles/v1/${stylePath}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(token)}`,
    usingMapbox: true
  };
}

function normalizeStylePath(value) {
  return String(value || "mapbox/streets-v12")
    .replace(/^mapbox:\/\/styles\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}
```

- [ ] **Step 4: Run the tests**

Run:

```bash
npm run test -- client/src/mapConfig.test.js
```

Expected: PASS for all tests in `mapConfig.test.js`.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/mapConfig.js client/src/mapConfig.test.js
git commit -m "feat: add Mapbox tile configuration"
```

---

### Task 6: Apply Mapbox Tiles to RouteMap and Update Copy

**Files:**
- Modify: `client/src/components/RouteMap.jsx`
- Modify: `client/src/pages/RouteBuilderPage.jsx`
- Modify: `client/src/pages/RideScreenPage.jsx`

- [ ] **Step 1: Update RouteMap imports and tile config**

In `client/src/components/RouteMap.jsx`, add:

```js
import { getMapTileLayer } from "../mapConfig";
```

Delete the old tile constants:

```js
const STANDARD_TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const STANDARD_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const NAVIGATION_TILE_LAYER_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const NAVIGATION_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
```

Inside `RouteMap`, after `const mapClassName = ...`, add:

```js
const tileLayer = getMapTileLayer();
```

Replace the `TileLayer` JSX with:

```jsx
<TileLayer
  attribution={tileLayer.attribution}
  detectRetina={tileLayer.detectRetina}
  tileSize={tileLayer.tileSize}
  url={tileLayer.url}
/>
```

- [ ] **Step 2: Update route builder copy**

In `client/src/pages/RouteBuilderPage.jsx`, update `setGpsStatus` in `getSaveablePath`:

```js
setGpsStatus("Snapping recorded GPS to bike-friendly roads and trails...");
```

Update the catch fallback:

```js
setGpsStatus("Bike route matching was unavailable, so the raw GPS line will be saved.");
```

Update `buildRouteSaveMessage` strings:

```js
? `Route updated with ${providerLabel} bike route matching.`
```

```js
? `Route saved with ${providerLabel} bike route matching and your recorded ride was logged.`
```

```js
? `Route saved with ${providerLabel} bike route matching. Open the ride screen to follow it live.`
```

Update `formatRoutingProviderLabel`:

```js
if (source === "graphhopper") {
  return "GraphHopper";
}
```

Keep the existing Valhalla and OSRM labels.

- [ ] **Step 3: Rename local ride-screen functions for clarity**

In `client/src/pages/RideScreenPage.jsx`, rename:

```js
async function loadRoadRoute() {
```

to:

```js
async function loadBikeRoute() {
```

Update the call:

```js
void loadBikeRoute();
```

Rename:

```js
async function loadRoadPathToStart() {
```

to:

```js
async function loadBikePathToStart() {
```

Update the call:

```js
void loadBikePathToStart();
```

Update `formatRoutingProviderLabel` in this file to include GraphHopper:

```js
if (source === "graphhopper") {
  return "GraphHopper";
}
```

- [ ] **Step 4: Run tests and build**

Run:

```bash
npm run test -- client/src/mapConfig.test.js
npm run build
```

Expected: tests PASS and build succeeds.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/components/RouteMap.jsx client/src/pages/RouteBuilderPage.jsx client/src/pages/RideScreenPage.jsx
git commit -m "feat: render routes on Mapbox tiles"
```

---

### Task 7: Document Environment Setup and Verify End-to-End

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README routing provider section**

Replace the current routing provider block in `README.md` with:

````md
## Routing and Map Providers

The app uses a hybrid map setup:

- Mapbox renders the visible map tiles in the browser.
- GraphHopper calculates bike-friendly route geometry on the server.
- Valhalla remains a bike-safe fallback.
- OSRM is available for non-bike profiles and explicit debugging, but bike routes do not use OSRM by default.

```bash
ROUTING_PROVIDER=graphhopper
GRAPHHOPPER_API_KEY=your_graphhopper_key
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1
ALLOW_OSRM_BIKE_FALLBACK=false
VITE_MAPBOX_TOKEN=your_public_mapbox_token
VITE_MAPBOX_STYLE_URL=mapbox/streets-v12
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_BIKE_PROFILE=bike
ROUTING_TIMEOUT_MS=7000
```

`VITE_MAPBOX_TOKEN` is public by design and should be URL-restricted in Mapbox. `GRAPHHOPPER_API_KEY` must stay server-only.

For production use, set `GRAPHHOPPER_API_KEY` on the server environment and set `VITE_MAPBOX_TOKEN` during the client build. If GraphHopper and Valhalla both fail for a bike route, the client keeps using the saved route line instead of silently switching to a car-like route.
````

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test
npm run build
```

Expected: all Node tests PASS and Vite build succeeds.

- [ ] **Step 3: Start the dev server**

Run:

```bash
npm run dev
```

Expected:

```text
North Star Ridebook server running on port 3001
VITE ready
Local: http://localhost:5173/
```

- [ ] **Step 4: Verify health endpoint**

Run in a second shell:

```bash
curl http://localhost:3001/api/health
```

Expected:

```json
{"ok":true}
```

- [ ] **Step 5: Browser verification**

Open `http://localhost:5173/`.

Verify:

- Home page loads.
- Route cards render.
- Opening a route ride screen shows Mapbox-styled tiles when `VITE_MAPBOX_TOKEN` is configured.
- Without `VITE_MAPBOX_TOKEN`, the map still renders using OpenStreetMap fallback.
- Creating or recording a route still works.
- A bike route provider error falls back to the saved route line in the client.

- [ ] **Step 6: Commit**

Run:

```bash
git add README.md
git commit -m "docs: document hybrid map routing setup"
```

---

## Final Verification

After all tasks are complete, run:

```bash
git status --short
npm run test
npm run build
```

Expected:

- `npm run test` passes.
- `npm run build` passes.
- Only expected user-owned dirty files remain. Do not include `server/data/store.json` in any commit unless the user explicitly asks for it.

If API tokens are available, run a local route request through the app or with an authenticated browser session. If tokens are not available, verify provider selection and request construction through tests and note that live GraphHopper/Mapbox verification requires real credentials.
