import { getRoutingWaypoints } from "./utils.js";

export async function resolveSaveablePath({ api, mode, rawPath, setStatus = () => {}, t = (key) => key }) {
  if (mode === "record") {
    setStatus(t("routeBuilder.gpsSnapping"));

    try {
      const payload = await api.matchPath(getRoutingWaypoints(rawPath, 180), "bike");

      if (payload?.path?.length >= 2) {
        return { path: payload.path, matchSource: payload.source };
      }
    } catch {
      setStatus(t("routeBuilder.gpsSnapFailed"));
    }

    return { path: rawPath, matchSource: null };
  }

  setStatus(t("routeBuilder.routeSnapping"));

  try {
    const payload = await api.routePath(getRoutingWaypoints(rawPath), "bike");

    if (payload?.path?.length >= 2) {
      return { path: payload.path, matchSource: payload.source };
    }
  } catch {
    setStatus(t("routeBuilder.routeSnapFailed"));
  }

  return { path: rawPath, matchSource: null };
}
