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
