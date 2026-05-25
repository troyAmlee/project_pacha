import { getRoutingProviderOrder, readRoutingConfig } from "./config.js";
import { fetchGraphHopperMatch, fetchGraphHopperRoute } from "./graphhopper.js";
import { fetchOsrmMatch, fetchOsrmRoute } from "./osrm.js";
import { fetchValhallaRoute, fetchValhallaTraceRoute } from "./valhalla.js";

export async function fetchRoutedPath(points, profile, overrides = {}) {
  const config = { ...readRoutingConfig(), ...overrides };
  const providerOrder = getRoutingProviderOrder({
    requestedProfile: profile,
    routingProvider: config.routingProvider,
    allowOsrmBikeFallback: config.allowOsrmBikeFallback
  });

  return runProviderOrder({
    actionLabel: "Routing",
    points,
    profile,
    providerOrder,
    providers: config.providers ?? buildRouteProviders(config)
  });
}

export async function fetchMatchedPath(points, profile, overrides = {}) {
  const config = { ...readRoutingConfig(), ...overrides };
  const providerOrder = getRoutingProviderOrder({
    requestedProfile: profile,
    routingProvider: config.routingProvider,
    allowOsrmBikeFallback: config.allowOsrmBikeFallback
  });

  return runProviderOrder({
    actionLabel: "Map matching",
    points,
    profile,
    providerOrder,
    providers: config.providers ?? buildMatchProviders(config)
  });
}

function buildRouteProviders(config) {
  return {
    graphhopper: (points, profile) =>
      fetchGraphHopperRoute(points, profile, {
        apiKey: config.graphHopperApiKey,
        baseUrl: config.graphHopperBaseUrl,
        timeoutMs: config.routingTimeoutMs,
        useCustomModel: config.graphHopperUseCustomModel
      }),
    valhalla: (points, profile) =>
      fetchValhallaRoute(points, profile, {
        baseUrl: config.valhallaBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    osrm: (points, profile) =>
      fetchOsrmRoute(points, profile, {
        baseUrl: config.osrmBaseUrl,
        osrmBikeProfile: config.osrmBikeProfile,
        timeoutMs: config.routingTimeoutMs
      })
  };
}

function buildMatchProviders(config) {
  return {
    graphhopper: (points, profile) =>
      fetchGraphHopperMatch(points, profile, {
        apiKey: config.graphHopperApiKey,
        baseUrl: config.graphHopperBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    valhalla: (points, profile) =>
      fetchValhallaTraceRoute(points, profile, {
        baseUrl: config.valhallaBaseUrl,
        timeoutMs: config.routingTimeoutMs
      }),
    osrm: (points, profile) =>
      fetchOsrmMatch(points, profile, {
        baseUrl: config.osrmBaseUrl,
        osrmBikeProfile: config.osrmBikeProfile,
        timeoutMs: config.routingTimeoutMs
      })
  };
}

async function runProviderOrder({ actionLabel, points, profile, providerOrder, providers }) {
  const providerErrors = [];

  for (const providerName of providerOrder) {
    const provider = providers[providerName];

    if (!provider) {
      continue;
    }

    try {
      return await provider(points, profile);
    } catch (error) {
      providerErrors.push(
        `${providerName}: ${error instanceof Error ? error.message : "request failed"}`
      );
    }
  }

  throw new Error(`${actionLabel} providers are unavailable (${providerErrors.join("; ")}).`);
}
