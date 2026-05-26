import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from "../i18n";
import {
  formatNavigationDistance,
  getPathCenter,
  getRouteNavigationState,
  MIDTOWN_GREENWAY_PATH,
  MINNEAPOLIS_CENTER
} from "../utils";

const EMPTY_PATH = [];
const DEFAULT_PITCH = 60;
const DEFAULT_BEARING = 0;
const FOLLOW_ZOOM = 17;
const OVERVIEW_ZOOM = 14;
const MIN_FOLLOW_ZOOM = 14;
const MAX_FOLLOW_ZOOM = 20;
// Bearing snaps below this delta would create visible jitter on every GPS/sensor tick.
const BEARING_EPSILON_DEG = 2;

export default function NavigationMap({
  path = [],
  trail = [],
  currentPosition = null,
  currentAccuracyMeters = 45,
  movementHeadingDegrees = null,
  navigationState = null,
  tracking = false,
  height = 640,
  className = "",
  routeName = "",
  startLabel = "",
  terrain = "",
  showGreenwayGuide = false,
  homePoint = null
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const startMarkerRef = useRef(null);
  const finishMarkerRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const riderEl = useRef(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [bearingMode, setBearingMode] = useState("route");
  const [followZoom, setFollowZoom] = useState(FOLLOW_ZOOM);
  const compass = useDeviceCompass(bearingMode === "compass");

  // Drop back to route-bearing if the device can't (or won't) give us compass.
  useEffect(() => {
    if (
      bearingMode === "compass" &&
      (compass.permissionState === "denied" || compass.permissionState === "unsupported")
    ) {
      setBearingMode("route");
    }
  }, [bearingMode, compass.permissionState]);

  const handleRouteBearingSelect = useCallback(() => {
    setBearingMode("route");
  }, []);

  const handleCompassBearingSelect = useCallback(async () => {
    if (bearingMode === "compass") return;
    const granted = await compass.requestPermission();
    if (granted) setBearingMode("compass");
  }, [bearingMode, compass]);

  const computedNavigationState =
    navigationState ?? getRouteNavigationState(currentPosition, path);
  const displayPosition = computedNavigationState?.displayPosition ?? currentPosition;
  const routeHeadingDegrees = computedNavigationState?.headingDegrees ?? 0;
  const activeHeadingDegrees =
    bearingMode === "compass" && compass.heading != null
      ? compass.heading
      : movementHeadingDegrees ?? routeHeadingDegrees;
  const plannedRoutePath = computedNavigationState?.plannedRoutePath ?? path;
  const toStartPath = computedNavigationState?.toStartPath ?? EMPTY_PATH;
  const remainingPath = computedNavigationState?.remainingPath ?? path;
  const activeNavigationPath =
    computedNavigationState?.activeLeg === "to-start" ? toStartPath : remainingPath;
  const offRoutePath =
    currentPosition &&
    computedNavigationState?.closestPoint &&
    computedNavigationState.activeLeg === "route" &&
    !computedNavigationState.snappedToRoute
      ? [currentPosition, computedNavigationState.closestPoint]
      : EMPTY_PATH;
  const startMarkerPosition = computedNavigationState?.startPoint ?? path[0];
  const finishMarkerPosition =
    computedNavigationState?.finishPoint ?? path[path.length - 1];
  const guideVisible = showGreenwayGuide || terrain === "greenway";

  const navigationCue =
    computedNavigationState?.cue ??
    (tracking
      ? {
          primary: t("rideScreen.headlineWaitingGps"),
          secondary: t("rideScreen.detailWaitingGps"),
          type: "start"
        }
      : {
          primary: t("rideScreen.headlineGuidanceReady"),
          secondary: t("rideScreen.detailGuidanceReady"),
          type: "start"
        });
  const remainingLabel = computedNavigationState
    ? formatNavigationDistance(computedNavigationState.remainingMiles)
    : "--";
  const progressPercent = Math.round(computedNavigationState?.progressPercent ?? 0);
  const activeLegLabel =
    computedNavigationState?.activeLeg === "to-start"
      ? t("rideScreen.cueActiveLeg", {
          miles: formatNavigationDistance(computedNavigationState.activeLegDistanceMiles)
        })
      : `${progressPercent}%`;
  const routeStatusLabel = !currentPosition
    ? t("rideScreen.headlineGuidanceReady")
    : computedNavigationState?.snappedToRoute
      ? t("rideScreen.cueRoutingFallback")
      : t("rideScreen.headlineReturnRoute");
  const cueDirection = /left|izquierda/i.test(navigationCue.primary)
    ? "left"
    : /right|derecha/i.test(navigationCue.primary)
      ? "right"
      : navigationCue.type;

  const initialCenter = useMemo(() => {
    const seed = path.length
      ? path
      : currentPosition
        ? [currentPosition]
        : Array.isArray(homePoint) && homePoint.length === 2
          ? [homePoint]
          : [];
    return getPathCenter(seed) || MINNEAPOLIS_CENTER;
  }, []); // intentionally fixed at mount

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const token = (import.meta.env?.VITE_MAPBOX_TOKEN || "").trim();
    // Force streets-v11 (Mapbox Style Spec v8). streets-v12 is v3-spec and
    // includes properties MapLibre's validator rejects, leaving the canvas blank.
    const style = resolveMapboxStyleUrl("mapbox://styles/mapbox/streets-v11", token);

    if (!style) {
      console.warn("NavigationMap requires VITE_MAPBOX_TOKEN to be set.");
      return undefined;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [initialCenter[1], initialCenter[0]],
      zoom: OVERVIEW_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      antialias: true,
      attributionControl: { compact: true },
      transformRequest: (url) => rewriteMapboxUrl(url, token)
    });

    const handleZoomEnd = (event) => {
      if (event.originalEvent) {
        setFollowZoom(clampZoom(map.getZoom()));
      }
    };

    map.on("style.load", () => {
      ensureSourcesAndLayers(map);
      setStyleLoaded(true);
    });
    map.on("zoomend", handleZoomEnd);

    mapRef.current = map;

    return () => {
      map.off("zoomend", handleZoomEnd);
      map.remove();
      mapRef.current = null;
      startMarkerRef.current = null;
      finishMarkerRef.current = null;
      riderMarkerRef.current = null;
      setStyleLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setLineData(mapRef.current, "route-planned", plannedRoutePath);
  }, [styleLoaded, plannedRoutePath]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setLineData(mapRef.current, "route-active", activeNavigationPath);
  }, [styleLoaded, activeNavigationPath]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setLineData(mapRef.current, "route-offroute", offRoutePath);
  }, [styleLoaded, offRoutePath]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setLineData(mapRef.current, "route-trail", trail);
  }, [styleLoaded, trail]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setLineData(mapRef.current, "route-guide", guideVisible ? MIDTOWN_GREENWAY_PATH : EMPTY_PATH);
  }, [styleLoaded, guideVisible]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    setPointData(mapRef.current, "accuracy", displayPosition, {
      accuracy: currentAccuracyMeters ?? 45
    });
  }, [styleLoaded, displayPosition, currentAccuracyMeters]);

  // Start marker
  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return undefined;
    startMarkerRef.current = upsertHtmlMarker(
      mapRef.current,
      startMarkerRef.current,
      startMarkerPosition,
      () => createBadge(t("routeMap.markerStart"), "route-map__marker--start")
    );
    return undefined;
  }, [styleLoaded, startMarkerPosition, t]);

  // Finish marker
  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return undefined;
    finishMarkerRef.current = upsertHtmlMarker(
      mapRef.current,
      finishMarkerRef.current,
      finishMarkerPosition,
      () => createBadge(t("routeMap.markerFinish"), "route-map__marker--finish")
    );
    return undefined;
  }, [styleLoaded, finishMarkerPosition, t]);

  // Rider puck — created lazily so we can rotate its inner element each render
  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return undefined;

    if (!displayPosition) {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
        riderEl.current = null;
      }
      return undefined;
    }

    if (!riderMarkerRef.current) {
      const shell = document.createElement("span");
      shell.className = "route-map__navigation-marker-shell";
      const puck = document.createElement("span");
      puck.className = "route-map__navigation-puck";
      const arrow = document.createElement("span");
      arrow.className = "route-map__navigation-arrow";
      puck.appendChild(arrow);
      shell.appendChild(puck);
      riderEl.current = puck;

      riderMarkerRef.current = new maplibregl.Marker({ element: shell, anchor: "center" })
        .setLngLat([displayPosition[1], displayPosition[0]])
        .addTo(mapRef.current);
    } else {
      riderMarkerRef.current.setLngLat([displayPosition[1], displayPosition[0]]);
    }

    if (riderEl.current) {
      riderEl.current.style.setProperty("--heading", `${activeHeadingDegrees}deg`);
    }

    return undefined;
  }, [styleLoaded, displayPosition, activeHeadingDegrees]);

  // Camera: follow when tracking, otherwise fit bounds to route
  const cameraBearing =
    bearingMode === "compass" && compass.heading != null
      ? compass.heading
      : movementHeadingDegrees ?? routeHeadingDegrees ?? DEFAULT_BEARING;

  const handleZoomAdjust = useCallback(
    (delta) => {
      const map = mapRef.current;
      if (!map) return;

      const nextZoom = clampZoom(map.getZoom() + delta);
      setFollowZoom(nextZoom);
      map.easeTo({
        center: displayPosition ? [displayPosition[1], displayPosition[0]] : map.getCenter(),
        zoom: nextZoom,
        pitch: DEFAULT_PITCH,
        bearing: cameraBearing,
        duration: 180,
        essential: true
      });
    },
    [cameraBearing, displayPosition]
  );

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !displayPosition) return;

    setFollowZoom(FOLLOW_ZOOM);
    map.easeTo({
      center: [displayPosition[1], displayPosition[0]],
      zoom: FOLLOW_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: cameraBearing,
      duration: 240,
      essential: true
    });
  }, [cameraBearing, displayPosition]);

  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (tracking && displayPosition) {
      map.easeTo({
        center: [displayPosition[1], displayPosition[0]],
        zoom: followZoom,
        pitch: DEFAULT_PITCH,
        bearing: cameraBearing,
        duration: bearingMode === "compass" ? 200 : 700,
        essential: true
      });
      return;
    }

    if (plannedRoutePath.length >= 2) {
      const bounds = plannedRoutePath.reduce(
        (acc, [lat, lng]) => acc.extend([lng, lat]),
        new maplibregl.LngLatBounds(
          [plannedRoutePath[0][1], plannedRoutePath[0][0]],
          [plannedRoutePath[0][1], plannedRoutePath[0][0]]
        )
      );
      map.fitBounds(bounds, { padding: 60, pitch: DEFAULT_PITCH, duration: 600 });
    }
  }, [styleLoaded, tracking, displayPosition, cameraBearing, bearingMode, followZoom, plannedRoutePath]);

  const mapClassName = ["route-map", "route-map--navigation", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={mapClassName} style={{ height }}>
      <div className="route-map__overlay route-map__overlay--navigation">
        <div className="route-map__navigation-card route-map__navigation-card--compact">
          <div className="route-map__navigation-primary">
            <div className="route-map__navigation-cue">
              <span
                aria-hidden="true"
                className={`route-map__direction-icon route-map__direction-icon--${cueDirection}`}
              />
              <div>
                <strong>{navigationCue.primary}</strong>
                <span>{navigationCue.secondary}</span>
              </div>
            </div>
            {compass.permissionState !== "unsupported" ? (
              <div
                className="route-map__bearing-control"
                role="group"
                aria-label={t("rideScreen.bearingModeLabel")}
              >
                <button
                  type="button"
                  className={`route-map__bearing-option${
                    bearingMode === "route" ? " route-map__bearing-option--active" : ""
                  }`}
                  onClick={handleRouteBearingSelect}
                  aria-pressed={bearingMode === "route"}
                >
                  {t("rideScreen.bearingRoute")}
                </button>
                <button
                  type="button"
                  className={`route-map__bearing-option${
                    bearingMode === "compass" ? " route-map__bearing-option--active" : ""
                  }`}
                  onClick={handleCompassBearingSelect}
                  aria-pressed={bearingMode === "compass"}
                >
                  {t("rideScreen.bearingCompass")}
                </button>
              </div>
            ) : null}
          </div>
          <div className="route-map__navigation-meta route-map__navigation-meta--compact">
            <span>{t("rideScreen.cueRemaining", { miles: remainingLabel })}</span>
            <span>{activeLegLabel}</span>
            <span>{routeStatusLabel}</span>
            {compass.permissionState === "denied" ? (
              <span className="route-map__compass-hint">
                {t("rideScreen.compassDenied")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div ref={containerRef} className="route-map__canvas" />
      <div className="route-map__map-controls" aria-label={t("rideScreen.mapControlsLabel")}>
        <button
          type="button"
          className="route-map__map-control"
          onClick={() => handleZoomAdjust(-1)}
          aria-label={t("rideScreen.zoomOut")}
        >
          -
        </button>
        <button
          type="button"
          className="route-map__map-control route-map__map-control--wide"
          onClick={handleRecenter}
          disabled={!displayPosition}
        >
          {t("rideScreen.recenterMap")}
        </button>
        <button
          type="button"
          className="route-map__map-control"
          onClick={() => handleZoomAdjust(1)}
          aria-label={t("rideScreen.zoomIn")}
        >
          +
        </button>
      </div>
      {routeName ? <span className="route-map__hidden-label">{routeName} - {startLabel}</span> : null}
    </div>
  );
}

function clampZoom(value) {
  return Math.min(MAX_FOLLOW_ZOOM, Math.max(MIN_FOLLOW_ZOOM, Number(value) || FOLLOW_ZOOM));
}

function resolveMapboxStyleUrl(value, token) {
  const trimmed = String(value || "").trim();
  if (!trimmed || !token) return null;

  const protocolMatch = trimmed.match(/^mapbox:\/\/styles\/([^/]+)\/([^/?#]+)/i);
  if (protocolMatch) {
    return `https://api.mapbox.com/styles/v1/${encodeURIComponent(protocolMatch[1])}/${encodeURIComponent(protocolMatch[2])}?access_token=${encodeURIComponent(token)}`;
  }

  const httpsMatch = trimmed.match(/\/styles\/v1\/([^/]+)\/([^/?#]+)/i);
  if (httpsMatch) {
    return `https://api.mapbox.com/styles/v1/${encodeURIComponent(httpsMatch[1])}/${encodeURIComponent(httpsMatch[2])}?access_token=${encodeURIComponent(token)}`;
  }

  return null;
}

function rewriteMapboxUrl(url, token) {
  if (!url.startsWith("mapbox://")) {
    return { url };
  }

  const tokenParam = `access_token=${encodeURIComponent(token)}`;

  // mapbox://sprites/<user>/<style>[@2x][.json|.png]
  let match = url.match(/^mapbox:\/\/sprites\/([^/]+)\/([^/?#]+)(@2x)?(\.json|\.png)?(.*)$/i);
  if (match) {
    const [, user, style, retina = "", ext = "", rest = ""] = match;
    return {
      url: `https://api.mapbox.com/styles/v1/${user}/${style}/sprite${retina}${ext}?${tokenParam}${rest ? `&${rest.replace(/^\?/, "")}` : ""}`
    };
  }

  // mapbox://fonts/<owner>/{fontstack}/{range}.pbf
  match = url.match(/^mapbox:\/\/fonts\/([^/]+)\/(.+)$/i);
  if (match) {
    const [, owner, rest] = match;
    return { url: `https://api.mapbox.com/fonts/v1/${owner}/${rest}?${tokenParam}` };
  }

  // mapbox://<tileset(s)> source URL (comma-separated allowed)
  // Resolves to a TileJSON endpoint.
  match = url.match(/^mapbox:\/\/([^/?]+)$/i);
  if (match) {
    return { url: `https://api.mapbox.com/v4/${match[1]}.json?secure&${tokenParam}` };
  }

  // mapbox://<tileset(s)>/{z}/{x}/{y}.<ext>
  match = url.match(/^mapbox:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)(@2x)?\.(\w+)$/i);
  if (match) {
    const [, tileset, z, x, y, retina = "", ext] = match;
    return {
      url: `https://api.mapbox.com/v4/${tileset}/${z}/${x}/${y}${retina}.${ext}?${tokenParam}`
    };
  }

  return { url };
}

function ensureSourcesAndLayers(map) {
  const layers = map.getStyle().layers || [];
  const firstSymbolId = layers.find((layer) => layer.type === "symbol")?.id;

  // 3D buildings layer (uses Mapbox streets-v12 'composite' source)
  if (map.getSource("composite") && !map.getLayer("nav-3d-buildings")) {
    map.addLayer(
      {
        id: "nav-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", ["get", "extrude"], "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#e7e1d5",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            16,
            ["get", "height"]
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            16,
            ["get", "min_height"]
          ],
          "fill-extrusion-opacity": 0.78
        }
      },
      firstSymbolId
    );
  }

  addLineSource(map, "route-guide");
  addLineLayer(map, "route-guide-glow", "route-guide", {
    "line-color": "#98d175",
    "line-width": 14,
    "line-opacity": 0.28
  });
  addLineLayer(map, "route-guide-dash", "route-guide", {
    "line-color": "#5f9a4d",
    "line-width": 4,
    "line-opacity": 0.92,
    "line-dasharray": [3, 2]
  });

  addLineSource(map, "route-planned");
  addLineLayer(map, "route-planned-base", "route-planned", {
    "line-color": "rgba(53, 59, 66, 0.55)",
    "line-width": 9
  });

  addLineSource(map, "route-active");
  addLineLayer(map, "route-active-glow", "route-active", {
    "line-color": "rgba(26, 115, 232, 0.28)",
    "line-width": 18
  });
  addLineLayer(map, "route-active-solid", "route-active", {
    "line-color": "#1a73e8",
    "line-width": 7
  });

  addLineSource(map, "route-offroute");
  addLineLayer(map, "route-offroute-dash", "route-offroute", {
    "line-color": "#c93f32",
    "line-width": 4,
    "line-opacity": 0.9,
    "line-dasharray": [2, 2]
  });

  addLineSource(map, "route-trail");
  addLineLayer(map, "route-trail-line", "route-trail", {
    "line-color": "#2f6b76",
    "line-width": 4,
    "line-opacity": 0.8,
    "line-dasharray": [3, 2]
  });

  // Accuracy circle around current position (rendered in pixels — approximate)
  if (!map.getSource("accuracy")) {
    map.addSource("accuracy", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
  }
  if (!map.getLayer("accuracy-fill")) {
    map.addLayer({
      id: "accuracy-fill",
      type: "circle",
      source: "accuracy",
      paint: {
        "circle-color": "#1a73e8",
        "circle-opacity": 0.12,
        "circle-stroke-color": "#1a73e8",
        "circle-stroke-width": 1,
        "circle-stroke-opacity": 0.5,
        // approximate meters → pixels at latitude 45 between zoom 14 and 20
        "circle-radius": [
          "interpolate",
          ["exponential", 2],
          ["zoom"],
          14,
          ["/", ["get", "accuracy"], 6],
          17,
          ["/", ["get", "accuracy"], 1],
          20,
          ["*", ["get", "accuracy"], 6]
        ]
      }
    });
  }
}

function addLineSource(map, id) {
  if (map.getSource(id)) return;
  map.addSource(id, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });
}

function addLineLayer(map, id, source, paint) {
  if (map.getLayer(id)) return;
  map.addLayer({
    id,
    type: "line",
    source,
    layout: { "line-cap": "round", "line-join": "round" },
    paint
  });
}

function setLineData(map, sourceId, latLngPath) {
  const source = map.getSource(sourceId);
  if (!source) return;

  if (!Array.isArray(latLngPath) || latLngPath.length < 2) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  source.setData({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: latLngPath.map(([lat, lng]) => [lng, lat])
    },
    properties: {}
  });
}

function setPointData(map, sourceId, latLngPoint, properties = {}) {
  const source = map.getSource(sourceId);
  if (!source) return;

  if (!latLngPoint) {
    source.setData({ type: "FeatureCollection", features: [] });
    return;
  }

  source.setData({
    type: "Feature",
    geometry: { type: "Point", coordinates: [latLngPoint[1], latLngPoint[0]] },
    properties
  });
}

function upsertHtmlMarker(map, marker, latLngPoint, buildEl) {
  if (!latLngPoint) {
    if (marker) marker.remove();
    return null;
  }

  if (!marker) {
    return new maplibregl.Marker({ element: buildEl(), anchor: "center" })
      .setLngLat([latLngPoint[1], latLngPoint[0]])
      .addTo(map);
  }

  marker.setLngLat([latLngPoint[1], latLngPoint[0]]);
  return marker;
}

function createBadge(label, modifierClass) {
  const shell = document.createElement("span");
  shell.className = "route-map__marker-shell";
  const inner = document.createElement("span");
  inner.className = `route-map__marker ${modifierClass}`;
  inner.textContent = label;
  shell.appendChild(inner);
  return shell;
}

function detectCompassSupport() {
  if (typeof window === "undefined") return "unsupported";
  if (typeof window.DeviceOrientationEvent === "undefined") return "unsupported";
  return "unknown";
}

// Listens to the device's magnetometer when `active` is true. On iOS the first
// call to requestPermission() must happen from a user gesture, so the toggle
// button awaits it before flipping into compass mode.
function useDeviceCompass(active) {
  const [permissionState, setPermissionState] = useState(detectCompassSupport);
  const [heading, setHeading] = useState(null);
  const lastAppliedRef = useRef(null);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined") return false;
    const OrientationEvent = window.DeviceOrientationEvent;
    if (!OrientationEvent) {
      setPermissionState("unsupported");
      return false;
    }
    if (typeof OrientationEvent.requestPermission === "function") {
      try {
        const result = await OrientationEvent.requestPermission();
        const granted = result === "granted";
        setPermissionState(granted ? "granted" : "denied");
        return granted;
      } catch {
        setPermissionState("denied");
        return false;
      }
    }
    setPermissionState("granted");
    return true;
  }, []);

  useEffect(() => {
    if (!active || permissionState === "unsupported" || permissionState === "denied") {
      return undefined;
    }
    if (typeof window === "undefined") return undefined;

    const handle = (event) => {
      const next = readCompassHeading(event);
      if (next == null) return;
      const last = lastAppliedRef.current;
      if (last != null && Math.abs(next - last) < BEARING_EPSILON_DEG) return;
      lastAppliedRef.current = next;
      setHeading(next);
    };

    // Prefer the absolute variant (true magnetic north). Fall back to the
    // relative event, which on iOS still exposes a usable webkitCompassHeading.
    const useAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = useAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(eventName, handle, true);
    return () => {
      window.removeEventListener(eventName, handle, true);
      lastAppliedRef.current = null;
      setHeading(null);
    };
  }, [active, permissionState]);

  return { heading, permissionState, requestPermission };
}

function readCompassHeading(event) {
  // iOS Safari — already the true compass heading (clockwise from north).
  if (typeof event.webkitCompassHeading === "number") {
    return normalizeDegrees(event.webkitCompassHeading);
  }
  if (typeof event.alpha !== "number") return null;
  if (event.absolute === false) return null;

  // Spec alpha rotates counter-clockwise, so flip it to match map bearing.
  let heading = 360 - event.alpha;
  // Compensate for landscape / upside-down screen orientation.
  const screenAngle =
    (typeof screen !== "undefined" && screen.orientation && screen.orientation.angle) || 0;
  heading -= screenAngle;
  return normalizeDegrees(heading);
}

function normalizeDegrees(deg) {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped;
}
