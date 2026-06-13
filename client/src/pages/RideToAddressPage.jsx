import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import DirectionsPanel from "../components/DirectionsPanel";
import NavigationMap from "../components/NavigationMap";
import TopBar from "../components/TopBar";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useGpsTracker } from "../hooks/useGpsTracker";
import { useRideTrail } from "../hooks/useRideTrail";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";
import { useTranslation } from "../i18n";
import { buildDirectionSections, formatRoutingProviderLabel } from "../lib/directionSteps";
import {
  distanceBetweenPointsMiles,
  formatDurationMinutes,
  formatMiles,
  formatNavigationDistance,
  getRouteNavigationState
} from "../utils";

const ARRIVAL_THRESHOLD_MILES = 0.05;
const REROUTE_DRIFT_MILES = 0.15;

export default function RideToAddressPage() {
  const { member } = useAuth();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [routedRoute, setRoutedRoute] = useState(null);
  const [error, setError] = useState(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);

  const destination = useMemo(() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
  }, [params]);

  const destinationLabel = params.get("label") || t("rideTo.fallbackLabel");

  const {
    currentPosition,
    currentAccuracyMeters,
    currentHeadingDegrees,
    tracking
  } = useGpsTracker({
    autoStart: true,
    onError: ({ code }) => {
      setError(
        code === "unsupported"
          ? t("rideScreen.geoUnsupported")
          : code === "denied"
            ? t("rideScreen.geoDenied")
            : t("rideScreen.geoFailed")
      );
    }
  });

  const { trail, trailMiles, rideStartedAt, elapsedMinutes, startRide } = useRideTrail({
    currentPosition,
    tracking
  });

  useEffect(() => {
    if (!rideStartedAt) {
      startRide();
    }
  }, [rideStartedAt, startRide]);

  useEffect(() => {
    if (!destination || !currentPosition) {
      return undefined;
    }

    const cachedOrigin = routedRoute?.fetchedFromPoint;
    const driftedTooFar =
      cachedOrigin &&
      distanceBetweenPointsMiles(currentPosition, cachedOrigin) > REROUTE_DRIFT_MILES;

    if (cachedOrigin && !driftedTooFar) {
      return undefined;
    }

    let cancelled = false;
    api
      .routePath([currentPosition, destination], "bike")
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload?.path) && payload.path.length >= 2) {
          setRoutedRoute({ ...payload, fetchedFromPoint: currentPosition });
        } else {
          setRoutedRoute({
            path: [currentPosition, destination],
            source: "local",
            fetchedFromPoint: currentPosition
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRoutedRoute({
          path: [currentPosition, destination],
          source: "local",
          fetchedFromPoint: currentPosition
        });
      });

    return () => {
      cancelled = true;
    };
  }, [destination, currentPosition, routedRoute?.fetchedFromPoint]);

  const path = routedRoute?.path ?? [];

  const navigationState = useMemo(() => {
    if (path.length < 2 || !currentPosition) return null;
    return getRouteNavigationState(currentPosition, path, {
      plannedRoutePath: path,
      routeSteps: routedRoute?.steps,
      routingSource: routedRoute?.source ?? "local"
    });
  }, [currentPosition, path, routedRoute?.steps, routedRoute?.source]);

  const distanceToDestinationMiles = useMemo(() => {
    if (!currentPosition || !destination) return null;
    return distanceBetweenPointsMiles(currentPosition, destination);
  }, [currentPosition, destination]);

  const arrived =
    distanceToDestinationMiles != null &&
    distanceToDestinationMiles <= ARRIVAL_THRESHOLD_MILES;

  const directionSections = useMemo(
    () => buildDirectionSections({ route: null, routedRoute, routedToStart: null, t }),
    [routedRoute, t]
  );
  const totalDirectionSteps = directionSections.reduce(
    (total, section) => total + section.steps.length,
    0
  );
  const routingProviderLabel = formatRoutingProviderLabel(routedRoute?.source);

  const { voiceEnabled, voiceStatus, toggleVoice } = useVoiceNavigation({
    navigationState,
    tracking,
    t,
    onUnsupported: (message) => setError(message)
  });

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

      <section className="content-section ride-screen">
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
            movementHeadingDegrees={currentHeadingDegrees}
            currentPosition={currentPosition}
            height={620}
            homePoint={member?.home ?? null}
            navigationState={navigationState}
            path={path}
            routeName={destinationLabel}
            startLabel={t("rideTo.start")}
            trail={trail}
            tracking={tracking}
          />
        </div>

        <div className="ride-status-card__actions">
          <button
            aria-controls="directions-panel"
            aria-expanded={directionsOpen}
            className={`button button--primary button--sm${directionsOpen ? " is-active" : ""}`}
            onClick={() => setDirectionsOpen((current) => !current)}
            type="button"
          >
            {directionsOpen ? t("rideScreen.directionsHide") : t("rideScreen.directionsShow")}
          </button>
          <button
            className={`button button--outline button--sm${voiceEnabled ? " is-active" : ""}`}
            onClick={toggleVoice}
            type="button"
          >
            {voiceEnabled ? t("rideScreen.voiceOn") : t("rideScreen.voiceOff")}
          </button>
          <span>{voiceStatus}</span>
        </div>

        {directionsOpen ? (
          <DirectionsPanel
            directionSections={directionSections}
            navigationState={navigationState}
            onClose={() => setDirectionsOpen(false)}
            routingProviderLabel={routingProviderLabel}
            routingStatus={routedRoute ? "ready" : "loading"}
            totalDirectionSteps={totalDirectionSteps}
          />
        ) : null}

        <div className="ride-screen__stats">
          <div>
            <span className="stat-label">{t("rideScreen.statElapsed")}</span>
            <strong>{formatDurationMinutes(elapsedMinutes)}</strong>
          </div>
          <div>
            <span className="stat-label">{t("rideScreen.statTrail")}</span>
            <strong>{formatMiles(trailMiles)}</strong>
          </div>
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
