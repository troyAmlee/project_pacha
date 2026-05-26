export function formatDate(value, lang = "en") {
  const locale = lang === "es" ? "es-MX" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value, lang = "en") {
  const locale = lang === "es" ? "es-MX" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMiles(value) {
  const distance = Number(value);

  if (Number.isNaN(distance)) {
    return "0 mi";
  }

  return `${distance % 1 === 0 ? distance.toFixed(0) : distance.toFixed(1)} mi`;
}

export function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function toTitleCase(value) {
  if (!value) {
    return "";
  }

  return value[0].toUpperCase() + value.slice(1);
}

export function formatDurationMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${remainder} min`;
  }

  if (!remainder) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainder} min`;
}

export const MINNEAPOLIS_CENTER = [44.9778, -93.265];
export const GPS_CAPTURE_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 500,
  timeout: 8000
};
export const GPS_PATH_MIN_DISTANCE_MILES = 0.004;
export const GPS_PATH_CORNER_MIN_DISTANCE_MILES = 0.0015;
export const GPS_PATH_CORNER_DEGREES = 18;
export const NAVIGATION_SNAP_TO_ROUTE_MILES = 0.08;
export const NAVIGATION_START_REACHED_MILES = 0.04;
const METERS_PER_MILE = 1609.344;
const NAVIGATION_STEP_NOW_MILES = 0.03;
const NAVIGATION_STEP_LOOKAHEAD_MILES = 0.25;
export const MIDTOWN_GREENWAY_PATH = [
  [44.9508, -93.2605],
  [44.9501, -93.2684],
  [44.9495, -93.2769],
  [44.9491, -93.2867],
  [44.9489, -93.2958],
  [44.9475, -93.3048],
  [44.9455, -93.3136],
  [44.9442, -93.3205]
];

export function computePathMiles(path) {
  return Number(computePathMilesExact(path).toFixed(1));
}

export function computePathMilesExact(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return 0;
  }

  let totalMiles = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalMiles += distanceBetweenPointsMiles(path[index - 1], path[index]);
  }

  return totalMiles;
}

export function distanceBetweenPointsMiles(left, right) {
  const [leftLat, leftLng] = left;
  const [rightLat, rightLng] = right;
  const degreesToRadians = Math.PI / 180;
  const earthRadiusMiles = 3958.8;

  const deltaLat = (rightLat - leftLat) * degreesToRadians;
  const deltaLng = (rightLng - leftLng) * degreesToRadians;
  const leftRadians = leftLat * degreesToRadians;
  const rightRadians = rightLat * degreesToRadians;

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftRadians) * Math.cos(rightRadians) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(haversine));
}

export function gpsPositionToPoint(position) {
  return [
    Number(position.coords.latitude.toFixed(6)),
    Number(position.coords.longitude.toFixed(6))
  ];
}

export function getGpsAccuracyMeters(position, fallback = 45) {
  if (!Number.isFinite(position.coords.accuracy)) {
    return fallback;
  }

  return Math.min(140, Math.max(5, Math.round(position.coords.accuracy)));
}

export function getGpsHeadingDegrees(position) {
  const heading = Number(position?.coords?.heading);

  if (!Number.isFinite(heading) || heading < 0) {
    return null;
  }

  return normalizeHeadingDegrees(heading);
}

export function getMovementHeadingDegrees({ currentPoint, previousPoint, gpsPosition }) {
  const gpsHeading = getGpsHeadingDegrees(gpsPosition);

  if (gpsHeading !== null) {
    return gpsHeading;
  }

  if (!currentPoint || !previousPoint) {
    return null;
  }

  if (distanceBetweenPointsMiles(previousPoint, currentPoint) < GPS_PATH_CORNER_MIN_DISTANCE_MILES) {
    return null;
  }

  return normalizeHeadingDegrees(getBearingDegrees(previousPoint, currentPoint));
}

