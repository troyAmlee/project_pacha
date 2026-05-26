import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

export default function RideToAddressPage() {
  const { member } = useAuth();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [path, setPath] = useState([]);
  const [routeSource, setRouteSource] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  const destination = useMemo(() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
  }, [params]);

  const destinationLabel = params.get("label") || t("rideTo.fallbackLabel");

  useEffect(() => {
    if (!destination || !navigator.geolocation) {
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
  }, [destination, t]);

  useEffect(() => {
    if (!destination || !currentPosition) return undefined;

    const cachedOrigin = path[0];
    const driftedTooFar =
      cachedOrigin &&
      distanceBetweenPointsMiles(currentPosition, cachedOrigin) > REROUTE_DRIFT_MILES;

    if (cachedOrigin && !driftedTooFar) return undefined;

    let cancelled = false;
    api
      .routePath([currentPosition, destination], "bike")
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload?.path) && payload.path.length >= 2) {
          setPath(payload.path);
          setRouteSource(payload.source ?? "local");
        } else {
          setPath([currentPosition, destination]);
          setRouteSource("local");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPath([currentPosition, destination]);
        setRouteSource("local");
      });

    return () => {
      cancelled = true;
    };
  }, [destination, currentPosition, path]);

  const navigationState = useMemo(() => {
    if (path.length < 2 || !currentPosition) return null;
    return getRouteNavigationState(currentPosition, path, {
      plannedRoutePath: path,
      routingSource: routeSource ?? "local"
    });
  }, [currentPosition, path, routeSource]);

  const distanceToDestinationMiles = useMemo(() => {
    if (!currentPosition || !destination) return null;
    return distanceBetweenPointsMiles(currentPosition, destination);
  }, [currentPosition, destination]);

  const arrived =
    distanceToDestinationMiles != null &&
    distanceToDestinationMiles <= ARRIVAL_THRESHOLD_MILES;

  if (!destination) {
    return (
      <div className="app-shell">
        <TopBar />
        <section className="content-section">
          <div className="section-heading">
            <p className="section-kicker">{t("rideTo.kicker")}</p>
            <h1>{t("rideTo.noDestinationTitle")}</h1>
            <p>{t("rideTo.noDestinationBody")}</p>
            <div className="hero-actions">
              <Link className="button button--primary" to="/">
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
          <p className="section-kicker">{t("rideTo.kicker")}</p>
          <h1>{destinationLabel}</h1>
          <p>
            {arrived
              ? t("rideTo.arrived")
              : distanceToDestinationMiles != null
                ? t("rideTo.remaining", {
                    miles: formatNavigationDistance(distanceToDestinationMiles)
                  })
                : t("rideScreen.headlineWaitingGps")}
          </p>
        </div>

        {error ? <p className="feedback feedback--error">{error}</p> : null}

        <div className="ride-screen__map-panel">
          <NavigationMap
            currentAccuracyMeters={currentAccuracyMeters ?? undefined}
            currentPosition={currentPosition}
            height={620}
            homePoint={member?.home ?? null}
            navigationState={navigationState}
            path={path}
            routeName={destinationLabel}
            startLabel={t("rideTo.start")}
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
