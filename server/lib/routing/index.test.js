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
