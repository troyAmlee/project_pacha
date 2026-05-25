import assert from "node:assert/strict";
import test from "node:test";
import {
  computePathMilesExact,
  getGpsHeadingDegrees,
  getMovementHeadingDegrees,
  getRouteNavigationState
} from "./utils.js";

test("navigation resumes from the rider's current point when already on the route", () => {
  const routePath = [
    [44.95, -93.3],
    [44.955, -93.29],
    [44.96, -93.28]
  ];
  const currentPosition = [44.955, -93.29];
  const state = getRouteNavigationState(currentPosition, routePath);

  assert.equal(state.activeLeg, "route");
  assert.equal(state.snappedToRoute, true);
  assert.deepEqual(state.remainingPath[0], currentPosition);
  assert.ok(state.remainingMiles < computePathMilesExact(routePath));
  assert.ok(state.progressPercent > 40);
});

test("cached route-to-start guidance advances from the rider's current point", () => {
  const routePath = [
    [44.904, -93.3],
    [44.905, -93.3]
  ];
  const cachedToStartPath = [
    [44.9, -93.3],
    [44.901, -93.3],
    [44.902, -93.3],
    [44.903, -93.3],
    [44.904, -93.3]
  ];
  const currentPosition = [44.901, -93.3];
  const state = getRouteNavigationState(currentPosition, routePath, {
    toStartPath: cachedToStartPath
  });

  assert.equal(state.activeLeg, "to-start");
  assert.ok(state.activeLegDistanceMiles < 0.25);
  assert.ok(state.toStartPath.every(([lat]) => lat >= currentPosition[0]));
});

test("gps heading uses the browser course when available", () => {
  const position = {
    coords: {
      heading: 91.4
    }
  };

  assert.equal(getGpsHeadingDegrees(position), 91.4);
});

test("movement heading falls back to the bearing between GPS samples", () => {
  const previousPoint = [44.95, -93.3];
  const currentPoint = [44.955, -93.3];

  assert.equal(getMovementHeadingDegrees({ currentPoint, previousPoint }), 0);
});
