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
  assert.deepEqual(body.details, [
    "road_class",
    "road_environment",
    "road_access",
    "surface",
    "bike_network"
  ]);
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