export function formatNavigationDistance(value) {
  const miles = Math.max(0, Number(value) || 0);

  if (miles < 0.01) {
    return "now";
  }

  if (miles < 0.1) {
    return `${Math.max(20, Math.round((miles * 5280) / 10) * 10)} ft`;
  }

  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles)} mi`;
}

export function shouldAddGpsPoint(path, point) {
  if (!Array.isArray(path) || path.length === 0) {
    return true;
  }

  const lastPoint = path[path.length - 1];
  const distanceFromLast = distanceBetweenPointsMiles(lastPoint, point);

  if (distanceFromLast >= GPS_PATH_MIN_DISTANCE_MILES) {
    return true;
  }

  if (path.length < 2 || distanceFromLast < GPS_PATH_CORNER_MIN_DISTANCE_MILES) {
    return false;
  }

  return getTurnAngleDegrees(path[path.length - 2], lastPoint, point) >= GPS_PATH_CORNER_DEGREES;
}

export function getPathCenter(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return MINNEAPOLIS_CENTER;
  }

  const totals = path.reduce(
    (current, point) => [current[0] + point[0], current[1] + point[1]],
    [0, 0]
  );

  return [totals[0] / path.length, totals[1] / path.length];
}

export function getRoutingWaypoints(path, maxPoints = 24) {
  if (!Array.isArray(path) || path.length <= maxPoints) {
    return Array.isArray(path) ? path : [];
  }

  const lastIndex = path.length - 1;
  const step = lastIndex / (maxPoints - 1);
  const pickedIndexes = new Set([0, lastIndex]);

  for (let index = 1; index < maxPoints - 1; index += 1) {
    pickedIndexes.add(Math.round(index * step));
  }

  return [...pickedIndexes]
    .sort((left, right) => left - right)
    .map((index) => path[index]);
}

export function getDirectedRoutePath(path, direction = "forward") {
  if (!Array.isArray(path)) {
    return [];
  }

  return direction === "reverse" ? [...path].reverse() : path;
}

export function getRouteNavigationState(currentPosition, path, options = {}) {
  if (!Array.isArray(path) || path.length < 2) {
    return null;
  }

  const sourceRoutePath =
    Array.isArray(options.plannedRoutePath) && options.plannedRoutePath.length >= 2
      ? options.plannedRoutePath
      : path;
  const plannedRoutePath = options.routeLegStartPoint
    ? findShortestPathFromRoutePoint(
        sourceRoutePath,
        options.routeLegStartPoint,
        sourceRoutePath[sourceRoutePath.length - 1]
      )
    : Array.isArray(options.plannedRoutePath) && options.plannedRoutePath.length >= 2
      ? options.plannedRoutePath
      : findShortestPathOnRouteGraph(path, path[0], path[path.length - 1]);
  const routeMiles = computePathMilesExact(plannedRoutePath);
  const startPoint = plannedRoutePath[0];
  const finishPoint = plannedRoutePath[plannedRoutePath.length - 1];
  const routingSource = options.routingSource ?? "local";
  const routeSteps = Array.isArray(options.routeSteps) ? options.routeSteps : [];
  const toStartSteps = Array.isArray(options.toStartSteps) ? options.toStartSteps : [];

  if (!currentPosition) {
    return {
      activeLeg: "to-start",
      activeLegDistanceMiles: 0,
      completedPath: [],
      cue: {
        primary: "Head to start",
        secondary: "Start GPS guidance at the saved route start.",
        type: "start"
      },
      displayPosition: null,
      headingDegrees: getBearingDegrees(plannedRoutePath[0], plannedRoutePath[1]),
      offRouteMiles: null,
      plannedRoutePath,
      progressPercent: 0,
      remainingMiles: routeMiles,
      remainingPath: plannedRoutePath,
      routingSource,
      snappedToRoute: false,
      toStartPath: []
    };
  }

  const toStartPath = getToStartPath(currentPosition, startPoint, plannedRoutePath, options.toStartPath);
  const toStartMiles = computePathMilesExact(toStartPath);
  // Inflate the geofence by the GPS accuracy radius so the leg transition
  // fires when the rider's accuracy bubble overlaps the start, instead of
  // requiring the (often jittery) reported point to land inside a 65m circle.
  const accuracyMiles =
    Number.isFinite(options.accuracyMeters) && options.accuracyMeters > 0
      ? options.accuracyMeters / METERS_PER_MILE
      : 0;
  const startReached = toStartMiles <= NAVIGATION_START_REACHED_MILES + accuracyMiles;
  const closest = getClosestPointOnPath(currentPosition, plannedRoutePath);
  const snappedToRoute = closest.distanceMiles <= NAVIGATION_SNAP_TO_ROUTE_MILES + accuracyMiles;

  if (!startReached && !snappedToRoute) {
    const toStartClosest = getClosestPointOnPath(currentPosition, toStartPath);
    // Live remaining distance to the route start: the cached path's total
    // length minus how far the rider has progressed along it. Updates every
    // GPS tick instead of waiting for the next 0.1mi GraphHopper refresh.
    const liveToStartMiles = Math.max(
      0,
      toStartMiles - toStartClosest.distanceAlongPathMiles
    );
    const liveToStartPath = compactPath([
      toStartClosest.point,
      ...toStartPath.slice(toStartClosest.segmentIndex + 1)
    ]);
    const fallbackToStartCue = {
      distanceMiles: liveToStartMiles,
      primary: `Head to start in ${formatNavigationDistance(liveToStartMiles)}`,
      secondary: "Head to the saved route start first.",
      type: "start"
    };

    return {
      activeLeg: "to-start",
      activeLegDistanceMiles: liveToStartMiles,
      closestPoint: closest.point,
      completedPath: [],
      cue: getRoutedStepCue(toStartPath, toStartClosest, liveToStartMiles, toStartSteps, {
        activeLeg: "to-start",
        fallbackCue: fallbackToStartCue
      }),
      displayPosition: currentPosition,
      headingDegrees: getBearingDegrees(currentPosition, toStartPath[1] ?? startPoint),
      offRouteMiles: Number(closest.distanceMiles.toFixed(2)),
      plannedRoutePath,
      progressPercent: 0,
      remainingMiles: liveToStartMiles + routeMiles,
      remainingPath: plannedRoutePath,
      routingSource,
      segmentIndex: 0,
      snappedToRoute: false,
      startPoint,
      finishPoint,
      toStartPath: liveToStartPath,
      toStartSource: options.toStartSource ?? "local"
    };
  }

  const displayPosition = snappedToRoute ? closest.point : currentPosition;
  const remainingMiles = Math.max(0, routeMiles - closest.distanceAlongPathMiles);
  const completedPath = compactPath([
    ...plannedRoutePath.slice(0, closest.segmentIndex + 1),
    closest.point
  ]);
  const remainingPath = compactPath([
    closest.point,
    ...plannedRoutePath.slice(closest.segmentIndex + 1)
  ]);
  const nextPoint = remainingPath[1] ?? remainingPath[0] ?? finishPoint;
  const fallbackRouteCue = getNextNavigationCue(plannedRoutePath, closest, remainingMiles);

  return {
    activeLeg: "route",
    activeLegDistanceMiles: remainingMiles,
    closestPoint: closest.point,
    completedPath,
    cue: getRoutedStepCue(plannedRoutePath, closest, remainingMiles, routeSteps, {
      activeLeg: "route",
      fallbackCue: fallbackRouteCue
    }),
    displayPosition,
    headingDegrees: snappedToRoute
      ? getBearingDegrees(displayPosition, nextPoint)
      : getBearingDegrees(currentPosition, closest.point),
    offRouteMiles: Number(closest.distanceMiles.toFixed(2)),
    plannedRoutePath,
    progressPercent: routeMiles
      ? Math.min(100, Math.max(0, (closest.distanceAlongPathMiles / routeMiles) * 100))
      : 0,
    remainingMiles,
    remainingPath,
    routingSource,
    segmentIndex: closest.segmentIndex,
    snappedToRoute,
    startPoint,
    finishPoint,
    toStartPath: []
  };
}

export function distanceFromPointToPathMiles(point, path) {
  if (!Array.isArray(path) || path.length === 0) {
    return null;
  }

  if (path.length === 1) {
    return Number(distanceBetweenPointsMiles(point, path[0]).toFixed(2));
  }

  let closest = Infinity;

  for (let index = 1; index < path.length; index += 1) {
    closest = Math.min(closest, distanceFromPointToSegmentMiles(point, path[index - 1], path[index]));
  }

  return Number(closest.toFixed(2));
}

export function isGreenwayRoute(route) {
  if (!route) {
    return false;
  }

  return (
    route.terrain === "greenway" ||
    /greenway/i.test(route.title || "") ||
    /greenway/i.test(route.start || "") ||
    /greenway/i.test(route.notes || "")
  );
}

export function getRouteTheme(route) {
  if (isGreenwayRoute(route)) {
    return {
      accent: "#06a77d",
      accentSoft: "rgba(6, 167, 125, 0.18)",
      lineGlow: "rgba(6, 167, 125, 0.36)",
      badgeKey: "routeMap.badgeGreenway",
      guideLabel: "Midtown Greenway"
    };
  }

  if (route?.terrain === "gravel" || route?.terrain === "mixed surface") {
    return {
      accent: "#f4a261",
      accentSoft: "rgba(244, 162, 97, 0.18)",
      lineGlow: "rgba(244, 162, 97, 0.32)",
      badgeKey: "routeMap.badgeMixed",
      guideLabel: "Long pull"
    };
  }

  return {
    accent: "#e63946",
    accentSoft: "rgba(230, 57, 70, 0.16)",
    lineGlow: "rgba(230, 57, 70, 0.22)",
    badgeKey: "routeMap.badgeCity",
    guideLabel: "River loop"
  };
}

export function getSuggestedRoutes(routes, currentRouteId = null) {
  const pool = Array.isArray(routes)
    ? routes.filter((route) => route && route.id !== currentRouteId)
    : [];

  const picks = [];
  const seen = new Set();

  function addPick(route, suggestionLabel, suggestionNote) {
    if (!route || seen.has(route.id)) {
      return;
    }

    seen.add(route.id);
    picks.push({ ...route, suggestionLabel, suggestionNote });
  }

  const newestFirst = [...pool].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  const greenwayRoute = newestFirst.find((route) => isGreenwayRoute(route));
  const riverRoute = newestFirst.find(
    (route) =>
      route.terrain === "city streets" &&
      /river|stone arch|mississippi/i.test(`${route.title} ${route.start} ${route.notes}`)
  );
  const longRoute = newestFirst
    .filter((route) => route.distanceMiles >= 14)
    .sort((left, right) => Number(right.distanceMiles) - Number(left.distanceMiles))[0];

  addPick(
    greenwayRoute,
    "Best first ride",
    "Smooth, forgiving mileage with the Greenway guide layered right on the map."
  );
  addPick(
    riverRoute,
    "Minneapolis classic",
    "A good city-line ride when you want landmarks, bridges, and an easy read of the route."
  );
  addPick(
    longRoute,
    "Longer training pull",
    "More distance, fewer repeated turns, and a better option when the group wants a bigger day."
  );

  for (const route of newestFirst) {
    if (picks.length >= 3) {
      break;
    }

    addPick(
      route,
      route.distanceMiles <= 12 ? "Quick spin" : "Club favorite",
      route.distanceMiles <= 12
        ? "A shorter option when you want a route that is easy to load and follow."
        : "Shared recently by the club and ready to open in the ride screen."
    );
  }

  return picks.slice(0, 3);
}

function distanceFromPointToSegmentMiles(point, segmentStart, segmentEnd) {
  const referenceLatitude = ((segmentStart[0] + segmentEnd[0]) / 2) * (Math.PI / 180);
  const milesPerLatitudeDegree = 69.0;
  const milesPerLongitudeDegree = 69.172 * Math.cos(referenceLatitude);

  const projectedPoint = projectPoint(point, milesPerLatitudeDegree, milesPerLongitudeDegree);
  const projectedStart = projectPoint(
    segmentStart,
    milesPerLatitudeDegree,
    milesPerLongitudeDegree
  );
  const projectedEnd = projectPoint(segmentEnd, milesPerLatitudeDegree, milesPerLongitudeDegree);

  const segmentVector = [
    projectedEnd[0] - projectedStart[0],
    projectedEnd[1] - projectedStart[1]
  ];
  const pointVector = [
    projectedPoint[0] - projectedStart[0],
    projectedPoint[1] - projectedStart[1]
  ];
  const segmentLengthSquared = segmentVector[0] ** 2 + segmentVector[1] ** 2;

  if (!segmentLengthSquared) {
    return Math.hypot(pointVector[0], pointVector[1]);
  }

  const projectionRatio = Math.max(
    0,
    Math.min(
      1,
      (pointVector[0] * segmentVector[0] + pointVector[1] * segmentVector[1]) /
        segmentLengthSquared
    )
  );

  const closestPoint = [
    projectedStart[0] + segmentVector[0] * projectionRatio,
    projectedStart[1] + segmentVector[1] * projectionRatio
  ];

  return Math.hypot(projectedPoint[0] - closestPoint[0], projectedPoint[1] - closestPoint[1]);
}

function getClosestPointOnPath(point, path) {
  let closest = null;
  let distanceBeforeSegment = 0;

  for (let index = 1; index < path.length; index += 1) {
    const segmentStart = path[index - 1];
    const segmentEnd = path[index];
    const segmentDistanceMiles = distanceBetweenPointsMiles(segmentStart, segmentEnd);
    const projection = projectPointToSegmentLatLng(point, segmentStart, segmentEnd);
    const distanceMiles = distanceBetweenPointsMiles(point, projection.point);

    if (!closest || distanceMiles < closest.distanceMiles) {
      closest = {
        distanceAlongPathMiles: distanceBeforeSegment + segmentDistanceMiles * projection.ratio,
        distanceMiles,
        point: projection.point,
        segmentIndex: index - 1
      };
    }

    distanceBeforeSegment += segmentDistanceMiles;
  }

  return closest;
}

function projectPointToSegmentLatLng(point, segmentStart, segmentEnd) {
  const referenceLatitude = ((segmentStart[0] + segmentEnd[0]) / 2) * (Math.PI / 180);
  const milesPerLatitudeDegree = 69.0;
  const milesPerLongitudeDegree = 69.172 * Math.cos(referenceLatitude);

  const projectedPoint = projectPoint(point, milesPerLatitudeDegree, milesPerLongitudeDegree);
  const projectedStart = projectPoint(
    segmentStart,
    milesPerLatitudeDegree,
    milesPerLongitudeDegree
  );
  const projectedEnd = projectPoint(segmentEnd, milesPerLatitudeDegree, milesPerLongitudeDegree);
  const segmentVector = [
    projectedEnd[0] - projectedStart[0],
    projectedEnd[1] - projectedStart[1]
  ];
  const pointVector = [
    projectedPoint[0] - projectedStart[0],
    projectedPoint[1] - projectedStart[1]
  ];
  const segmentLengthSquared = segmentVector[0] ** 2 + segmentVector[1] ** 2;
  const ratio = segmentLengthSquared
    ? Math.max(
        0,
        Math.min(
          1,
          (pointVector[0] * segmentVector[0] + pointVector[1] * segmentVector[1]) /
            segmentLengthSquared
        )
      )
    : 0;

  return {
    point: [
      Number(((projectedStart[1] + segmentVector[1] * ratio) / milesPerLatitudeDegree).toFixed(6)),
      Number(((projectedStart[0] + segmentVector[0] * ratio) / milesPerLongitudeDegree).toFixed(6))
    ],
    ratio
  };
}

function projectPoint([lat, lng], milesPerLatitudeDegree, milesPerLongitudeDegree) {
  return [lng * milesPerLongitudeDegree, lat * milesPerLatitudeDegree];
}

function findShortestPathOnRouteGraph(path, startPoint, finishPoint) {
  const graph = buildRouteGraph(path);
  const startKey = coordinateKey(startPoint);
  const finishKey = coordinateKey(finishPoint);
  const bfsPath = findBreadthFirstPath(graph, startKey, finishKey);

  return bfsPath.length >= 2 ? bfsPath : path;
}

function findShortestPathToRouteStart(currentPosition, plannedRoutePath) {
  const routeStart = plannedRoutePath[0];
  const graph = buildRouteGraph(plannedRoutePath);
  const currentKey = addGraphNode(graph, currentPosition);
  const routeStartKey = coordinateKey(routeStart);

  addGraphEdge(graph, currentKey, routeStartKey);

  const bfsPath = findBreadthFirstPath(graph, currentKey, routeStartKey);

  return bfsPath.length >= 2 ? bfsPath : [currentPosition, routeStart];
}

function findShortestPathFromRoutePoint(path, startPoint, finishPoint) {
  const graph = buildRouteGraph(path);
  const closest = getClosestPointOnPath(startPoint, path);
  const startKey = addGraphNode(graph, closest.point);
  const segmentStartKey = addGraphNode(graph, path[closest.segmentIndex]);
  const segmentEndKey = addGraphNode(graph, path[closest.segmentIndex + 1]);
  const finishKey = coordinateKey(finishPoint);

  addGraphEdge(graph, startKey, segmentStartKey);
  addGraphEdge(graph, startKey, segmentEndKey);

  const bfsPath = findBreadthFirstPath(graph, startKey, finishKey);

  return bfsPath.length >= 2 ? bfsPath : path;
}

function getToStartPath(currentPosition, startPoint, plannedRoutePath, routedToStartPath) {
  if (Array.isArray(routedToStartPath) && routedToStartPath.length >= 2) {
    const closest = getClosestPointOnPath(currentPosition, routedToStartPath);
    return compactPath([
      currentPosition,
      closest.point,
      ...routedToStartPath.slice(closest.segmentIndex + 1),
      startPoint
    ]);
  }

  return findShortestPathToRouteStart(currentPosition, plannedRoutePath);
}

function buildRouteGraph(path) {
  const graph = {
    adjacency: new Map(),
    pointsByKey: new Map()
  };
  let previousKey = null;

  for (const point of path) {
    const key = addGraphNode(graph, point);

    if (previousKey) {
      addGraphEdge(graph, previousKey, key);
    }

    previousKey = key;
  }

  return graph;
}

function findBreadthFirstPath(graph, startKey, finishKey) {
  if (!graph.pointsByKey.has(startKey) || !graph.pointsByKey.has(finishKey)) {
    return [];
  }

  const queue = [startKey];
  const visited = new Set([startKey]);
  const previousByKey = new Map();

  while (queue.length) {
    const currentKey = queue.shift();

    if (currentKey === finishKey) {
      return reconstructGraphPath(graph, previousByKey, finishKey);
    }

    for (const nextKey of graph.adjacency.get(currentKey) ?? []) {
      if (visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      previousByKey.set(nextKey, currentKey);
      queue.push(nextKey);
    }
  }

  return [];
}

function reconstructGraphPath(graph, previousByKey, finishKey) {
  const pathKeys = [finishKey];
  let cursor = finishKey;

  while (previousByKey.has(cursor)) {
    cursor = previousByKey.get(cursor);
    pathKeys.push(cursor);
  }

  return pathKeys.reverse().map((key) => graph.pointsByKey.get(key));
}

function addGraphNode(graph, point) {
  const key = coordinateKey(point);

  if (!graph.pointsByKey.has(key)) {
    graph.pointsByKey.set(key, point);
    graph.adjacency.set(key, []);
  }

  return key;
}

function addGraphEdge(graph, leftKey, rightKey) {
  addGraphEdgeDirection(graph, leftKey, rightKey);
  addGraphEdgeDirection(graph, rightKey, leftKey);
}

function addGraphEdgeDirection(graph, leftKey, rightKey) {
  const neighbors = graph.adjacency.get(leftKey);

  if (neighbors && !neighbors.includes(rightKey)) {
    neighbors.push(rightKey);
  }
}

function coordinateKey(point) {
  return `${Number(point[0]).toFixed(6)},${Number(point[1]).toFixed(6)}`;
}

function getRoutedStepCue(path, closest, remainingMiles, steps, options = {}) {
  const fallbackCue = options.fallbackCue ?? getNextNavigationCue(path, closest, remainingMiles);

  if (!closest || !Array.isArray(steps) || steps.length === 0) {
    return fallbackCue;
  }

  const nextStep = getNextRoutedStep(path, closest, steps);

  if (!nextStep) {
    return fallbackCue;
  }

  const distanceToStep = Math.max(
    0,
    nextStep.distanceAlongPathMiles - closest.distanceAlongPathMiles
  );
  const step = nextStep.step;
  const instruction = cleanInstruction(step.instruction || step.voiceInstruction || fallbackCue.primary);
  const voiceInstruction = cleanInstruction(step.voiceInstruction || instruction);
  const distanceLabel = formatNavigationDistance(distanceToStep);
  const primary =
    distanceToStep <= NAVIGATION_STEP_NOW_MILES
      ? instruction
      : `${stripTrailingPunctuation(instruction)} in ${distanceLabel}`;
  const secondary =
    step.name && step.type !== "arrive"
      ? `Next street: ${step.name}. ${formatNavigationDistance(remainingMiles)} left.`
      : fallbackCue.secondary ?? `${formatNavigationDistance(remainingMiles)} left.`;

  return {
    distanceMiles: Number(distanceToStep.toFixed(2)),
    primary,
    secondary,
    stepIndex: nextStep.index,
    streetName: step.name ?? "",
    type: step.type || inferCueType(instruction, fallbackCue.type),
    voiceInstruction:
      distanceToStep <= NAVIGATION_STEP_NOW_MILES
        ? voiceInstruction
        : `In ${distanceLabel}, ${voiceInstruction}`,
    voiceKey: [
      options.activeLeg ?? "route",
      nextStep.index,
      step.type || "",
      step.name || "",
      stripTrailingPunctuation(voiceInstruction).toLowerCase()
    ].join("|")
  };
}

function getNextRoutedStep(path, closest, steps) {
  const candidates = [];

  steps.forEach((step, index) => {
    if (!Array.isArray(step.location) || step.location.length !== 2) {
      return;
    }

    const stepPosition = getClosestPointOnPath(step.location, path);

    if (!stepPosition) {
      return;
    }

    if (step.type === "depart" && closest.distanceAlongPathMiles > NAVIGATION_STEP_NOW_MILES) {
      return;
    }

    if (stepPosition.distanceAlongPathMiles < closest.distanceAlongPathMiles - 0.01) {
      return;
    }

    candidates.push({
      distanceAlongPathMiles: stepPosition.distanceAlongPathMiles,
      index,
      step
    });
  });

  return candidates.sort((left, right) => {
    return left.distanceAlongPathMiles - right.distanceAlongPathMiles;
  })[0];
}

function cleanInstruction(value) {
  return String(value || "Continue")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTrailingPunctuation(value) {
  return cleanInstruction(value).replace(/[.!?]+$/, "");
}

function inferCueType(instruction, fallbackType = "continue") {
  if (/arrive|destination|finish/i.test(instruction)) {
    return "arrive";
  }

  if (/left|right|turn|bear|sharp/i.test(instruction)) {
    return "turn";
  }

  return fallbackType;
}

function getNextNavigationCue(path, closest, remainingMiles) {
  if (remainingMiles < 0.03) {
    return {
      primary: "Arrive at finish",
      secondary: "Finish is just ahead.",
      type: "arrive"
    };
  }

  for (let index = closest.segmentIndex + 1; index < path.length - 1; index += 1) {
    const signedAngle = getSignedTurnAngleDegrees(path[index - 1], path[index], path[index + 1]);

    if (Math.abs(signedAngle) < 22) {
      continue;
    }

    const distanceToTurn = getDistanceToPathIndex(closest.point, path, closest.segmentIndex, index);
    const direction = signedAngle > 0 ? "right" : "left";
    const turnStrength =
      Math.abs(signedAngle) >= 135 ? "Sharp" : Math.abs(signedAngle) >= 55 ? "Turn" : "Bear";
    const primary =
      distanceToTurn < 0.03
        ? `${turnStrength} ${direction} now`
        : `${turnStrength} ${direction} in ${formatNavigationDistance(distanceToTurn)}`;

    return {
      distanceMiles: distanceToTurn,
      primary,
      secondary: "Stay on the saved route line.",
      type: "turn"
    };
  }

  return {
    distanceMiles: remainingMiles,
    primary: "Continue on route",
    secondary: `Finish in ${formatNavigationDistance(remainingMiles)}.`,
    type: "continue"
  };
}

function getDistanceToPathIndex(fromPoint, path, segmentIndex, targetIndex) {
  let distance = 0;
  let cursor = fromPoint;

  for (let index = segmentIndex + 1; index <= targetIndex; index += 1) {
    distance += distanceBetweenPointsMiles(cursor, path[index]);
    cursor = path[index];
  }

  return distance;
}

export function getBearingDegrees(start, end) {
  if (!start || !end) {
    return 0;
  }

  const degreesToRadians = Math.PI / 180;
  const radiansToDegrees = 180 / Math.PI;
  const startLat = start[0] * degreesToRadians;
  const endLat = end[0] * degreesToRadians;
  const deltaLng = (end[1] - start[1]) * degreesToRadians;
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (Math.atan2(y, x) * radiansToDegrees + 360) % 360;
}

export function normalizeHeadingDegrees(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Number((((Number(value) % 360) + 360) % 360).toFixed(3));
}

function getSignedTurnAngleDegrees(previousPoint, currentPoint, nextPoint) {
  return normalizeDegrees(
    getBearingDegrees(currentPoint, nextPoint) - getBearingDegrees(previousPoint, currentPoint)
  );
}

function normalizeDegrees(value) {
  return ((value + 540) % 360) - 180;
}

function compactPath(path) {
  return path.filter((point, index) => {
    const previous = path[index - 1];
    return !previous || previous[0] !== point[0] || previous[1] !== point[1];
  });
}

function getTurnAngleDegrees(previousPoint, currentPoint, nextPoint) {
  const incoming = [
    currentPoint[1] - previousPoint[1],
    currentPoint[0] - previousPoint[0]
  ];
  const outgoing = [
    nextPoint[1] - currentPoint[1],
    nextPoint[0] - currentPoint[0]
  ];
  const incomingLength = Math.hypot(incoming[0], incoming[1]);
  const outgoingLength = Math.hypot(outgoing[0], outgoing[1]);

  if (!incomingLength || !outgoingLength) {
    return 0;
  }

  const cosine = Math.max(
    -1,
    Math.min(
      1,
      (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) /
        (incomingLength * outgoingLength)
    )
  );

  return (Math.acos(cosine) * 180) / Math.PI;
}
