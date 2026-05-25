import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";
import { useTranslation } from "../i18n";
import { getMapTileConfig } from "../mapTiles";
import {
  formatNavigationDistance,
  getPathCenter,
  getRouteNavigationState,
  getRouteTheme,
  MIDTOWN_GREENWAY_PATH,
  MINNEAPOLIS_CENTER
} from "../utils";

const EMPTY_PATH = [];

export default function RouteMap({
  path = [],
  trail = [],
  currentPosition = null,
  currentAccuracyMeters = 45,
  navigationMode = false,
  navigationState = null,
  tracking = false,
  onMapClick,
  interactive = false,
  height = 360,
  className = "",
  routeName = "",
  startLabel = "",
  terrain = "",
  showGreenwayGuide = false,
  showLegend = true
}) {
  const { t } = useTranslation();
  const center = getPathCenter(path.length ? path : currentPosition ? [currentPosition] : []);
  const routeTheme = getRouteTheme({ title: routeName, start: startLabel, terrain });
  const guideVisible = showGreenwayGuide || terrain === "greenway";
  const guidePath = guideVisible ? MIDTOWN_GREENWAY_PATH : EMPTY_PATH;
  const computedNavigationState = useMemo(
    () => (navigationMode ? navigationState ?? getRouteNavigationState(currentPosition, path) : null),
    [currentPosition, navigationMode, navigationState, path]
  );
  const displayPosition = navigationMode
    ? computedNavigationState?.displayPosition ?? currentPosition
    : currentPosition;
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
  const cueDirection = /left|izquierda/i.test(navigationCue.primary)
    ? "left"
    : /right|derecha/i.test(navigationCue.primary)
      ? "right"
      : navigationCue.type;
  const navigationIcon = useMemo(
    () => createNavigationIcon(computedNavigationState?.headingDegrees ?? 0),
    [computedNavigationState?.headingDegrees]
  );
  const startIcon = useMemo(
    () => createBadgeIcon(t("routeMap.markerStart"), "route-map__marker--start"),
    [t]
  );
  const finishIcon = useMemo(
    () => createBadgeIcon(t("routeMap.markerFinish"), "route-map__marker--finish"),
    [t]
  );
  const riderIcon = useMemo(
    () => createBadgeIcon(t("routeMap.markerRider"), "route-map__marker--rider"),
    [t]
  );
  const greenwayIcon = useMemo(
    () => createBadgeIcon(t("routeMap.legendGuide"), "route-map__marker--greenway"),
    [t]
  );
  const mapClassName = ["route-map", navigationMode ? "route-map--navigation" : "", className]
    .filter(Boolean)
    .join(" ");
  const tileConfig = useMemo(() => getMapTileConfig({ navigationMode }), [navigationMode]);
  const completedPath = computedNavigationState?.completedPath ?? EMPTY_PATH;
  const remainingPath = computedNavigationState?.remainingPath ?? path;
  const plannedRoutePath = computedNavigationState?.plannedRoutePath ?? path;
  const toStartPath = computedNavigationState?.toStartPath ?? EMPTY_PATH;
  const activeNavigationPath =
    computedNavigationState?.activeLeg === "to-start" ? toStartPath : remainingPath;
  const offRoutePath =
    navigationMode &&
    currentPosition &&
    computedNavigationState?.closestPoint &&
    computedNavigationState.activeLeg === "route" &&
    !computedNavigationState.snappedToRoute
      ? [currentPosition, computedNavigationState.closestPoint]
      : EMPTY_PATH;
  const startMarkerPosition = computedNavigationState?.startPoint ?? path[0];
  const finishMarkerPosition = computedNavigationState?.finishPoint ?? path[path.length - 1];

  return (
    <div className={mapClassName} style={{ height }}>
      <div className="route-map__overlay">
        {navigationMode ? (
          <div className="route-map__navigation-card">
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
            <div className="route-map__navigation-meta">
              <span>{t("rideScreen.cueRemaining", { miles: remainingLabel })}</span>
              <span>{activeLegLabel}</span>
              <span>
                {!currentPosition
                  ? t("rideScreen.headlineGuidanceReady")
                  : computedNavigationState?.snappedToRoute
                    ? t("rideScreen.cueRoutingFallback")
                    : t("rideScreen.headlineReturnRoute")}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="route-map__summary">
              <strong>{routeName || t("routeMap.legendRoute")}</strong>
              <span>
                {startLabel
                  ? t("routeMap.summaryStart", { start: startLabel })
                  : interactive
                    ? t("routeBuilder.gpsClickStart")
                    : t("rideScreen.detailGuidanceReady")}
              </span>
            </div>

            <div className="route-map__badge-group">
              <span
                className="route-map__badge"
                style={{
                  "--route-accent": routeTheme.accent,
                  "--route-soft": routeTheme.accentSoft
                }}
              >
                {t(routeTheme.badgeKey)}
              </span>
              {guideVisible ? (
                <span className="route-map__badge route-map__badge--guide">{t("routeMap.legendGuide")}</span>
              ) : null}
            </div>
          </>
        )}

        {showLegend && !navigationMode ? (
          <div className="route-map__legend">
            {path.length ? <span className="route-map__legend-item route-map__legend-item--route">{t("routeMap.legendRoute")}</span> : null}
            {trail.length ? <span className="route-map__legend-item route-map__legend-item--trail">{t("routeMap.legendTrail")}</span> : null}
            {displayPosition ? <span className="route-map__legend-item route-map__legend-item--you">{t("routeMap.legendYou")}</span> : null}
            {guideVisible ? (
              <span className="route-map__legend-item route-map__legend-item--guide">{t("routeMap.legendGuide")}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <MapContainer
        center={center}
        className="route-map__canvas"
        scrollWheelZoom={false}
        zoom={navigationMode ? 16 : 13}
        zoomControl={!navigationMode}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          key={tileConfig.source}
          tileSize={tileConfig.tileSize ?? 256}
          url={tileConfig.url}
          zoomOffset={tileConfig.zoomOffset ?? 0}
        />
        <FitRouteBounds
          currentPosition={displayPosition}
          guidePath={guidePath}
          navigationMode={navigationMode}
          navigationPosition={displayPosition}
          path={path}
        />
        <MapClickCapture enabled={interactive} onMapClick={onMapClick} />
        {guideVisible ? (
          <>
            <Polyline
              pathOptions={{ color: "#98d175", opacity: 0.28, weight: 14 }}
              positions={MIDTOWN_GREENWAY_PATH}
              smoothFactor={0.2}
            />
            <Polyline
              pathOptions={{ color: "#5f9a4d", dashArray: "14 10", opacity: 0.92, weight: 4 }}
              positions={MIDTOWN_GREENWAY_PATH}
              smoothFactor={0.2}
            />
            <Marker icon={greenwayIcon} position={getPathCenter(MIDTOWN_GREENWAY_PATH)} />
          </>
        ) : null}
        {navigationMode && plannedRoutePath.length ? (
          <>
            {plannedRoutePath.length > 1 ? (
              <Polyline
                pathOptions={{
                  color: "rgba(53, 59, 66, 0.28)",
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 1,
                  weight: 9
                }}
                positions={plannedRoutePath}
                smoothFactor={0.08}
              />
            ) : null}
            {computedNavigationState?.activeLeg === "route" && completedPath.length > 1 ? (
              <Polyline
                pathOptions={{
                  color: "rgba(88, 101, 109, 0.55)",
                  lineCap: "round",
                  lineJoin: "round",
                  opacity: 0.92,
                  weight: 6
                }}
                positions={completedPath}
                smoothFactor={0.08}
              />
            ) : null}
            {activeNavigationPath.length > 1 ? (
              <>
                <Polyline
                  pathOptions={{
                    color: "rgba(26, 115, 232, 0.22)",
                    lineCap: "round",
                    lineJoin: "round",
                    opacity: 1,
                    weight: 15
                  }}
                  positions={activeNavigationPath}
                  smoothFactor={0.08}
                />
                <Polyline
                  pathOptions={{
                    color: "#1a73e8",
                    lineCap: "round",
                    lineJoin: "round",
                    opacity: 1,
                    weight: 7
                  }}
                  positions={activeNavigationPath}
                  smoothFactor={0.08}
                />
              </>
            ) : null}
            {offRoutePath.length > 1 ? (
              <Polyline
                pathOptions={{
                  color: "#c93f32",
                  dashArray: "6 8",
                  lineCap: "round",
                  opacity: 0.9,
                  weight: 4
                }}
                positions={offRoutePath}
                smoothFactor={0.2}
              />
            ) : null}
          </>
        ) : path.length ? (
          <>
            <Polyline
              pathOptions={{ color: routeTheme.lineGlow, opacity: 0.9, weight: 10 }}
              positions={path}
              smoothFactor={0.2}
            />
            <Polyline
              pathOptions={{ color: routeTheme.accent, opacity: 1, weight: 5 }}
              positions={path}
              smoothFactor={0.2}
            />
          </>
        ) : null}
        {trail.length && !navigationMode ? (
          <>
            <Polyline
              pathOptions={{ color: "rgba(47, 107, 118, 0.22)", weight: 10 }}
              positions={trail}
              smoothFactor={0.2}
            />
            <Polyline
              pathOptions={{ color: "#2f6b76", dashArray: "10 8", weight: 4 }}
              positions={trail}
              smoothFactor={0.2}
            />
          </>
        ) : null}
        {startMarkerPosition ? <Marker icon={startIcon} position={startMarkerPosition} /> : null}
        {finishMarkerPosition ? <Marker icon={finishIcon} position={finishMarkerPosition} /> : null}
        {displayPosition ? (
          <>
            <Marker icon={navigationMode ? navigationIcon : riderIcon} position={displayPosition} />
            <Circle
              center={displayPosition}
              pathOptions={{
                color: navigationMode ? "#1a73e8" : "#2f6b76",
                fillOpacity: navigationMode ? 0.08 : 0.12,
                weight: 1
              }}
              radius={currentAccuracyMeters ?? 45}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}

function FitRouteBounds({ path, currentPosition, guidePath, navigationMode, navigationPosition }) {
  const map = useMap();

  useEffect(() => {
    if (navigationMode && navigationPosition) {
      map.setView(navigationPosition, 16, { animate: true });
      return;
    }

    const points = [...path];

    if (currentPosition && !points.some((point) => pointsMatch(point, currentPosition))) {
      points.push(currentPosition);
    }

    if (!points.length && guidePath.length) {
      points.push(...guidePath);
    }

    if (points.length >= 2) {
      map.fitBounds(points, { padding: [36, 36] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.setView(MINNEAPOLIS_CENTER, 12);
    }
  }, [currentPosition, guidePath, map, navigationMode, navigationPosition, path]);

  return null;
}

function pointsMatch(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function createBadgeIcon(label, modifierClass) {
  return L.divIcon({
    className: "route-map__marker-shell",
    html: `<span class="route-map__marker ${modifierClass}">${label}</span>`
  });
}

function createNavigationIcon(headingDegrees) {
  const heading = Number.isFinite(headingDegrees) ? headingDegrees : 0;

  return L.divIcon({
    className: "route-map__navigation-marker-shell",
    html: `<span class="route-map__navigation-puck" style="--heading:${heading}deg"><span class="route-map__navigation-arrow"></span></span>`,
    iconAnchor: [21, 21],
    iconSize: [42, 42]
  });
}

function MapClickCapture({ enabled, onMapClick }) {
  useMapEvents({
    click(event) {
      if (!enabled || !onMapClick) {
        return;
      }

      onMapClick([
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6))
      ]);
    }
  });

  return null;
}
