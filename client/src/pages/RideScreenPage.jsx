import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import DirectionsPanel from "../components/DirectionsPanel";
import FormFeedback from "../components/FormFeedback";
import NavigationMap from "../components/NavigationMap";
import SuggestedRoutes from "../components/SuggestedRoutes";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useGpsTracker } from "../hooks/useGpsTracker";
import { useRideTrail } from "../hooks/useRideTrail";
import { useVoiceNavigation } from "../hooks/useVoiceNavigation";
import { useTranslation } from "../i18n";
import { buildDirectionSections, formatRoutingProviderLabel } from "../lib/directionSteps";
import {
  distanceBetweenPointsMiles,
  distanceFromPointToPathMiles,
  formatDurationMinutes,
  formatMiles,
  formatNavigationDistance,
  getDirectedRoutePath,
  getRouteNavigationState,
  getRoutingWaypoints
} from "../utils";

const ROUTING_REFRESH_DISTANCE_MILES = 0.1;
const EMPTY_ROUTE_PATH = [];

export default function RideScreenPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { member } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const { t } = useTranslation();

  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [routeDirection, setRouteDirection] = useState("forward");
  const [routeLegStartPoint, setRouteLegStartPoint] = useState(null);
  const [routedRoute, setRoutedRoute] = useState(null);
  const [routedToStart, setRoutedToStart] = useState(null);
  const [routingStatus, setRoutingStatus] = useState("idle");
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [feedback, setFeedback] = useState(
    location.state?.success ? { type: "success", message: location.state.success } : null
  );
  const lastToStartRequestRef = useRef(null);
  const toStartRequestIdRef = useRef(0);
  const routeLegPendingRef = useRef(false);

  const {
    currentPosition,
    currentAccuracyMeters,
    currentHeadingDegrees,
    tracking,
    startTracking,
    stopTracking
  } = useGpsTracker({
    onError: ({ code }) => {
      const message =
        code === "unsupported"
          ? t("rideScreen.geoUnsupported")
          : code === "denied"
            ? t("rideScreen.trackDenied")
            : t("rideScreen.trackFailed");
      setFeedback({ type: "error", message });
    }
  });

  const { trail, trailMiles, rideStartedAt, elapsedMinutes, startRide, resetRide } = useRideTrail({
    currentPosition,
    tracking
  });

  const route = data?.routes.find((item) => item.id === id);
  const savedRoutePath = route?.path ?? EMPTY_ROUTE_PATH;
  const routePath = useMemo(
    () => getDirectedRoutePath(savedRoutePath, routeDirection),
    [savedRoutePath, routeDirection]
  );
  const navigationPath = routedRoute?.path?.length >= 2 ? routedRoute.path : routePath;
  const isOwner = route ? route.createdById === member?.id : false;
  const groupsUsingRoute = useMemo(() => {
    if (!data || !route) {
      return [];
    }

    return data.groups.filter((group) => group.pinnedRouteIds.includes(route.id));
  }, [data, route]);

  const offRouteMiles = useMemo(() => {
    if (!currentPosition || !navigationPath.length) {
      return null;
    }

    return distanceFromPointToPathMiles(currentPosition, navigationPath);
  }, [currentPosition, navigationPath]);

  // Before GPS locks, fall back to the saved home address so the rider sees
  // the whole plan (home → route start → route) on screen instead of an empty
  // "waiting for GPS" placeholder. Once a real fix arrives, currentPosition
  // takes over and the puck switches to live.
  const previewPosition = currentPosition ?? member?.home ?? null;
  const isPreviewingFromHome = !currentPosition && Boolean(member?.home);
  const navigationState = useMemo(
    () =>
      getRouteNavigationState(previewPosition, navigationPath, {
        plannedRoutePath: navigationPath,
        routeSteps: routedRoute?.steps,
        routingSource: routedRoute?.source ?? "local",
        routeLegStartPoint,
        toStartPath: routedToStart?.path,
        toStartSteps: routedToStart?.steps,
        toStartSource: routedToStart?.source ?? "local"
      }),
    [previewPosition, navigationPath, routeLegStartPoint, routedRoute, routedToStart]
  );
  const routingProviderLabel = formatRoutingProviderLabel(
    routedToStart?.source ?? routedRoute?.source
  );
  const directionSections = useMemo(
    () => buildDirectionSections({ route, routedRoute, routedToStart, t }),
    [route, routedRoute, routedToStart, t]
  );
  const totalDirectionSteps = directionSections.reduce(
    (total, section) => total + section.steps.length,
    0
  );

  const { voiceEnabled, voiceStatus, toggleVoice } = useVoiceNavigation({
    navigationState,
    tracking,
    t,
    onUnsupported: (message) => setFeedback({ type: "error", message })
  });

  const routeStatus = useMemo(() => {
    if (offRouteMiles === null) {
      return {
        headline:
          navigationState?.cue.primary ??
          (tracking ? t("rideScreen.headlineWaitingGps") : t("rideScreen.headlineGuidanceReady")),
        detail: tracking
          ? t("rideScreen.detailWaitingGps")
          : t("rideScreen.detailGuidanceReady")
      };
    }

    if (navigationState?.activeLeg === "to-start") {
      return {
        headline: navigationState.cue.primary,
        detail: t("rideScreen.detailToStartFallback")
      };
    }

    if (navigationState && !navigationState.snappedToRoute) {
      return {
        headline: t("rideScreen.headlineReturnRoute"),
        detail: t("rideScreen.detailReturn", { miles: formatMiles(offRouteMiles) })
      };
    }

    if (navigationState?.cue.type === "arrive") {
      return {
        headline: navigationState.cue.primary,
        detail: navigationState.cue.secondary
      };
    }

    if (offRouteMiles <= 0.05 && navigationState) {
      return {
        headline: navigationState.cue.primary,
        detail:
          navigationState.cue.type === "continue"
            ? navigationState.cue.secondary
            : `${navigationState.cue.secondary} ${formatNavigationDistance(navigationState.remainingMiles)} left.`
      };
    }

    if (offRouteMiles <= 0.15) {
      return {
        headline: t("rideScreen.headlineSlightDrift"),
        detail: t("rideScreen.detailSlightDrift")
      };
    }

    return {
      headline: t("rideScreen.headlineRouteCheck"),
      detail: t("rideScreen.detailRouteCheck")
    };
  }, [navigationState, offRouteMiles, tracking, t]);

  useEffect(() => {
    setRouteDirection("forward");
    setRouteLegStartPoint(null);
    routeLegPendingRef.current = false;
  }, [route?.id]);

  useEffect(() => {
    if (!navigationState || !currentPosition) {
      return;
    }

    if (navigationState.activeLeg === "to-start") {
      routeLegPendingRef.current = true;
      return;
    }

    if (routeLegStartPoint || navigationState.activeLeg !== "route") {
      return;
    }

    if (routeLegPendingRef.current || navigationState.snappedToRoute) {
      setRouteLegStartPoint(
        navigationState.closestPoint ?? navigationState.displayPosition ?? currentPosition
      );
      routeLegPendingRef.current = false;
    }
  }, [currentPosition, navigationState, routeLegStartPoint]);

  useEffect(() => {
    setRoutedRoute(null);
    setRoutedToStart(null);
    setRoutingStatus("idle");
    setRouteLegStartPoint(null);
    lastToStartRequestRef.current = null;
    toStartRequestIdRef.current += 1;
    routeLegPendingRef.current = false;

    if (!routePath || routePath.length < 2) {
      return undefined;
    }

    let cancelled = false;

    async function loadBikeRoute() {
      setRoutingStatus("loading");

      try {
        const payload = await api.routePath(getRoutingWaypoints(routePath), "bike");

        if (!cancelled && payload?.path?.length >= 2) {
          setRoutedRoute(payload);
          setRoutingStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setRoutingStatus("fallback");
        }
      }
    }

    void loadBikeRoute();

    return () => {
      cancelled = true;
    };
  }, [route?.id, route?.updatedAt, routePath]);

  useEffect(() => {
    if (!currentPosition || !routePath[0]) {
      return undefined;
    }

    const lastRequestPoint = lastToStartRequestRef.current;

    if (
      lastRequestPoint &&
      distanceBetweenPointsMiles(lastRequestPoint, currentPosition) < ROUTING_REFRESH_DISTANCE_MILES
    ) {
      return undefined;
    }

    lastToStartRequestRef.current = currentPosition;
    const requestId = toStartRequestIdRef.current + 1;
    toStartRequestIdRef.current = requestId;

    async function loadBikePathToStart() {
      try {
        const payload = await api.routePath([currentPosition, routePath[0]], "bike");

        if (toStartRequestIdRef.current === requestId && payload?.path?.length >= 2) {
          setRoutedToStart(payload);
        }
      } catch {
        if (toStartRequestIdRef.current === requestId) {
          setRoutedToStart(null);
        }
      }
    }

    void loadBikePathToStart();

    return undefined;
  }, [currentPosition, routePath]);

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">Xxica</p>
        <h1>{t("rideScreen.loading")}</h1>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">Xxica</p>
          <h1>{t("rideScreen.notOnBoard")}</h1>
          <Link className="button button--primary" to="/">
            {t("routeBuilder.backToBoard")}
          </Link>
        </div>
      </div>
    );
  }

  async function handleCompleteRide() {
    setBusy(true);
    setFeedback(null);

    try {
      const payload = await api.postJson("/api/rides", {
        routeId: route.id,
        durationMinutes: Math.max(1, elapsedMinutes || 1),
        distanceMiles: trailMiles || route.distanceMiles
      });

      await loadBootstrap();
      stopTracking();
      resetRide();
      setRouteLegStartPoint(null);
      setFeedback({
        type: "success",
        message: t("rideScreen.rideLoggedFeedback", {
          miles: formatMiles(payload.ride.distanceMiles),
          duration: formatDurationMinutes(payload.ride.durationMinutes)
        })
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRoute() {
    if (!route) {
      return;
    }

    const confirmed = window.confirm(
      t("rideScreen.confirmDelete", { title: route.title })
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback(null);

    try {
      stopTracking();
      await api.delete(`/api/routes/${route.id}`);
      await loadBootstrap();
      navigate("/", {
        replace: true,
        state: { success: t("rideScreen.routeDeletedFeedback") }
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setDeleting(false);
    }
  }

  function handleStartTracking() {
    if (!rideStartedAt) {
      startRide();
    }
    startTracking();
  }

  function toggleRouteDirection() {
    setRouteDirection((current) => (current === "forward" ? "reverse" : "forward"));
    setRouteLegStartPoint(null);
    setRoutedRoute(null);
    setRoutedToStart(null);
    lastToStartRequestRef.current = null;
    toStartRequestIdRef.current += 1;
    routeLegPendingRef.current = false;
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section ride-screen">
        <div className="section-heading">
          <p className="section-kicker">{t("rideScreen.kicker")}</p>
          <h1>{route.title}</h1>
          <p className="ride-screen__lead">{t("rideScreen.lead")}</p>
          {isOwner ? (
            <div className="ride-screen__owner-actions">
              <Link className="button button--outline button--sm" to={`/routes/${route.id}/edit`}>
                {t("rideScreen.editRoute")}
              </Link>
              <button
                className="button button--outline button--sm"
                disabled={deleting}
                onClick={() => void handleDeleteRoute()}
                type="button"
              >
                {deleting ? t("rideScreen.deletingRoute") : t("rideScreen.deleteRoute")}
              </button>
            </div>
          ) : null}
        </div>

        <div className="ride-screen__layout">
          <div className="ride-screen__map-panel">
            <NavigationMap
              currentAccuracyMeters={currentAccuracyMeters ?? undefined}
              movementHeadingDegrees={currentHeadingDegrees}
              currentPosition={currentPosition}
              height={640}
              homePoint={member?.home ?? null}
              navigationState={navigationState}
              path={navigationPath}
              routeName={route.title}
              showGreenwayGuide={route.terrain === "greenway"}
              startLabel={route.start}
              terrain={route.terrain}
              trail={trail}
              tracking={tracking}
            />
          </div>

          <div className="ride-screen__sidebar">
            <div className="editor editor--paper ride-status-card">
              <p className="group-card__eyebrow">{t("rideScreen.cueKicker")}</p>
              <h3>{routeStatus.headline}</h3>
              <p>{routeStatus.detail}</p>
              {isPreviewingFromHome ? (
                <p className="ride-status-card__preview">
                  {t("rideScreen.previewFromHome")}
                </p>
              ) : null}
              <div className="ride-status-card__chips">
                <span className="ride-status-card__chip">{t("rideScreen.cueStartLabel", { start: route.start })}</span>
                <span className="ride-status-card__chip">
                  {t("rideScreen.cueTerrainLabel", {
                    terrain: t(`terrain.${route.terrain}`) || route.terrain
                  })}
                </span>
                {offRouteMiles === null ? null : (
                  <span className="ride-status-card__chip">
                    {t("rideScreen.cueDistanceFromLine", { miles: formatMiles(offRouteMiles) })}
                  </span>
                )}
                {navigationState ? (
                  <span className="ride-status-card__chip">
                    {t("rideScreen.cueRemaining", {
                      miles: formatNavigationDistance(navigationState.remainingMiles)
                    })}
                  </span>
                ) : null}
                {navigationState?.activeLegDistanceMiles ? (
                  <span className="ride-status-card__chip">
                    {t("rideScreen.cueActiveLeg", {
                      miles: formatNavigationDistance(navigationState.activeLegDistanceMiles)
                    })}
                  </span>
                ) : null}
                <span className="ride-status-card__chip">
                  {routingProviderLabel
                    ? t("rideScreen.cueRoutingWith", { provider: routingProviderLabel })
                    : routingStatus === "loading"
                      ? t("rideScreen.cueRoutingLoading")
                      : t("rideScreen.cueRoutingFallback")}
                </span>
                {routedRoute?.steps?.length || routedToStart?.steps?.length ? (
                  <span className="ride-status-card__chip">{t("rideScreen.cueStreetCues")}</span>
                ) : null}
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
            </div>

            {directionsOpen ? (
              <DirectionsPanel
                directionSections={directionSections}
                navigationState={navigationState}
                onClose={() => setDirectionsOpen(false)}
                routingProviderLabel={routingProviderLabel}
                routingStatus={routingStatus}
                totalDirectionSteps={totalDirectionSteps}
              />
            ) : null}

            <div className="ride-screen__stats">
              <div>
                <span className="stat-label">{t("rideScreen.statRouteLength")}</span>
                <strong>{formatMiles(route.distanceMiles)}</strong>
              </div>
              <div>
                <span className="stat-label">{t("rideScreen.statElapsed")}</span>
                <strong>{formatDurationMinutes(elapsedMinutes)}</strong>
              </div>
              <div>
                <span className="stat-label">{t("rideScreen.statDistanceFromLine")}</span>
                <strong>{offRouteMiles === null ? "--" : formatMiles(offRouteMiles)}</strong>
              </div>
              <div>
                <span className="stat-label">{t("rideScreen.statTrail")}</span>
                <strong>{formatMiles(trailMiles)}</strong>
              </div>
            </div>

            <div className="editor editor--warm ride-screen__card">
              <p className="locked-note__lead">{t("rideScreen.controlsTitle")}</p>
              <p>{t("rideScreen.controlsBody")}</p>

              <div className="locked-note__actions">
                {tracking ? (
                  <button className="button button--outline button--sm" onClick={stopTracking} type="button">
                    {t("rideScreen.pauseGps")}
                  </button>
                ) : (
                  <button className="button button--primary button--sm" onClick={handleStartTracking} type="button">
                    {t("rideScreen.startGps")}
                  </button>
                )}

                {!rideStartedAt ? (
                  <button
                    className="button button--outline button--sm"
                    onClick={startRide}
                    type="button"
                  >
                    {t("rideScreen.startWithout")}
                  </button>
                ) : null}
                <button className="button button--outline button--sm" onClick={toggleRouteDirection} type="button">
                  {routeDirection === "forward"
                    ? t("rideScreen.reverseCourse")
                    : t("rideScreen.forwardCourse")}
                </button>
                <button className="button button--outline button--sm" onClick={() => navigate("/")} type="button">
                  {t("rideScreen.backToBoard")}
                </button>
              </div>

              <p className="ride-screen__support-note">{t("rideScreen.supportNote")}</p>

              <button
                className="button button--primary"
                disabled={busy || !rideStartedAt}
                onClick={() => void handleCompleteRide()}
                type="button"
              >
                {busy ? t("rideScreen.completing") : t("rideScreen.completeRide")}
              </button>

              <FormFeedback feedback={feedback} />
            </div>

            <div className="ride-screen__meta">
              <p>
                <strong>{t("rideScreen.metaStart")}:</strong> {route.start}
              </p>
              <p>
                <strong>{t("rideScreen.metaTerrain")}:</strong>{" "}
                {t(`terrain.${route.terrain}`) || route.terrain}
              </p>
              <p>
                <strong>{t("rideScreen.metaNotes")}:</strong> {route.notes}
              </p>
            </div>

            <div className="ride-screen__groups">
              <p className="section-kicker">{t("rideScreen.pinnedByGroups")}</p>
              {groupsUsingRoute.length ? (
                groupsUsingRoute.map((group) => (
                  <Link className="group-inline-link" key={group.id} to={`/groups/${group.id}`}>
                    {group.name}
                  </Link>
                ))
              ) : (
                <p className="empty-note">{t("rideScreen.pinnedEmpty")}</p>
              )}
            </div>

            <SuggestedRoutes
              currentRouteId={route.id}
              description={t("rideScreen.suggestedDescription")}
              member
              routes={data?.routes ?? []}
              title={t("rideScreen.suggestedTitle")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
