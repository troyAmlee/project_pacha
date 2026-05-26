import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import AddressSearch from "../components/AddressSearch";
import FormFeedback from "../components/FormFeedback";
import RouteMap from "../components/RouteMap";
import SuggestedRoutes from "../components/SuggestedRoutes";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { useClubData } from "../context/ClubDataContext";
import { useForm } from "../hooks/useForm";
import { useTranslation } from "../i18n";
import { resolveSaveablePath } from "../routeSaving";
import {
  GPS_CAPTURE_OPTIONS,
  computePathMiles,
  formatDurationMinutes,
  formatMiles,
  getGpsAccuracyMeters,
  getPathCenter,
  getRoutingWaypoints,
  gpsPositionToPoint,
  MINNEAPOLIS_CENTER,
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
  const { t, lang } = useTranslation();
  const { values, handleChange, setValues } = useForm(emptyForm);
  const [mode, setMode] = useState("draw");
  const [path, setPath] = useState([]);
  const [routedSketchPath, setRoutedSketchPath] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [currentAccuracyMeters, setCurrentAccuracyMeters] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [gpsStatus, setGpsStatus] = useState(t("routeBuilder.gpsClickStart"));
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [addressMode, setAddressMode] = useState("append");
  const watchIdRef = useRef(null);
  const hydratedRouteIdRef = useRef("");

  const isEditing = Boolean(id);
  const routeToEdit = data?.routes.find((route) => route.id === id);
  const isOwner = routeToEdit ? routeToEdit.createdById === member?.id : false;
  const displayPath =
    mode === "draw" && routedSketchPath.length >= 2 ? routedSketchPath : path;
  const pathMiles = useMemo(() => computePathMiles(displayPath), [displayPath]);
  const greenwaySelected = values.terrain === "greenway";
  const modeLead =
    mode === "draw" ? t("routeBuilder.guideSketchLead") : t("routeBuilder.guideRecordLead");

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
    if (mode !== "draw" || path.length < 2) {
      setRoutedSketchPath([]);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setGpsStatus(t("routeBuilder.routeSnapping"));

      try {
        const payload = await api.routePath(getRoutingWaypoints(path), "bike");

        if (cancelled) {
          return;
        }

        if (payload?.path?.length >= 2) {
          setRoutedSketchPath(payload.path);
          setGpsStatus(
            t("routeBuilder.routePreviewReady", {
              provider: formatRoutingProviderLabel(payload.source) ?? t("routeBuilder.routePreviewProvider")
            })
          );
          return;
        }

        setRoutedSketchPath([]);
      } catch {
        if (!cancelled) {
          setRoutedSketchPath([]);
          setGpsStatus(t("routeBuilder.routeSnapFailed"));
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [mode, path, t]);

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
    setGpsStatus(t("routeBuilder.gpsEditing", { title: routeToEdit.title }));
    hydratedRouteIdRef.current = routeToEdit.id;
  }, [routeToEdit, setValues]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      if (path.length < 2) {
        throw new Error(t("routeBuilder.errorMinPoints"));
      }

      const saveablePath = await resolveSaveablePath({
        api,
        mode,
        rawPath: path,
        setStatus: setGpsStatus,
        t
      });
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
            matchSource: saveablePath.matchSource,
            t
          })
        }
      });
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRoute() {
    if (!routeToEdit) {
      return;
    }

    const confirmed = window.confirm(
      t("rideScreen.confirmDelete", { title: routeToEdit.title })
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
        state: { success: t("rideScreen.routeDeletedFeedback") }
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
    setGpsStatus(t("routeBuilder.gpsLoadedSuggestion", { title: route.title }));
  }

  function handleMapClick(point) {
    if (mode !== "draw") {
      return;
    }

    setPath((current) => [...current, point]);
    setSelectedPointIndex(null);
  }

  function handleUndoPoint() {
    setPath((current) => {
      const next = current.slice(0, -1);
      setSelectedPointIndex((selected) =>
        selected != null && selected >= next.length ? null : selected
      );
      return next;
    });
  }

  function handleClearPath() {
    stopRecording();
    setPath([]);
    setCurrentPosition(null);
    setCurrentAccuracyMeters(null);
    setElapsedMinutes(0);
    setRecordingStartedAt(null);
    setFeedback(null);
    setSelectedPointIndex(null);
    setGpsStatus(
      mode === "record" ? t("routeBuilder.gpsCleared") : t("routeBuilder.pathCleared")
    );
  }

  function handlePointSelect(index) {
    setSelectedPointIndex((current) => (current === index ? null : index));
  }

  function handleStartFromHome() {
    if (!member?.home) return;
    setPath([member.home]);
    setSelectedPointIndex(null);
    setGpsStatus(t("routeBuilder.startedFromHome"));
  }

  function handleStartFromCurrent() {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: t("rideScreen.geoUnsupported") });
      return;
    }
    setGpsStatus(t("routeBuilder.locatingStart"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = gpsPositionToPoint(position);
        setPath([point]);
        setSelectedPointIndex(null);
        setGpsStatus(t("routeBuilder.startedFromCurrent"));
      },
      (error) => {
        setGpsStatus(t("routeBuilder.gpsClickStart"));
        setFeedback({
          type: "error",
          message: error.code === 1 ? t("rideScreen.geoDenied") : t("rideScreen.geoFailed")
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function handleAddressSelect(result) {
    if (!result?.point) return;
    if (addressMode === "replace" && selectedPointIndex != null) {
      setPath((current) => {
        if (selectedPointIndex >= current.length) return current;
        const next = current.slice();
        next[selectedPointIndex] = result.point;
        return next;
      });
      setGpsStatus(t("routeBuilder.addressReplaced", { address: result.primary }));
      return;
    }

    setPath((current) => [...current, result.point]);
    setSelectedPointIndex(null);
    setGpsStatus(t("routeBuilder.addressAppended", { address: result.primary }));
  }

  function startRecording() {
    if (!navigator.geolocation) {
      setFeedback({ type: "error", message: t("rideScreen.geoUnsupported") });
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
    setGpsStatus(t("routeBuilder.gpsWaiting"));

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

        setGpsStatus(t("routeBuilder.gpsLive"));
      },
      (error) => {
        stopRecording();
        setFeedback({
          type: "error",
          message: error.code === 1 ? t("rideScreen.geoDenied") : t("rideScreen.geoFailed")
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
        <p className="loading-kicker">Xxica</p>
        <h1>{isEditing ? t("routeBuilder.loadingEditor") : t("routeBuilder.loadingBuilder")}</h1>
      </div>
    );
  }

  if (isEditing && !routeToEdit) {
    return (
      <div className="app-shell">
        <TopBar minimal />
        <div className="loading-state loading-state--error">
          <p className="loading-kicker">Xxica</p>
          <h1>{t("routeBuilder.notOnBoard")}</h1>
          <Link className="button button--primary" to="/">
            {t("routeBuilder.backToBoard")}
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
          <p className="loading-kicker">Xxica</p>
          <h1>{t("routeBuilder.ownerOnly")}</h1>
          <Link className="button button--primary" to={`/routes/${routeToEdit.id}/ride`}>
            {t("routeBuilder.backToRide")}
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
          <p className="section-kicker">{isEditing ? t("routeBuilder.kickerEditor") : t("routeBuilder.kickerBuilder")}</p>
          <h1>{isEditing ? t("routeBuilder.titleEditor") : t("routeBuilder.titleBuilder")}</h1>
          <p className="route-builder__lead">{t("routeBuilder.lead")}</p>
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
                  setGpsStatus(t("routeBuilder.sketchActive"));
                }}
                type="button"
              >
                {t("routeBuilder.modeSketch")}
              </button>
              <button
                className={`button button--outline button--sm${mode === "record" ? " is-active" : ""}`}
                onClick={() => {
                  setMode("record");
                  setGpsStatus(t("routeBuilder.recordActive"));
                }}
                type="button"
              >
                {t("routeBuilder.modeRecord")}
              </button>
            </div>

            <div className="editor editor--paper route-builder__guide">
              <p className="group-card__eyebrow">{t("routeBuilder.guideHowKicker")}</p>
              <h3>{mode === "draw" ? t("routeBuilder.guideSketchTitle") : t("routeBuilder.guideRecordTitle")}</h3>
              <p>{modeLead}</p>
              <ol className="step-list">
                <li>{mode === "draw" ? t("routeBuilder.stepSketch1") : t("routeBuilder.stepRecord1")}</li>
                <li>{greenwaySelected ? t("routeBuilder.stepGreenway") : t("routeBuilder.stepName")}</li>
                <li>{t("routeBuilder.stepSave")}</li>
              </ol>
            </div>

            {isEditing ? null : (
              <SuggestedRoutes
                actionLabel={t("suggested.action")}
                description={t("suggested.description")}
                member
                onAction={handleUseSuggestedRoute}
                routes={data.routes}
                showRideLink={false}
                title={t("suggested.title")}
              />
            )}

            <form className="editor editor--cool" onSubmit={handleSubmit}>
              <label>
                {t("routeBuilder.labelTitle")}
                <input
                  name="title"
                  onChange={handleChange}
                  placeholder={t("routeBuilder.labelTitlePlaceholder")}
                  required
                  value={values.title}
                />
              </label>
              <label>
                {t("routeBuilder.labelStart")}
                <input
                  name="start"
                  onChange={handleChange}
                  placeholder={t("routeBuilder.labelStartPlaceholder")}
                  required
                  value={values.start}
                />
              </label>
              <label>
                {t("routeBuilder.labelTerrain")}
                <select name="terrain" onChange={handleChange} value={values.terrain}>
                  <option value="city streets">{t("terrain.city streets")}</option>
                  <option value="greenway">{t("terrain.greenway")}</option>
                  <option value="gravel">{t("terrain.gravel")}</option>
                  <option value="mixed surface">{t("terrain.mixed surface")}</option>
                </select>
              </label>
              <label>
                {t("routeBuilder.labelNotes")}
                <textarea
                  name="notes"
                  onChange={handleChange}
                  placeholder={t("routeBuilder.labelNotesPlaceholder")}
                  rows="5"
                  value={values.notes}
                />
              </label>

              <div className="route-builder__stats">
                <div>
                  <span className="stat-label">{t("routeBuilder.statLength")}</span>
                  <strong>{formatMiles(pathMiles)}</strong>
                </div>
                <div>
                  <span className="stat-label">{t("routeBuilder.statRecorded")}</span>
                  <strong>{formatDurationMinutes(elapsedMinutes)}</strong>
                </div>
                <div>
                  <span className="stat-label">{t("routeBuilder.statPoints")}</span>
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
                    {t("routeBuilder.undoPoint")}
                  </button>
                  <button
                    className="button button--outline button--sm"
                    onClick={handleClearPath}
                    disabled={path.length === 0}
                    type="button"
                  >
                    {t("routeBuilder.clearSketch")}
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
                      {t("routeBuilder.stopGps")}
                    </button>
                  ) : (
                    <button
                      className="button button--primary button--sm"
                      onClick={startRecording}
                      type="button"
                    >
                      {t("routeBuilder.startGps")}
                    </button>
                  )}
                  <button
                    className="button button--outline button--sm"
                    onClick={handleClearPath}
                    disabled={path.length === 0 && !recording}
                    type="button"
                  >
                    {t("routeBuilder.resetTrace")}
                  </button>
                </div>
              )}

              <p className="route-builder__status">{gpsStatus}</p>
              <FormFeedback feedback={feedback} />

              <div className="route-builder__submit-row">
                <button className="button button--primary" disabled={busy || deleting} type="submit">
                  {busy
                    ? isEditing
                      ? t("routeBuilder.submitEditing")
                      : t("routeBuilder.submitSaving")
                    : isEditing
                      ? t("routeBuilder.submitEdit")
                      : t("routeBuilder.submitSave")}
                </button>

                {isEditing ? (
                  <button
                    className="button button--outline"
                    disabled={busy || deleting}
                    onClick={() => void handleDeleteRoute()}
                    type="button"
                  >
                    {deleting ? t("routeBuilder.deletingRoute") : t("routeBuilder.deleteRoute")}
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="route-builder__map-panel">
            {mode === "draw" ? (
              <AddressSearch
                proximity={
                  path.length
                    ? getPathCenter(path)
                    : member?.home ?? MINNEAPOLIS_CENTER
                }
                language={lang}
                mode={addressMode}
                canReplace={selectedPointIndex != null}
                onModeChange={setAddressMode}
                onSelectResult={handleAddressSelect}
              />
            ) : null}
            <div className="route-builder__map-stack">
              {mode === "draw" && path.length === 0 ? (
                <div className="route-builder__start-overlay">
                  <p className="route-builder__start-overlay-prompt">
                    {t("routeBuilder.startPrompt")}
                  </p>
                  <div className="route-builder__start-overlay-actions">
                    {member?.home ? (
                      <button
                        type="button"
                        className="button button--primary button--sm"
                        onClick={handleStartFromHome}
                      >
                        {t("routeBuilder.startFromHome")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button--outline button--sm"
                      onClick={handleStartFromCurrent}
                    >
                      {t("routeBuilder.startFromCurrent")}
                    </button>
                  </div>
                  {!member?.home ? (
                    <p className="route-builder__start-overlay-hint">
                      {t("routeBuilder.startSetHomeHint")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <RouteMap
              currentAccuracyMeters={currentAccuracyMeters ?? undefined}
              currentPosition={mode === "record" ? currentPosition : null}
              height={520}
              interactive={mode === "draw"}
              onMapClick={handleMapClick}
              homePoint={member?.home ?? null}
              onPointSelect={mode === "draw" ? handlePointSelect : null}
              path={displayPath}
              routeName={values.title}
              selectablePoints={mode === "draw" ? path : null}
              selectedPointIndex={mode === "draw" ? selectedPointIndex : null}
              showGreenwayGuide={greenwaySelected}
              startLabel={values.start}
              terrain={values.terrain}
            />
            </div>
            <p className="route-builder__map-note">
              {mode === "draw" ? t("routeBuilder.mapNoteSketch") : t("routeBuilder.mapNoteRecord")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildRouteSaveMessage({ isEditing, ride, matchSource, t }) {
  const providerLabel = formatRoutingProviderLabel(matchSource);

  if (isEditing) {
    return providerLabel
      ? t("rideScreen.saveUpdatedProvider", { provider: providerLabel })
      : t("rideScreen.saveUpdated");
  }

  if (ride) {
    return providerLabel
      ? t("rideScreen.saveSuccessRideProvider", { provider: providerLabel })
      : t("rideScreen.saveSuccessRide");
  }

  return providerLabel
    ? t("rideScreen.saveSuccessProvider", { provider: providerLabel })
    : t("rideScreen.saveSuccess");
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
