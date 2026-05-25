import assert from "node:assert/strict";
import test from "node:test";
import { resolveSaveablePath } from "./routeSaving.js";

test("drawn routes use bike routing geometry before saving", async () => {
  const rawPath = [
    [44.95, -93.3],
    [44.96, -93.28]
  ];
  const routedPath = [
    [44.95, -93.3],
    [44.951, -93.295],
    [44.956, -93.287],
    [44.96, -93.28]
  ];
  const routeCalls = [];
  const statuses = [];

  const result = await resolveSaveablePath({
    api: {
      async routePath(points, profile) {
        routeCalls.push({ points, profile });
        return { path: routedPath, source: "graphhopper" };
      }
    },
    mode: "draw",
    rawPath,
    setStatus: (value) => statuses.push(value),
    t: (key) => key
  });

  assert.deepEqual(result, { path: routedPath, matchSource: "graphhopper" });
  assert.deepEqual(routeCalls, [{ points: rawPath, profile: "bike" }]);
  assert.deepEqual(statuses, ["routeBuilder.routeSnapping"]);
});

test("drawn routes fall back to the sketched line when routing is unavailable", async () => {
  const rawPath = [
    [44.95, -93.3],
    [44.96, -93.28]
  ];
  const statuses = [];

  const result = await resolveSaveablePath({
    api: {
      async routePath() {
        throw new Error("provider unavailable");
      }
    },
    mode: "draw",
    rawPath,
    setStatus: (value) => statuses.push(value),
    t: (key) => key
  });

  assert.deepEqual(result, { path: rawPath, matchSource: null });
  assert.deepEqual(statuses, ["routeBuilder.routeSnapping", "routeBuilder.routeSnapFailed"]);
});

test("recorded routes still use bike map matching before saving", async () => {
  const rawPath = [
    [44.95, -93.3],
    [44.951, -93.295],
    [44.96, -93.28]
  ];
  const matchedPath = [
    [44.95, -93.3],
    [44.952, -93.294],
    [44.96, -93.28]
  ];
  const matchCalls = [];
  const statuses = [];

  const result = await resolveSaveablePath({
    api: {
      async matchPath(points, profile) {
        matchCalls.push({ points, profile });
        return { path: matchedPath, source: "graphhopper" };
      }
    },
    mode: "record",
    rawPath,
    setStatus: (value) => statuses.push(value),
    t: (key) => key
  });

  assert.deepEqual(result, { path: matchedPath, matchSource: "graphhopper" });
  assert.deepEqual(matchCalls, [{ points: rawPath, profile: "bike" }]);
  assert.deepEqual(statuses, ["routeBuilder.gpsSnapping"]);
});
