# Hybrid Mapbox and GraphHopper Routing Design

## Summary

North Star Ridebook should use Mapbox for the visual map experience and GraphHopper for bike-first routing. The goal is to keep Mapbox's polished map styling while using a routing provider that gives the app stronger control over bike-friendly route selection.

The implementation should preserve the existing app behavior: users can draw routes, record GPS routes, open ride guidance, receive route-to-start guidance, and save normalized route geometry. The change is behind the existing server routing proxy so provider keys and routing policy remain centralized.

## Goals

- Render route builder and ride screen maps with Mapbox visual styling.
- Use GraphHopper as the primary provider for bicycle routing and GPS map matching.
- Prefer bike-friendly roads, trails, boulevards, and Greenway-style corridors where provider data supports them.
- Prevent bike routing from silently falling back to car-like or freeway-heavy results.
- Keep the current client response contract: `path`, `distanceMiles`, `durationMinutes`, `steps`, `source`, and `profile`.
- Keep provider API keys out of the browser except for the public Mapbox rendering token.

## Non-Goals

- Build or maintain a local Minneapolis bike network graph.
- Guarantee that every returned path is physically separated from traffic. The providers depend on OpenStreetMap and their own routing data.
- Replace the route builder workflow or navigation UI in this phase.
- Add turn-by-turn voice improvements beyond preserving the current step contract.

## Architecture

The Express server remains the only routing proxy. The client continues to call:

- `POST /api/navigation/route`
- `POST /api/navigation/match`

The server chooses the active provider based on environment configuration. For `bike` requests, the server should prefer GraphHopper, optionally fall back to Valhalla bicycle routing, and avoid OSRM unless an explicit escape-hatch env var enables it.

The client map layer should move from OpenStreetMap tiles to Mapbox-rendered tiles while keeping the current React Leaflet component structure. This keeps route drawing, markers, overlays, and navigation state stable. A later migration to Mapbox GL can be considered only if the app needs Mapbox-specific vector interactions that Leaflet cannot support cleanly.

## Provider Configuration

Add these environment variables:

- `ROUTING_PROVIDER=graphhopper`
- `GRAPHHOPPER_API_KEY`
- `GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1`
- `VITE_MAPBOX_TOKEN`
- `VITE_MAPBOX_STYLE_URL`
- `ALLOW_OSRM_BIKE_FALLBACK=false`

Existing Valhalla and OSRM env vars can remain. Valhalla stays useful as a bike fallback. OSRM should remain available for non-bike profiles and explicit debugging, but should not be part of normal bike routing.

## GraphHopper Routing Policy

For GraphHopper route requests:

- Use a bicycle profile such as `bike`.
- Request points in `[lng, lat]` order if required by the API.
- Request full path geometry and turn instructions.
- Normalize returned coordinates to the app's existing `[lat, lng]` format.
- Convert meters to miles and seconds to minutes.
- Label responses with `source: "graphhopper"`.

For custom routing rules, the request should penalize freeway-class and high-speed road classes when the provider supports those fields. The model should prefer bike-accessible roads and paths without making valid routes impossible in areas where a short connector road is unavoidable.

The policy should be conservative: a failed bike-friendly route is preferable to returning a freeway-heavy route. If provider metadata exposes road class details, the server should reject returned bike routes containing motorway or trunk-class segments unless those segments are explicitly bike-accessible paths in the provider data.

## Mapbox Rendering

The client should use Mapbox for the visible map style on:

- Route builder
- Ride screen
- Route preview components

The browser may receive only the public Mapbox token and style URL. GraphHopper keys must remain server-only.

The visual migration should preserve:

- Existing path drawing
- Start and finish markers
- Rider marker
- Midtown Greenway guide overlay
- Live trail overlay
- Navigation and route-to-start overlays
- Current responsive layout

## Fallback Behavior

For `profile: "bike"`:

1. Try GraphHopper.
2. If GraphHopper fails or returns unusable geometry, try Valhalla bicycle routing.
3. If Valhalla fails, return an error to the client.
4. The client uses the saved or drawn route line as its local fallback.

For non-bike profiles:

1. Use the configured provider when supported.
2. Allow OSRM fallback for compatible profiles.

The server must not silently downgrade a bike route to `driving`, `car`, or generic road routing.

## Data Flow

Route guidance:

1. Client samples saved route points with `getRoutingWaypoints`.
2. Client posts to `/api/navigation/route` with `profile: "bike"`.
3. Server requests GraphHopper route geometry.
4. Server normalizes geometry and steps.
5. Client renders the normalized bike route on the Mapbox-styled map.

Recorded GPS matching:

1. Client samples recorded GPS points.
2. Client posts to `/api/navigation/match` with `profile: "bike"`.
3. Server requests GraphHopper map matching if available.
4. Server normalizes the matched path.
5. If all provider matching fails, client saves the raw GPS line.

Route-to-start guidance:

1. Client sends current position and saved start point.
2. Server calculates a bike route from current location to the start.
3. Client renders this as the `to-start` leg before switching to the saved route.

## Error Handling

- Missing `GRAPHHOPPER_API_KEY` should produce a clear server-side provider error.
- GraphHopper HTTP errors should include sanitized provider context in logs, not raw secrets.
- Client-visible messages should remain simple: routing unavailable, falling back to saved line.
- If Mapbox token is missing, the map should show a usable error state rather than a blank panel.

## Testing

Add focused verification for:

- GraphHopper route URL and request body construction.
- Bike provider order: GraphHopper, Valhalla, then no OSRM unless explicitly enabled.
- No bike route downgrade to driving or OSRM by default.
- Normalization of GraphHopper geometry and steps into the existing response shape.
- Client behavior when provider routing fails and local saved-line fallback is used.

Run the existing build after implementation. If practical, verify the route builder and ride screen in a browser with the required tokens configured.

## References

- Mapbox Directions API: https://docs.mapbox.com/api/navigation/directions/
- Mapbox pricing: https://www.mapbox.com/pricing
- GraphHopper routing profiles: https://docs.graphhopper.com/openapi/map-data-and-routing-profiles/openstreetmap/standard-routing-profiles
- GraphHopper custom models: https://docs.graphhopper.com/openapi/custom-model/customizing-priority
- GraphHopper pricing: https://www.graphhopper.com/pricing/
