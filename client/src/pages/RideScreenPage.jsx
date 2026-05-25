import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import FormFeedback from "../components/FormFeedback";
import RouteMap from "../components/RouteMap";
import SuggestedRoutes from "../components/SuggestedRoutes";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useTranslation } from "../i18n";
import {
  GPS_CAPTURE_OPTIONS,
  computePathMiles,
  distanceBetweenPointsMiles,
  distanceFromPointToPathMiles,
  formatDurationMinutes,
  formatNavigationDistance,
  formatMiles,
  getGpsAccuracyMeters,
  getRouteNavigationState,
  getRoutingWaypoints,
  gpsPositionToPoint,
  shouldAddGpsPoint
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
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [trail, setTrail] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [rideStartedAt, setRideStartedAt] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [routedRoute, setRoutedRoute] = useState(null);
  const [routedToStart, setRoutedToStart] = useState(null);
  const [routingStatus, setRoutingStatus] = useState("idle");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(t("rideScreen.voiceStatusOff"));
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [feedback, setFeedback] = useState(
    location.state?.success ? { type: "success", message: location.state.success } : null
  );
  const watchIdRef = useRef(null);
  const lastToStartRequestRef = useRef(null);
  const lastSpokenCueRef = useRef("");

  const route = data?.routes.find((item) => item.id === id);
  const routePath = route?.path ?? EMPTY_ROUTE_PATH;
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

  const navigationState = useMemo(
    () =>
      getRouteNavigationState(currentPosition, navigationPath, {
        plannedRoutePath: navigationPath,
        routeSteps: routedRoute?.steps,
        routingSource: routedRoute?.source ?? "local",
        toStartPath: routedToStart?.path,
        toStartSteps: routedToStart?.steps,
        toStartSource: routedToStart?.source ?? "local"
      }),
    [currentPosition, navigationPath, routedRoute, routedToStart]
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
  const trailMiles = useMemo(() => computePathMiles(trail), [trail]);
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
    if (!rideStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMinutes(Math.max(1, Math.round((Date.now() - rideStartedAt) / 60000)));
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [rideStartedAt]);

  useEffect(() => {
    return () => stopTracking();
  }, []);

  useEffect(() => {
    return () => cancelVoiceNavigation();
  }, []);

  useEffect(() => {
    if (!voiceEnabled) {
      return;
    }

    if (!tracking) {
      setVoiceStatus("Voice guidance waits for GPS tracking.");
      return;
    }

    const cue = navigationState?.cue;

    if (!cue?.voiceInstruction || !shouldSpeakNavigationCue(cue, navigationState)) {
      return;
    }

    const voiceKey = cue.voiceKey ?? `${navigationState.activeLeg}:${cue.primary}`;

    if (lastSpokenCueRef.current === voiceKey) {
      return;
    }

    lastSpokenCueRef.current = voiceKey;
    setVoiceStatus(cue.voiceInstruction);
    speakNavigationInstruction(cue.voiceInstruction);
  }, [
    navigationState?.activeLeg,
    navigationState?.cue,
    navigationState?.snappedToRoute,
    tracking,
    voiceEnabled
  ]);

  useEffect(() => {
    setRoutedRoute(null);
    setRoutedToStart(null);
    setRoutingStatus("idle");
    lastToStartRequestRef.current = null;

    if (!route?.path || route.path.length < 2) {
      return undefined;
    }

    let cancelled = false;

    async function loadBikeRoute() {
      setRoutingStatus("loading");

      try {
        const payload = await api.routePath(getRoutingWaypoints(route.path), "bike");

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
  }, [route?.id, route?.updatedAt]);

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
    let cancelled = false;

    async function loadBikePathToStart() {
      try {
        const payload = await api.routePath([currentPosition, routePath[0]], "bike");

        if (!cancelled && payload?.path?.length >= 2) {
          setRoutedToStart(payload);
        }
      } catch {
        if (!cancelled) {
          setRoutedToStart(null);
        }
      }
    }

    void loadBikePathToStart();

    return () => {
      cancelled = true;
    };
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
      setTrail([]);
      setRideStartedAt(null);
      setElapsedMinutes(0);
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

  function startTracking() {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: t("rideScreen.geoUnsupported") });
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    if (!rideStartedAt) {
      setRideStartedAt(Date.now());
      setElapsedMinutes(1);
    }

    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = gpsPositionToPoint(position);
        const accuracyMeters = getGpsAccuracyMeters(position);

        setCurrentPosition(point);
        setCurrentAccuracyMeters(accuracyMeters);
        setTrail((current) => {
          if (!shouldAddGpsPoint(current, point)) {
            return current;
          }

          return [...current, point];
        });
      },
      (error) => {
        stopTracking();
        setFeedback({
          type: "error",
          message: error.code === 1 ? t("rideScreen.trackDenied") : t("rideScreen.trackFailed")
        });
      },
      GPS_CAPTURE_OPTIONS
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
  }

  function toggleVoiceNavigation() {
    if (voiceEnabled) {
      setVoiceEnabled(false);
      setVoiceStatus(t("rideScreen.voiceStatusOff"));
      lastSpokenCueRef.current = "";
      cancelVoiceNavigation();
      return;
    }

    if (!supportsVoiceNavigation()) {
      const message = t("rideScreen.voiceUnsupported");
      setVoiceStatus(message);
      setFeedback({ type: "error", message });
      return;
    }

    setVoiceEnabled(true);
    setVoiceStatus(t("rideScreen.voiceStatusOn"));
    speakNavigationInstruction(t("rideScreen.voiceStatusOn"));
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
            <RouteMap
              currentAccuracyMeters={currentAccuracyMeters ?? undefined}
              currentPosition={currentPosition}
              height={640}
              navigationMode
              navigationState={navigationState}
              path={navigationPath}
              routeName={route.title}
              showLegend={false}
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
                  onClick={toggleVoiceNavigation}
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
                  <button className="button button--primary button--sm" onClick={startTracking} type="button">
                    {t("rideScreen.startGps")}
                  </button>
                )}

                {!rideStartedAt ? (
                  <button
                    className="button button--outline button--sm"
                    onClick={() => {
                      setRideStartedAt(Date.now());
                      setElapsedMinutes(1);
                    }}
                    type="button"
                  >
                    {t("rideScreen.startWithout")}
                  </button>
                ) : null}
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

