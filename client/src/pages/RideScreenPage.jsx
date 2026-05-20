import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import FormFeedback from "../components/FormFeedback";
import RouteMap from "../components/RouteMap";
import SuggestedRoutes from "../components/SuggestedRoutes";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
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
  const [voiceStatus, setVoiceStatus] = useState("Voice guidance off");
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
    () => buildDirectionSections({ route, routedRoute, routedToStart }),
    [route, routedRoute, routedToStart]
  );
  const totalDirectionSteps = directionSections.reduce(
    (total, section) => total + section.steps.length,
    0
  );
  const trailMiles = useMemo(() => computePathMiles(trail), [trail]);
  const routeStatus = useMemo(() => {
    if (offRouteMiles === null) {
      return {
        headline: navigationState?.cue.primary ?? (tracking ? "Waiting for GPS lock" : "Guidance ready"),
        detail: tracking
          ? "Your location will appear once the browser locks onto your position."
          : "Start GPS guidance when you are at the route start, or run the timer if you only want to log the ride."
      };
    }

    if (navigationState?.activeLeg === "to-start") {
      const toStartProviderLabel = formatRoutingProviderLabel(navigationState.toStartSource);

      return {
        headline: navigationState.cue.primary,
        detail:
          toStartProviderLabel
            ? `${toStartProviderLabel} routing is taking you to the saved start first. The route-to-finish leg starts once you reach it.`
            : "Head to the saved start first. The route-to-finish leg starts once you reach it."
      };
    }

    if (navigationState && !navigationState.snappedToRoute) {
      return {
        headline: "Return to route",
        detail: `You are ${formatMiles(offRouteMiles)} from the saved line. Move back toward the highlighted route.`
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
        headline: "Slight drift",
        detail: "You are a little off the saved line. Use the map to move back toward the route before the gap grows."
      };
    }

    return {
      headline: "Route check needed",
      detail: "You are clearly off the saved line. Pause, look at the map, and head back toward the highlighted route."
    };
  }, [navigationState, offRouteMiles, tracking]);

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

    async function loadRoadRoute() {
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

    void loadRoadRoute();

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

    async function loadRoadPathToStart() {
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

    void loadRoadPathToStart();

    return () => {
      cancelled = true;
    };
  }, [currentPosition, routePath]);

  if (loading) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>Loading the ride screen...</h1>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">North Star Ridebook</p>
          <h1>That route is not on the board.</h1>
          <Link className="button button--primary" to="/">
            Back to route board
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
        message: `Ride logged: ${formatMiles(payload.ride.distanceMiles)} in ${formatDurationMinutes(payload.ride.durationMinutes)}.`
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
      `Delete "${route.title}"? This removes it from the route board and any group pins.`
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
        state: { success: "Route deleted." }
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setDeleting(false);
    }
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: "This browser does not support live geolocation." });
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
          message:
            error.code === 1
              ? "Location access was denied. Allow geolocation for this site to follow the route live."
              : "Live route tracking failed. Try again in a stronger GPS signal."
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
      setVoiceStatus("Voice guidance off");
      lastSpokenCueRef.current = "";
      cancelVoiceNavigation();
      return;
    }

    if (!supportsVoiceNavigation()) {
      const message = "This browser does not support spoken navigation prompts.";
      setVoiceStatus(message);
      setFeedback({ type: "error", message });
      return;
    }

    setVoiceEnabled(true);
    setVoiceStatus("Voice guidance on. Turn prompts will announce as they approach.");
    speakNavigationInstruction("Voice guidance on.");
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section ride-screen">
        <div className="section-heading">
          <p className="section-kicker">Ride screen</p>
          <h1>{route.title}</h1>
          <p className="ride-screen__lead">
            Follow the saved line, watch your live position, and log a completed ride when you are
            done.
          </p>
          {isOwner ? (
            <div className="ride-screen__owner-actions">
              <Link className="button button--outline button--sm" to={`/routes/${route.id}/edit`}>
                Edit route
              </Link>
              <button
                className="button button--outline button--sm"
                disabled={deleting}
                onClick={() => void handleDeleteRoute()}
                type="button"
              >
                {deleting ? "Deleting route..." : "Delete route"}
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
              <p className="group-card__eyebrow">Live route cue</p>
              <h3>{routeStatus.headline}</h3>
              <p>{routeStatus.detail}</p>
              <div className="ride-status-card__chips">
                <span className="ride-status-card__chip">Start: {route.start}</span>
                <span className="ride-status-card__chip">Terrain: {route.terrain}</span>
                {offRouteMiles === null ? null : (
                  <span className="ride-status-card__chip">
                    Distance from line: {formatMiles(offRouteMiles)}
                  </span>
                )}
                {navigationState ? (
                  <span className="ride-status-card__chip">
                    Remaining: {formatNavigationDistance(navigationState.remainingMiles)}
                  </span>
                ) : null}
                {navigationState?.activeLegDistanceMiles ? (
                  <span className="ride-status-card__chip">
                    Active leg: {formatNavigationDistance(navigationState.activeLegDistanceMiles)}
                  </span>
                ) : null}
                <span className="ride-status-card__chip">
                  {routingProviderLabel
                    ? `${routingProviderLabel} routing`
                    : routingStatus === "loading"
                      ? "Routing roads..."
                      : "Saved line fallback"}
                </span>
                {routedRoute?.steps?.length || routedToStart?.steps?.length ? (
                  <span className="ride-status-card__chip">Street-name cues</span>
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
                  {directionsOpen ? "Hide directions" : "Directions"}
                </button>
                <button
                  className={`button button--outline button--sm${voiceEnabled ? " is-active" : ""}`}
                  onClick={toggleVoiceNavigation}
                  type="button"
                >
                  {voiceEnabled ? "Voice on" : "Voice navigation"}
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
                <span className="stat-label">Route length</span>
                <strong>{formatMiles(route.distanceMiles)}</strong>
              </div>
              <div>
                <span className="stat-label">Elapsed</span>
                <strong>{formatDurationMinutes(elapsedMinutes)}</strong>
              </div>
              <div>
                <span className="stat-label">Distance from line</span>
                <strong>{offRouteMiles === null ? "--" : formatMiles(offRouteMiles)}</strong>
              </div>
              <div>
                <span className="stat-label">Your trail</span>
                <strong>{formatMiles(trailMiles)}</strong>
              </div>
            </div>

            <div className="editor editor--warm ride-screen__card">
              <p className="locked-note__lead">Live ride controls</p>
              <p>
                Start GPS guidance when you roll out from the saved start. If you just want to log
                the effort, you can run the timer without live location.
              </p>

              <div className="locked-note__actions">
                {tracking ? (
                  <button className="button button--outline button--sm" onClick={stopTracking} type="button">
                    Pause GPS guidance
                  </button>
                ) : (
                  <button className="button button--primary button--sm" onClick={startTracking} type="button">
                    Start GPS guidance
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
                    Start ride without GPS
                  </button>
                ) : null}
              </div>

              <p className="ride-screen__support-note">
                Geolocation works on localhost in development. On a deployed site it will need
                HTTPS before browsers will share live position.
              </p>

              <button
                className="button button--primary"
                disabled={busy || !rideStartedAt}
                onClick={() => void handleCompleteRide()}
                type="button"
              >
                {busy ? "Logging ride..." : "Log finished ride"}
              </button>

              <FormFeedback feedback={feedback} />
            </div>

            <div className="ride-screen__meta">
              <p>
                <strong>Start:</strong> {route.start}
              </p>
              <p>
                <strong>Terrain:</strong> {route.terrain}
              </p>
              <p>
                <strong>Notes:</strong> {route.notes}
              </p>
            </div>

            <div className="ride-screen__groups">
              <p className="section-kicker">Pinned by groups</p>
              {groupsUsingRoute.length ? (
                groupsUsingRoute.map((group) => (
                  <Link className="group-inline-link" key={group.id} to={`/groups/${group.id}`}>
                    {group.name}
                  </Link>
                ))
              ) : (
                <p className="empty-note">No groups have pinned this route yet.</p>
              )}
            </div>

            <SuggestedRoutes
              currentRouteId={route.id}
              description="When this ride is done, queue up the next route without going back to a blank board."
              member
              routes={data?.routes ?? []}
              title="Suggested next rides"
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
  return (
    <aside
      aria-labelledby="directions-panel-title"
      className="directions-panel"
      id="directions-panel"
    >
      <div className="directions-panel__header">
        <div>
          <p className="group-card__eyebrow">Turn-by-turn</p>
          <h2 id="directions-panel-title">Directions</h2>
          <p>
            {navigationState?.cue?.primary ??
              (routingStatus === "loading"
                ? "Loading street directions."
                : "Start GPS guidance to see the active step.")}
          </p>
        </div>
        <button
          aria-label="Hide directions"
          className="directions-panel__close"
          onClick={onClose}
          type="button"
        >
          Hide
        </button>
      </div>

      <div className="directions-panel__summary">
        <span>{totalDirectionSteps} steps</span>
        <span>
          {routingProviderLabel
            ? `${routingProviderLabel} routing`
            : routingStatus === "loading"
              ? "Routing roads"
              : "Saved line fallback"}
        </span>
        {navigationState ? (
          <span>{formatNavigationDistance(navigationState.remainingMiles)} left</span>
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
                      {active ? <b>Current</b> : null}
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
  if (source === "valhalla") {
    return "Valhalla";
  }

  if (source === "osrm") {
    return "OSRM";
  }

  return null;
}

function buildDirectionSections({ route, routedRoute, routedToStart }) {
  if (!route) {
    return [];
  }

  const sections = [];
  const toStartSteps = normalizeDirectionSteps("to-start", routedToStart?.steps);
  const routeSteps = normalizeDirectionSteps("route", routedRoute?.steps);

  if (toStartSteps.length) {
    sections.push({
      key: "to-start",
      leg: "to-start",
      summary: formatDirectionSummary(routedToStart?.distanceMiles, routedToStart?.durationMinutes),
      steps: toStartSteps,
      title: "To route start"
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
      title: "Route to finish"
    });
  }

  if (!sections.length && route.path?.length >= 2) {
    sections.push({
      key: "saved-line",
      leg: "route",
      summary: formatDirectionSummary(route.distanceMiles),
      steps: [
        {
          detail: "Begin at the saved start point.",
          distanceLabel: "now",
          instruction: `Start at ${route.start}`,
          key: "saved-line-start",
          kind: "depart",
          originalIndex: -1
        },
        {
          detail: "Street directions will appear here when road routing is available.",
          distanceLabel: formatNavigationDistance(route.distanceMiles),
          instruction: "Follow the highlighted route line",
          key: "saved-line-follow",
          kind: "straight",
          originalIndex: -2
        },
        {
          detail: "Finish at the end of the saved route.",
          distanceLabel: "finish",
          instruction: "Arrive at finish",
          key: "saved-line-arrive",
          kind: "arrive",
          originalIndex: -3
        }
      ],
      title: "Saved route line"
    });
  }

  return sections;
}

function normalizeDirectionSteps(leg, steps) {
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
        detailParts.push(`Via ${streetName}`);
      }

      if (durationLabel) {
        detailParts.push(durationLabel);
      }

      return {
        detail: detailParts.join(" - ") || "Continue following the route.",
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
