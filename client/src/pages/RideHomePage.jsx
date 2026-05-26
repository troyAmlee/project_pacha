import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import NavigationMap from "../components/NavigationMap";
import TopBar from "../components/TopBar";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../i18n";
import {
  GPS_CAPTURE_OPTIONS,
  distanceBetweenPointsMiles,
  formatNavigationDistance,
  getGpsAccuracyMeters,
  getRouteNavigationState,
  gpsPositionToPoint
} from "../utils";

const ARRIVAL_THRESHOLD_MILES = 0.05;
const REROUTE_DRIFT_MILES = 0.15;

export default function RideHomePage() {
  const { member } = useAuth();
  const { t } = useTranslation();
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [path, setPath] = useState([]);
  const [routeSource, setRouteSource] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  const home = member?.home ?? null;

  useEffect(() => {
    if (!home || !navigator.geolocation) {
      if (!navigator.geolocation) setError(t("rideScreen.geoUnsupported"));
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(gpsPositionToPoint(position));
        setCurrentAccuracyMeters(getGpsAccuracyMeters(position));
      },
      (geoError) => {
        setError(
          geoError.code === 1 ? t("rideScreen.geoDenied") : t("rideScreen.geoFailed")
        );
      },
      GPS_CAPTURE_OPTIONS
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [home, t]);

  // Fetch / refresh the route home. Triggers on first GPS lock, and again if
  // the rider drifts past REROUTE_DRIFT_MILES from the cached origin.
  useEffect(() => {
    if (!home || !currentPosition) return undefined;

    const cachedOrigin = path[0];
    const driftedTooFar =
      cachedOrigin &&
      distanceBetweenPointsMiles(currentPosition, cachedOrigin) > REROUTE_DRIFT_MILES;

    if (cachedOrigin && !driftedTooFar) return undefined;

    let cancelled = false;
    api
      .routePath([currentPosition, home], "bike")
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload?.path) && payload.path.length >= 2) {
          setPath(payload.path);
          setRouteSource(payload.source ?? "local");
        } else {
          setPath([currentPosition, home]);
          setRouteSource("local");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to a straight line so the rider still has bearing guidance.
        setPath([currentPosition, home]);
        setRouteSource("local");
      });

    return () => {
      cancelled = true;
    };
  }, [home, currentPosition, path]);

  const navigationState = useMemo(() => {
    if (path.length < 2 || !currentPosition) return null;
    return getRouteNavigationState(currentPosition, path, {
      plannedRoutePath: path,
      routingSource: routeSource ?? "local"
    });
  }, [currentPosition, path, routeSource]);

  const distanceToHomeMiles = useMemo(() => {
    if (!currentPosition || !home) return null;
    return distanceBetweenPointsMiles(currentPosition, home);
  }, [currentPosition, home]);

  const arrived =
    distanceToHomeMiles != null && distanceToHomeMiles <= ARRIVAL_THRESHOLD_MILES;

  if (!member) {
    return null;
  }

  if (!home) {
    return (
      <div className="app-shell">
        <TopBar />
        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">{t("rideHome.kicker")}</p>
            <h1>{t("rideHome.noHomeTitle")}</h1>
            <p>{t("rideHome.noHomeBody")}</p>
            <div className="hero-actions">
              <Link className="button button--primary" to={`/riders/${member.id}`}>
                {t("rideHome.setHomeCta")}
              </Link>
              <Link className="button button--outline" to="/">
                {t("rideScreen.backToBoard")}
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar />

      <section className="content-section">
        <div className="section-heading">
          <p className="section-kicker">{t("rideHome.kicker")}</p>
          <h1>{t("rideHome.title")}</h1>
          <p>
            {arrived
              ? t("rideHome.arrived")
              : distanceToHomeMiles != null
                ? t("rideHome.remaining", {
                    miles: formatNavigationDistance(distanceToHomeMiles)
                  })
                : t("rideScreen.headlineWaitingGps")}
          </p>
        </div>

        {error ? (
          <p className="feedback feedback--error">{error}</p>
        ) : null}

        <div className="ride-screen__map-panel">
          <NavigationMap
            currentAccuracyMeters={currentAccuracyMeters ?? undefined}
            currentPosition={currentPosition}
            height={620}
            homePoint={home}
            navigationState={navigationState}
            path={path}
            startLabel={t("rideHome.start")}
            routeName={t("rideHome.title")}
            tracking={Boolean(currentPosition)}
          />
        </div>

        <div className="hero-actions">
          <Link className="button button--outline" to="/">
            {t("rideScreen.backToBoard")}
          </Link>
        </div>
      </section>
    </div>
  );
}
