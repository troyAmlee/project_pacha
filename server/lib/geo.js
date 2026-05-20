import { ValidationError } from "./validation.js";

const EARTH_RADIUS_MILES = 3958.8;
const DEGREES_TO_RADIANS = Math.PI / 180;

export function requireCoordinate(value, label = "Coordinate") {
  let lat;
  let lng;

  if (Array.isArray(value) && value.length >= 2) {
    [lat, lng] = value;
  } else if (value && typeof value === "object") {
    lat = value.lat;
    lng = value.lng;
  } else {
    throw new ValidationError(`${label} must include latitude and longitude.`);
  }

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    throw new ValidationError(`${label} must use numeric latitude and longitude values.`);
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    throw new ValidationError(`${label} must stay within valid map bounds.`);
  }

  return [roundCoordinate(parsedLat), roundCoordinate(parsedLng)];
}

export function requirePath(value, label = "Route path", options = {}) {
  const { minPoints = 2, maxPoints = 2000 } = options;

  if (!Array.isArray(value) || value.length < minPoints) {
    throw new ValidationError(`${label} must include at least ${minPoints} points.`);
  }

  if (value.length > maxPoints) {
    throw new ValidationError(`${label} must include ${maxPoints} points or fewer.`);
  }

  return value.map((point, index) => requireCoordinate(point, `${label} point ${index + 1}`));
}

export function pathDistanceMiles(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return 0;
  }

  let totalMiles = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalMiles += distanceBetweenPointsMiles(path[index - 1], path[index]);
  }

  return Number(totalMiles.toFixed(1));
}

export function distanceBetweenPointsMiles(left, right) {
  const [leftLat, leftLng] = left;
  const [rightLat, rightLng] = right;

  const deltaLat = (rightLat - leftLat) * DEGREES_TO_RADIANS;
  const deltaLng = (rightLng - leftLng) * DEGREES_TO_RADIANS;
  const leftRadians = leftLat * DEGREES_TO_RADIANS;
  const rightRadians = rightLat * DEGREES_TO_RADIANS;

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftRadians) * Math.cos(rightRadians) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}