function DirectionsPanel({
  directionSections,
  navigationState,
  onClose,
  routingProviderLabel,
  routingStatus,
  totalDirectionSteps
}) {
  const { t } = useTranslation();
  return (
    <aside
      aria-labelledby="directions-panel-title"
      className="directions-panel"
      id="directions-panel"
    >
      <div className="directions-panel__header">
        <div>
          <p className="group-card__eyebrow">{t("directions.kicker")}</p>
          <h2 id="directions-panel-title">{t("directions.title")}</h2>
          <p>
            {navigationState?.cue?.primary ??
              (routingStatus === "loading" ? t("directions.loading") : t("directions.idle"))}
          </p>
        </div>
        <button
          aria-label={t("directions.hide")}
          className="directions-panel__close"
          onClick={onClose}
          type="button"
        >
          {t("directions.hide")}
        </button>
      </div>

      <div className="directions-panel__summary">
        <span>{t("directions.steps", { count: totalDirectionSteps })}</span>
        <span>
          {routingProviderLabel
            ? t("rideScreen.cueRoutingWith", { provider: routingProviderLabel })
            : routingStatus === "loading"
              ? t("rideScreen.cueRoutingLoading")
              : t("rideScreen.cueRoutingFallback")}
        </span>
        {navigationState ? (
          <span>{t("rideScreen.cueRemaining", { miles: formatNavigationDistance(navigationState.remainingMiles) })}</span>
        ) : null}
      </div>

      <div className="directions-panel__body">
        {directionSections.map((section) => (
          <section className="directions-panel__section" key={section.key}>
            <div className="directions-panel__section-heading">
              <h3>{section.title}</h3>
              {section.summary ? <span>{section.summary}</span> : null}
            </div>
            <ol className="directions-panel__steps">
              {section.steps.map((step) => {
                const active =
                  navigationState?.activeLeg === section.leg &&
                  navigationState?.cue?.stepIndex === step.originalIndex;

                return (
                  <li
                    className={`directions-panel__step${active ? " is-active" : ""}`}
                    key={step.key}
                  >
                    <span
                      aria-hidden="true"
                      className={`directions-panel__step-icon directions-panel__step-icon--${step.kind}`}
                    />
                    <div className="directions-panel__step-copy">
                      <strong>{step.instruction}</strong>
                      <span>{step.detail}</span>
                    </div>
                    <div className="directions-panel__step-meta">
                      <span>{step.distanceLabel}</span>
                      {active ? <b>{t("directions.current")}</b> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}

function formatRoutingProviderLabel(source) {
  if (source === "graphhopper") {
    return "GraphHopper";
  }

  if (source === "valhalla") {
    return "Valhalla";
  }

  if (source === "osrm") {
    return "OSRM";
  }

  return null;
}

function buildDirectionSections({ route, routedRoute, routedToStart, t }) {
  if (!route) {
    return [];
  }

  const sections = [];
  const toStartSteps = normalizeDirectionSteps("to-start", routedToStart?.steps, t);
  const routeSteps = normalizeDirectionSteps("route", routedRoute?.steps, t);

  if (toStartSteps.length) {
    sections.push({
      key: "to-start",
      leg: "to-start",
      summary: formatDirectionSummary(routedToStart?.distanceMiles, routedToStart?.durationMinutes),
      steps: toStartSteps,
      title: t("directions.sectionToStart")
    });
  }

  if (routeSteps.length) {
    sections.push({
      key: "route",
      leg: "route",
      summary: formatDirectionSummary(
        routedRoute?.distanceMiles ?? route.distanceMiles,
        routedRoute?.durationMinutes
      ),
      steps: routeSteps,
      title: t("directions.sectionRoute")
    });
  }

  if (!sections.length && route.path?.length >= 2) {
    sections.push({
      key: "saved-line",
      leg: "route",
      summary: formatDirectionSummary(route.distanceMiles),
      steps: [
        {
          detail: t("directions.detailFallback"),
          distanceLabel: formatNavigationDistance(0.005),
          instruction: t("directions.stepSavedStart", { start: route.start }),
          key: "saved-line-start",
          kind: "depart",
          originalIndex: -1
        },
        {
          detail: t("directions.detailSavedFollow"),
          distanceLabel: formatNavigationDistance(route.distanceMiles),
          instruction: t("directions.stepSavedFollow"),
          key: "saved-line-follow",
          kind: "straight",
          originalIndex: -2
        },
        {
          detail: t("directions.detailSavedFinish"),
          distanceLabel: formatNavigationDistance(0),
          instruction: t("directions.stepSavedArrive"),
          key: "saved-line-arrive",
          kind: "arrive",
          originalIndex: -3
        }
      ],
      title: t("directions.sectionSaved")
    });
  }

  return sections;
}

function normalizeDirectionSteps(leg, steps, t) {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && (step.instruction || step.voiceInstruction))
    .map((step, index) => {
      const instruction = cleanDirectionText(step.instruction || step.voiceInstruction);
      const streetName = cleanDirectionText(step.name);
      const distanceLabel = formatNavigationDistance(step.distanceMiles);
      const durationLabel = step.durationMinutes
        ? formatDurationMinutes(step.durationMinutes)
        : "";
      const detailParts = [];

      if (streetName && !/unnamed/i.test(streetName)) {
        detailParts.push(t("directions.detailVia", { street: streetName }));
      }

      if (durationLabel) {
        detailParts.push(durationLabel);
      }

      return {
        detail: detailParts.join(" · ") || t("directions.detailContinue"),
        distanceLabel,
        instruction,
        key: `${leg}-${index}-${step.type || "step"}`,
        kind: getDirectionStepKind(step, instruction),
        originalIndex: index
      };
    });
}

function formatDirectionSummary(distanceMiles, durationMinutes) {
  const parts = [];

  if (Number.isFinite(Number(distanceMiles)) && Number(distanceMiles) > 0) {
    parts.push(formatNavigationDistance(distanceMiles));
  }

  if (Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0) {
    parts.push(formatDurationMinutes(durationMinutes));
  }

  return parts.join(" - ");
}

function cleanDirectionText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDirectionStepKind(step, instruction) {
  const type = String(step.type || "").toLowerCase();
  const text = `${step.modifier || ""} ${instruction}`.toLowerCase();

  if (type.includes("arrive") || /arrive|destination|finish/.test(text)) {
    return "arrive";
  }

  if (type.includes("depart") || /start|depart/.test(text)) {
    return "depart";
  }

  if (/left/.test(text)) {
    return "left";
  }

  if (/right/.test(text)) {
    return "right";
  }

  return "straight";
}

function supportsVoiceNavigation() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function shouldSpeakNavigationCue(cue, navigationState) {
  if (
    !navigationState ||
    (navigationState.activeLeg === "route" && !navigationState.snappedToRoute)
  ) {
    return false;
  }

  if (cue.type === "depart") {
    return true;
  }

  if (cue.type === "arrive") {
    return cue.distanceMiles === undefined || cue.distanceMiles <= 0.08;
  }

  if (cue.distanceMiles === undefined) {
    return true;
  }

  return cue.distanceMiles <= 0.25;
}

function speakNavigationInstruction(text) {
  if (!supportsVoiceNavigation()) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function cancelVoiceNavigation() {
  if (supportsVoiceNavigation()) {
    window.speechSynthesis.cancel();
  }
}
