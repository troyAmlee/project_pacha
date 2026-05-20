import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import FormFeedback from "../components/FormFeedback";
import RouteMap from "../components/RouteMap";
import SuggestedRoutes from "../components/SuggestedRoutes";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import {
  GPS_CAPTURE_OPTIONS,
  computePathMiles,
  formatDurationMinutes,
  formatMiles,
  getGpsAccuracyMeters,
  getRoutingWaypoints,
  gpsPositionToPoint,
  shouldAddGpsPoint
} from "../utils";

const emptyForm = {
  title: "",
  start: "",
  terrain: "city streets",
  notes: ""
};

export default function RouteBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { member } = useAuth();
  const { data, loading, loadBootstrap } = useClubData();
  const { values, handleChange, setValues } = useForm(emptyForm);
  const [mode, setMode] = useState("draw");
  const [path, setPath] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [gpsStatus, setGpsStatus] = useState(
    "Click the map to draw a route or switch to live GPS recording."
  );
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const watchIdRef = useRef(null);
  const hydratedRouteIdRef = useRef("");

  const isEditing = Boolean(id);
  const routeToEdit = data?.routes.find((route) => route.id === id);
  const isOwner = routeToEdit ? routeToEdit.createdById === member?.id : false;
  const pathMiles = useMemo(() => computePathMiles(path), [path]);
  const greenwaySelected = values.terrain === "greenway";
  const modeLead =
    mode === "draw"
      ? "Sketch a clean line first, then save it so the GPS ride screen has a route to follow."
      : "Record a live ride when you want the route to come directly from the street or trail.";

  useEffect(() => {
    if (!recording || !recordingStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setElapsedMinutes(Math.max(1, Math.round((Date.now() - recordingStartedAt) / 60000)));
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [recording, recordingStartedAt]);

  useEffect(() => {
    return () => stopRecording();
  }, []);

  useEffect(() => {
    hydratedRouteIdRef.current = "";
  }, [id]);

  useEffect(() => {
    if (!routeToEdit || hydratedRouteIdRef.current === routeToEdit.id) {
      return;
    }

    stopRecording();
    setValues({
      title: routeToEdit.title,
      start: routeToEdit.start,
      terrain: routeToEdit.terrain,
      notes: routeToEdit.notes
    });
    setPath(routeToEdit.path ?? []);
    setCurrentPosition(null);
    setCurrentAccuracyMeters(null);
    setMode(routeToEdit.source === "record" ? "record" : "draw");
    setElapsedMinutes(0);
    setRecordingStartedAt(null);
    setFeedback(null);
    setGpsStatus(
      `Editing ${routeToEdit.title}. Update the line or notes, then save your changes.`
    );
    hydratedRouteIdRef.current = routeToEdit.id;
  }, [routeToEdit, setValues]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      if (path.length < 2) {
        throw new Error("Add at least two points to the route before saving it.");
      }

      const saveablePath = await getSaveablePath(path);
      const routePath = saveablePath.path;
      const payload = await (isEditing
        ? api.putJson(`/api/routes/${routeToEdit.id}`, {
            ...values,
            path: routePath,
            startCoords: routePath[0],
            mode
          })
        : api.postJson("/api/routes", {
            ...values,
            path: routePath,
            startCoords: routePath[0],
            mode,
            logRide: mode === "record" && elapsedMinutes > 0,
            rideDurationMinutes: elapsedMinutes || 1
          }));

      await loadBootstrap();
      navigate(`/routes/${payload.route.id}/ride`, {
        replace: true,
        state: {
          success: buildRouteSaveMessage({
            isEditing,
            ride: payload.ride,
            matchSource: saveablePath.matchSource
          })
        }
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function getSaveablePath(rawPath) {
    if (mode !== "record") {
      return { path: rawPath, matchSource: null };
    }

    setGpsStatus("Snapping recorded GPS to nearby roads and trails...");

    try {
      const payload = await api.matchPath(getRoutingWaypoints(rawPath, 180), "bike");

      if (payload?.path?.length >= 2) {
        return { path: payload.path, matchSource: payload.source };
      }
    } catch {
      setGpsStatus("Street snapping was unavailable, so the raw GPS line will be saved.");
    }

    return { path: rawPath, matchSource: null };
  }

  async function handleDeleteRoute() {
    if (!routeToEdit) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${routeToEdit.title}"? This removes it from the route board and any group pins.`
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setFeedback(null);

    try {
      stopRecording();
      await api.delete(`/api/routes/${routeToEdit.id}`);
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

  function handleUseSuggestedRoute(route) {
    stopRecording();
    setMode("draw");
    setValues({
      title: route.title,
      start: route.start,
      terrain: route.terrain,
      notes: route.notes
    });
    setPath(route.path ?? []);
    setCurrentPosition(null);
    setCurrentAccuracyMeters(null);
    setElapsedMinutes(0);
    setRecordingStartedAt(null);
    setFeedback(null);
    setGpsStatus(
      `${route.title} is loaded as a starting point. Adjust the line or notes, then save your version.`
    );
  }

  function handleMapClick(point) {
    if (mode !== "draw") {
      return;
    }

    setPath((current) => [...current, point]);
  }

  function handleUndoPoint() {
    setPath((current) => current.slice(0, -1));
  }

  function handleClearPath() {
    stopRecording();
    setPath([]);
    setCurrentPosition(null);
    setCurrentAccuracyMeters(null);
    setElapsedMinutes(0);
    setRecordingStartedAt(null);
    setFeedback(null);
    setGpsStatus(
      mode === "record"
        ? "Recording cleared. Start GPS capture again when you are ready."
        : "Path cleared. Click the map to lay down a new route."
    );
  }

  function startRecording() {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: "This browser does not support live geolocation." });
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setMode("record");
    setPath([]);
    setCurrentPosition(null);
    setCurrentAccuracyMeters(null);
    setRecording(true);
    setRecordingStartedAt(Date.now());
    setElapsedMinutes(1);
    setGpsStatus("Waiting for GPS points. Keep this page open while you ride.");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = gpsPositionToPoint(position);
        const accuracyMeters = getGpsAccuracyMeters(position);

        setCurrentPosition(point);
        setCurrentAccuracyMeters(accuracyMeters);

        setPath((current) => {
          if (!shouldAddGpsPoint(current, point)) {
            return current;
          }

          return [...current, point];
        });

        setGpsStatus(
          "GPS capture is live with tighter points. Stop recording when the route is complete."
        );
      },
      (error) => {
        stopRecording();
        setFeedback({
          type: "error",
          message:
            error.code === 1
              ? "Location access was denied. Use draw mode or allow geolocation for this site."
              : "Live GPS capture failed. Try again or use draw mode."
        });
      },
      GPS_CAPTURE_OPTIONS
    );
  }

  function stopRecording() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setRecording(false);

    if (recordingStartedAt) {
      setElapsedMinutes(Math.max(1, Math.round((Date.now() - recordingStartedAt) / 60000)));
    }
  }

  if (loading || !data) {
    return (
      <div className="loading-state">
        <p className="loading-kicker">North Star Ridebook</p>
        <h1>{isEditing ? "Loading route editor..." : "Loading route builder..."}</h1>
      </div>
    );
  }

  if (isEditing && !routeToEdit) {
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

  if (isEditing && !isOwner) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">North Star Ridebook</p>
          <h1>You can only edit routes that you created.</h1>
          <Link className="button button--primary" to={`/routes/${routeToEdit.id}/ride`}>
            Back to ride screen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopBar minimal />

      <section className="content-section route-builder">
        <div className="section-heading">
          <p className="section-kicker">{isEditing ? "Route editor" : "Route builder"}</p>
          <h1>
            {isEditing
              ? "Refine the route before the next rider opens it."
              : "Make the route easy to read before anyone tries to follow it on a bike."}
          </h1>
          <p className="route-builder__lead">
            Saved routes keep their geometry, and Greenway routes get a dedicated guide overlay so
            riders can tell at a glance where the corridor sits on the map.
          </p>
        </div>

        <div className="route-builder__layout">
          <div className="route-builder__controls">
            <div className="mode-switch">
              <button
                className={`button button--outline button--sm${mode === "draw" ? " is-active" : ""}`}
                onClick={() => {
                  stopRecording();
                  setMode("draw");
                  setCurrentPosition(null);
                  setCurrentAccuracyMeters(null);
                  setGpsStatus("Sketch mode is active. Click turns, regroup points, or trail bends on the map.");
                }}
                type="button"
              >
                Sketch route
              </button>
              <button
                className={`button button--outline button--sm${mode === "record" ? " is-active" : ""}`}
                onClick={() => {
                  setMode("record");
                  setGpsStatus(
                    "Live ride mode is active. Start GPS capture when you are rolling and keep this page open."
                  );
                }}
                type="button"
              >
                Record live ride
              </button>
            </div>

            <div className="editor editor--paper route-builder__guide">
              <p className="group-card__eyebrow">How to use it</p>
              <h3>{mode === "draw" ? "Sketch first, then save." : "Record the line as you ride."}</h3>
              <p>{modeLead}</p>
              <ol className="step-list">
                <li>
                  {mode === "draw"
                    ? "Tap the route in order, from start to finish."
                    : "Grant location access and start GPS capture at the real start point."}
                </li>
                <li>
                  {greenwaySelected
                    ? "Keep the Midtown Greenway guide in view so your line matches the corridor."
                    : "Name the route and label the start so riders know where to roll out."}
                </li>
                <li>Save the route, then open the ride screen to follow it live or log the ride.</li>
              </ol>
            </div>

            {isEditing ? null : (
              <SuggestedRoutes
                actionLabel="Load into builder"
                description="Use a club route as a starting template instead of drawing from a blank map."
                member
                onAction={handleUseSuggestedRoute}
                routes={data.routes}
                showRideLink={false}
                title="Start from a proven line"
              />
            )}

            <form className="editor editor--cool" onSubmit={handleSubmit}>
              <label>
                Route name
                <input
                  name="title"
                  onChange={handleChange}
                  placeholder="West River recovery loop"
                  required
                  value={values.title}
                />
              </label>
              <label>
                Start point label
                <input
                  name="start"
                  onChange={handleChange}
                  placeholder="Stone Arch Bridge"
                  required
                  value={values.start}
                />
              </label>
              <label>
                Terrain
                <select name="terrain" onChange={handleChange} value={values.terrain}>
                  <option value="city streets">City streets</option>
                  <option value="greenway">Greenway</option>
                  <option value="gravel">Gravel</option>
                  <option value="mixed surface">Mixed surface</option>
                </select>
              </label>
              <label>
                Ride notes
                <textarea
                  name="notes"
                  onChange={handleChange}
                  placeholder="What should another rider know before they follow this route?"
                  rows="5"
                  value={values.notes}
                />
              </label>

              <div className="route-builder__stats">
                <div>
                  <span className="stat-label">Path length</span>
                  <strong>{formatMiles(pathMiles)}</strong>
                </div>
                <div>
                  <span className="stat-label">Recorded time</span>
                  <strong>{formatDurationMinutes(elapsedMinutes)}</strong>
                </div>
                <div>
                  <span className="stat-label">Points</span>
                  <strong>{path.length}</strong>
                </div>
              </div>

              {mode === "draw" ? (
                <div className="route-builder__toolstrip">
                  <button
                    className="button button--outline button--sm"
                    onClick={handleUndoPoint}
                    disabled={path.length === 0}
                    type="button"
                  >
                    Undo last point
                  </button>
                  <button
                    className="button button--outline button--sm"
                    onClick={handleClearPath}
                    disabled={path.length === 0}
                    type="button"
                  >
                    Clear sketch
                  </button>
                </div>
              ) : (
                <div className="route-builder__toolstrip">
                  {recording ? (
                    <button
                      className="button button--outline button--sm"
                      onClick={stopRecording}
                      type="button"
                    >
                      Stop GPS capture
                    </button>
                  ) : (
                    <button
                      className="button button--primary button--sm"
                      onClick={startRecording}
                      type="button"
                    >
                      Start GPS capture
                    </button>
                  )}
                  <button
                    className="button button--outline button--sm"
                    onClick={handleClearPath}
                    disabled={path.length === 0 && !recording}
                    type="button"
                  >
                    Reset ride trace
                  </button>
                </div>
              )}

              <p className="route-builder__status">{gpsStatus}</p>
              <FormFeedback feedback={feedback} />

              <div className="route-builder__submit-row">
                <button className="button button--primary" disabled={busy || deleting} type="submit">
                  {busy
                    ? isEditing
                      ? "Saving changes..."
                      : "Saving route..."
                    : isEditing
                      ? "Save changes"
                      : "Save route to club"}
                </button>

                {isEditing ? (
                  <button
                    className="button button--outline"
                    disabled={busy || deleting}
                    onClick={() => void handleDeleteRoute()}
                    type="button"
                  >
                    {deleting ? "Deleting route..." : "Delete route"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="route-builder__map-panel">
            <RouteMap
              currentAccuracyMeters={currentAccuracyMeters ?? undefined}
              currentPosition={mode === "record" ? currentPosition : null}
              height={520}
              interactive={mode === "draw"}
              onMapClick={handleMapClick}
              path={path}
              routeName={values.title}
              showGreenwayGuide={greenwaySelected}
              startLabel={values.start}
              terrain={values.terrain}
            />
            <p className="route-builder__map-note">
              {mode === "draw"
                ? "Sketch mode: every tap adds a point, so use turns, crossings, and clear regroup spots."
                : "Live mode: GPS points appear as they are captured, so keep the page open until the ride is done."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildRouteSaveMessage({ isEditing, ride, matchSource }) {
  const providerLabel = formatRoutingProviderLabel(matchSource);

  if (isEditing) {
    return providerLabel
      ? `Route updated with ${providerLabel} street matching.`
      : "Route updated.";
  }

  if (ride) {
    return providerLabel
      ? `Route saved with ${providerLabel} street matching and your recorded ride was logged.`
      : "Route saved and your recorded ride was logged.";
  }

  return providerLabel
    ? `Route saved with ${providerLabel} street matching. Open the ride screen to follow it live.`
    : "Route saved. Open the ride screen to follow it live.";
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
