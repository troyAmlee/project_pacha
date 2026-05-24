# North Star Ridebook

North Star Ridebook is a React + Node.js MVP for a Minneapolis bike club. Riders can join the club, publish routes, upload ride photos, and contribute to a shared community journal.

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

## Routing Provider

The ride screen uses a server-side routing proxy so the client can draw bike-aware road geometry instead of only connecting saved GPS points. Valhalla is the default provider because it supports bicycle costing, turn-by-turn geometry, and map matching for recorded traces. OSRM remains available as a fallback or alternate provider.

```bash
ROUTING_PROVIDER=valhalla
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_BIKE_PROFILE=bike
ROUTING_TIMEOUT_MS=7000
```

For production use, prefer a self-hosted Valhalla/OSRM instance or a managed routing provider with clear usage limits. The public defaults are suitable for local prototyping.

## Map Rendering

The client renders raster tiles through React Leaflet. Mapbox is the preferred visual provider; OpenStreetMap and CARTO Voyager tiles are used as a fallback if Mapbox is not configured. To enable Mapbox, set both client env vars before `npm run dev` or `npm run build`:

```bash
VITE_MAPBOX_TOKEN=pk.your_public_mapbox_token
VITE_MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v12
```

Only the public Mapbox token should reach the browser. Server-side routing keys must stay in the server environment.

## MVP Features

- Join the club with a rider profile
- Share route details with mileage, start point, terrain, and notes
- Upload ride photos to the local backend
- Publish community blog posts in a shared journal
- Seeded Minneapolis-flavored demo content so the app feels alive on first launch
