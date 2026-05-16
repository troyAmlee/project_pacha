---
name: Ridebook feature roadmap
description: The agreed 4-phase plan for adding GPS, groups, profiles and metrics to North Star Ridebook
type: project
---

North Star Ridebook (React + Express bike-club app) is being extended in 4 phases.

**Decisions made:** Leaflet + OpenStreetMap for maps; route paths created by recording-while-riding AND drawing-on-a-map (no GPX upload); real accounts with email/password login.

**Phases:**
- Phase 1 — auth (bcrypt + signed-cookie sessions), routing, App.jsx refactor into contexts/pages/components, server hardening. **DONE — committed by user (06240cf).**
- Phase 2 — rider profiles + ride metrics. **DONE (verified, 2026-05-16) on branch `phase-2-profiles`, not yet committed.** Added `bike`/`favoriteRouteIds` to members, `/riders/:id` page, `metricsByRider` in bootstrap, `PUT /api/riders/me`, `POST /api/riders/me/favorites`, seeded `rides`. `avatarUrl` deferred (uses initials); `groupIds` deferred to Phase 4.
- Phase 3 — routes get geometry (`path: [[lat,lng]]`, `startCoords`); GPS record/draw/follow screens; completing a route writes a `rides` record.
- Phase 4 — bike club groups (`groups` collection: memberIds, pinnedRouteIds).

**Key model note:** profile metrics are aggregations over a new `rides` collection `{id, riderId, routeId, distanceMiles, durationMinutes, ridenAt}` — no stored counters. JSON file store is fine through Phase 4; SQLite is the planned next step after.

**How to apply:** Build phase by phase, each phase a self-contained commit that keeps the app runnable.
