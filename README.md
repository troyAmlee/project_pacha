# Xxica

Xxica is a React + Node.js bike-collective app for Minneapolis riders. Riders join the crew, publish routes with geometry, upload ride photos, journal together, and follow saved lines from a live ride screen.

## Stack

- React + Vite frontend
- Express backend
- JSON file persistence for club data
- Local file uploads for ride photos

## Run Locally

```bash
npm install
npm run dev
```

That starts:

- frontend at `http://localhost:5173`
- backend API at `http://localhost:3001`

## Production Build

```bash
npm run build
npm start
```

The backend serves the built frontend when `client/dist` exists.

## Routing and Map Providers

Xxica splits the map into two roles:

- **Mapbox** renders the visible map tiles in the browser.
- **GraphHopper** calculates bike-friendly route geometry on the server, with a custom cost model that penalizes motorways and rewards cycleways and named bike networks.
- **Valhalla** remains a bike-safe fallback if GraphHopper is unreachable.
- **OSRM** is available for non-bike profiles and explicit debugging, but bike routes do not use OSRM by default — a failed bike route is preferable to a freeway-heavy one.

### Local dev

The server loads `.env` automatically via `dotenv`. Create `server/.env` (gitignored) with:

```bash
GRAPHHOPPER_API_KEY=your_graphhopper_key
ROUTING_PROVIDER=graphhopper
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1
ALLOW_OSRM_BIKE_FALLBACK=false
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_BIKE_PROFILE=bike
ROUTING_TIMEOUT_MS=7000
```

Mapbox client env vars must be set at Vite build time (they are inlined into the browser bundle). Set both in `client/.env`:

```bash
VITE_MAPBOX_TOKEN=pk.your_public_mapbox_token
VITE_MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v12
```

`VITE_MAPBOX_TOKEN` is public by design and should be URL-restricted in your Mapbox account. `GRAPHHOPPER_API_KEY` must stay server-only.

### Production (Render)

Set the env vars on the Render service: **Service → Environment**. `GRAPHHOPPER_API_KEY` is a server runtime var. `VITE_MAPBOX_*` need to be present at *build* time, so set them before triggering **Manual Deploy → Clear build cache & deploy**.

If GraphHopper and Valhalla both fail for a bike route, the client keeps the saved line instead of silently downgrading to a car-like route. Without `VITE_MAPBOX_TOKEN`, the map falls back to OpenStreetMap tiles so the app still renders.

### Tests

```bash
npm test
```

Covers provider order (bike → GraphHopper, Valhalla, no OSRM), GraphHopper URL/body construction, bike-route safety validator, response normalization, and the orchestrator's fallback behavior.

## Deploy to Render (xxica.com)

The repo includes a `render.yaml` Blueprint so the production service can be created without clicking through dashboard fields.

1. Push the latest `main` to GitHub.
2. In Render, click **New > Blueprint** and select this repo. Render reads `render.yaml`, creates a Free Web Service called `xxica`, and generates a strong `SESSION_SECRET` automatically.
3. Open the service > **Environment** and set:
   - `VITE_MAPBOX_TOKEN` = your `pk.` Mapbox token
   - `VITE_MAPBOX_STYLE_URL` (optional) = a style URL other than the `mapbox/streets-v12` default

   The app will deploy and run even without these (it falls back to OpenStreetMap tiles), but you want Mapbox styling.
4. Trigger **Manual Deploy > Clear build cache & deploy** so Vite re-runs with the Mapbox env vars and inlines the token.
5. In the service > **Settings > Custom Domains**, add both `xxica.com` and `www.xxica.com`. Render will show the exact DNS targets to use.
6. In Porkbun's DNS panel for `xxica.com`, add the records Render lists:
   - Apex `xxica.com`: **ALIAS** record to the `<service>.onrender.com` target Render gives you.
   - `www.xxica.com`: **CNAME** to the same target.
7. Wait a few minutes for DNS to propagate; Render auto-issues a Let's Encrypt certificate once both records resolve.

### Free-tier caveats

- The free Web Service sleeps after 15 minutes of inactivity. First visit after idle takes ~30-60 seconds to wake.
- Render Free does not support persistent disks. `server/data/store.json` and `server/uploads/` live on the container's ephemeral filesystem and are wiped on every deploy or sleep cycle. Seeded demo data in `store.json` is restored from git on each deploy; anything created at runtime (signups, uploaded photos, journal posts) is not durable until you upgrade to a paid plan with a disk or migrate to external storage.
- `navigator.geolocation` requires HTTPS in production; Render provides that automatically once the domain is verified.

## MVP Features

- Join the club with a rider profile
- Share route details with mileage, start point, terrain, and notes
- Upload ride photos to the local backend
- Publish community blog posts in a shared journal
- Seeded Minneapolis-flavored demo content so the app feels alive on first launch
