import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import {
  clearSessionCookie,
  hashPassword,
  readSession,
  sessionSecret,
  setSessionCookie,
  toPrivateMember,
  toPublicMember,
  verifyPassword
} from "./lib/auth.js";
import { pathDistanceMiles, requireCoordinate, requirePath } from "./lib/geo.js";
import { fetchMatchedPath, fetchRoutedPath } from "./lib/routing/index.js";
import { createId, readStore, updateStore } from "./lib/store.js";
import {
  ValidationError,
  oneOf,
  optionalText,
  requireEmail,
  requirePassword,
  requirePositiveNumber,
  requireText
} from "./lib/validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDirectory = path.resolve(__dirname, "uploads");
const clientDistDirectory = path.resolve(__dirname, "..", "client", "dist");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROUTE_POINTS = 8000;
const MAX_ROUTING_POINTS = 50;
const MAX_MATCHING_POINTS = 200;
const PACE_OPTIONS = ["easy", "steady", "fast"];
const TERRAIN_OPTIONS = ["city streets", "greenway", "gravel", "mixed surface"];
const ROUTE_CREATION_MODES = ["draw", "record"];
const ROUTING_PROFILE_OPTIONS = ["bike", "car", "foot", "driving"];

const app = express();
app.set("trust proxy", 1);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadsDirectory),
    filename: (_request, file, callback) => {
      const safeBaseName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
      callback(null, `${Date.now()}-${safeBaseName}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_request, file, callback) => {
    callback(null, /^image\/(png|jpe?g|gif|webp|avif)$/.test(file.mimetype));
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(sessionSecret));
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(uploadsDirectory));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});

function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

const requireAuth = asyncHandler(async (request, response, next) => {
  const memberId = readSession(request);

  if (!memberId) {
    response.status(401).json({ error: "Please log in to continue." });
    return;
  }

  const store = await readStore();
  const member = store.members.find((item) => item.id === memberId);

  if (!member) {
    clearSessionCookie(response);
    response.status(401).json({ error: "Your session has expired. Please log in again." });
    return;
  }

  request.member = member;
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get(
  "/api/bootstrap",
  asyncHandler(async (_request, response) => {
    const store = await readStore();

    response.json(buildBootstrapPayload(store));
  })
);

app.post(
  "/api/auth/signup",
  authLimiter,
  asyncHandler(async (request, response) => {
    const name = requireText(request.body.name, "Rider name", { max: 80 });
    const email = requireEmail(request.body.email);
    const password = requirePassword(request.body.password);
    const neighborhood = requireText(request.body.neighborhood, "Neighborhood", { max: 80 });
    const pace = oneOf(request.body.pace, "Ride pace", PACE_OPTIONS, "steady");
    const bio = optionalText(request.body.bio, "Bio", {
      max: 600,
      fallback: "Ready to meet the crew and trade route notes."
    });

    const member = {
      id: createId("member"),
      name,
      email,
      passwordHash: await hashPassword(password),
      neighborhood,
      pace,
      bike: "",
      avatarUrl: "",
      bio,
      favoriteRouteIds: [],
      groupIds: [],
      createdAt: new Date().toISOString()
    };

    const nextStore = await updateStore((store) => {
      if (store.members.some((item) => item.email === email)) {
        throw new ValidationError("An account with that email already exists.");
      }

      store.members.unshift(member);
      return store;
    });

    setSessionCookie(response, member.id);
    response.status(201).json({
      member: toPrivateMember(member),
      stats: buildStats(nextStore)
    });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  asyncHandler(async (request, response) => {
    const email = requireEmail(request.body.email);
    const password = request.body.password;
    const store = await readStore();
    const member = store.members.find((item) => item.email === email);
    const passwordOk = await verifyPassword(password, member?.passwordHash);

    if (!member || !passwordOk) {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    setSessionCookie(response, member.id);
    response.json({ member: toPrivateMember(member) });
  })
);

app.post("/api/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.json({ ok: true });
});

app.get(
  "/api/auth/me",
  asyncHandler(async (request, response) => {
    const memberId = readSession(request);

    if (!memberId) {
      response.json({ member: null });
      return;
    }

    const store = await readStore();
    const member = store.members.find((item) => item.id === memberId);
    response.json({ member: member ? toPrivateMember(member) : null });
  })
);

app.post(
  "/api/routes",
  requireAuth,
  asyncHandler(async (request, response) => {
    const pathPoints = requirePath(request.body.path, "Route path", {
      minPoints: 2,
      maxPoints: MAX_ROUTE_POINTS
    });
    const startCoords = requireCoordinate(request.body.startCoords ?? pathPoints[0], "Start point");
    const creationMode = oneOf(
      request.body.mode,
      "Route creation mode",
      ROUTE_CREATION_MODES,
      "draw"
    );
    const logRide = request.body.logRide === true;

    const route = {
      id: createId("route"),
      title: requireText(request.body.title, "Route name", { max: 120 }),
      createdBy: request.member.name,
      createdById: request.member.id,
      distanceMiles: pathDistanceMiles(pathPoints),
      start: requireText(request.body.start, "Start point label", { max: 140 }),
      startCoords,
      terrain: oneOf(request.body.terrain, "Terrain", TERRAIN_OPTIONS, "city streets"),
      notes: optionalText(request.body.notes, "Ride notes", {
        max: 1000,
        fallback: "Local route note coming soon."
      }),
      path: pathPoints,
      source: creationMode,
      createdAt: new Date().toISOString()
    };

    if (!route.distanceMiles) {
      throw new ValidationError("Route path must cover some distance before you can save it.");
    }

    let ride = null;

    if (logRide) {
      const rideDurationMinutes = Math.max(
        1,
        Math.round(requirePositiveNumber(request.body.rideDurationMinutes, "Ride duration"))
      );

      ride = {
        id: createId("ride"),
        riderId: request.member.id,
        routeId: route.id,
        distanceMiles: route.distanceMiles,
        durationMinutes: rideDurationMinutes,
        ridenAt: new Date().toISOString()
      };
    }

    const nextStore = await updateStore((store) => {
      store.routes.unshift(route);

      if (!Array.isArray(store.rides)) {
        store.rides = [];
      }

      if (ride) {
        store.rides.unshift(ride);
      }

      return store;
    });

    response.status(201).json({
      route,
      ride,
      stats: buildStats(nextStore),
      metricsByRider: buildMetricsByRider(nextStore)
    });
  })
);

app.put(
  "/api/routes/:id",
  requireAuth,
  asyncHandler(async (request, response) => {
    const pathPoints = requirePath(request.body.path, "Route path", {
      minPoints: 2,
      maxPoints: MAX_ROUTE_POINTS
    });
    const startCoords = requireCoordinate(request.body.startCoords ?? pathPoints[0], "Start point");
    const creationMode = request.body.mode
      ? oneOf(request.body.mode, "Route creation mode", ROUTE_CREATION_MODES, "draw")
      : null;
    let updatedRoute;

    const nextStore = await updateStore((store) => {
      const route = store.routes.find((item) => item.id === request.params.id);

      if (!route) {
        throw new ValidationError("That route could not be found.");
      }

      if (route.createdById !== request.member.id) {
        throw new ValidationError("You can only edit routes that you created.", 403);
      }

      route.title = requireText(request.body.title, "Route name", { max: 120 });
      route.distanceMiles = pathDistanceMiles(pathPoints);
      route.start = requireText(request.body.start, "Start point label", { max: 140 });
      route.startCoords = startCoords;
      route.terrain = oneOf(request.body.terrain, "Terrain", TERRAIN_OPTIONS, "city streets");
      route.notes = optionalText(request.body.notes, "Ride notes", {
        max: 1000,
        fallback: "Local route note coming soon."
      });
      route.path = pathPoints;
      route.source = creationMode ?? route.source ?? "draw";
      route.updatedAt = new Date().toISOString();

      if (!route.distanceMiles) {
        throw new ValidationError("Route path must cover some distance before you can save it.");
      }

      updatedRoute = route;
      return store;
    });

    response.json({
      route: updatedRoute,
      stats: buildStats(nextStore),
      metricsByRider: buildMetricsByRider(nextStore)
    });
  })
);

app.delete(
  "/api/routes/:id",
  requireAuth,
  asyncHandler(async (request, response) => {
    const routeId = request.params.id;

    const nextStore = await updateStore((store) => {
      const routeIndex = store.routes.findIndex((item) => item.id === routeId);

      if (routeIndex === -1) {
        throw new ValidationError("That route could not be found.");
      }

      const route = store.routes[routeIndex];

      if (route.createdById !== request.member.id) {
        throw new ValidationError("You can only delete routes that you created.", 403);
      }

      store.routes.splice(routeIndex, 1);

      for (const member of store.members) {
        member.favoriteRouteIds = (member.favoriteRouteIds ?? []).filter((id) => id !== routeId);
      }

      for (const group of store.groups ?? []) {
        group.pinnedRouteIds = (group.pinnedRouteIds ?? []).filter((id) => id !== routeId);
      }

      return store;
    });

    response.json({
      deletedRouteId: routeId,
      stats: buildStats(nextStore),
      metricsByRider: buildMetricsByRider(nextStore)
    });
  })
);

app.post(
  "/api/rides",
  requireAuth,
  asyncHandler(async (request, response) => {
    const routeId = requireText(request.body.routeId, "Route", { max: 120 });
    const durationMinutes = Math.max(
      1,
      Math.round(requirePositiveNumber(request.body.durationMinutes, "Ride duration"))
    );
    const store = await readStore();
    const route = store.routes.find((item) => item.id === routeId);

    if (!route) {
      response.status(404).json({ error: "That route no longer exists." });
      return;
    }

    const distanceMiles =
      typeof request.body.distanceMiles === "number"
        ? Number(requirePositiveNumber(request.body.distanceMiles, "Ride distance").toFixed(1))
        : Number(route.distanceMiles || pathDistanceMiles(route.path)).toFixed(1);

    const ride = {
      id: createId("ride"),
      riderId: request.member.id,
      routeId: route.id,
      distanceMiles: Number(distanceMiles),
      durationMinutes,
      ridenAt: new Date().toISOString()
    };

    const nextStore = await updateStore((current) => {
      if (!Array.isArray(current.rides)) {
        current.rides = [];
      }

      current.rides.unshift(ride);
      return current;
    });

    response.status(201).json({
      ride,
      stats: buildStats(nextStore),
      metricsByRider: buildMetricsByRider(nextStore)
    });
  })
);

app.post(
  "/api/navigation/route",
  requireAuth,
  asyncHandler(async (request, response) => {
    const routingPoints = requirePath(request.body.points, "Routing points", {
      minPoints: 2,
      maxPoints: MAX_ROUTING_POINTS
    });
    const profile = oneOf(
      request.body.profile,
      "Routing profile",
      ROUTING_PROFILE_OPTIONS,
      "bike"
    );

    try {
      const routedPath = await fetchRoutedPath(routingPoints, profile);
      response.json(routedPath);
    } catch (error) {
      response.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Routing service is unavailable. Falling back to the saved route line."
      });
    }
  })
);

app.post(
  "/api/navigation/match",
  requireAuth,
  asyncHandler(async (request, response) => {
    const tracePoints = requirePath(request.body.points, "GPS trace", {
      minPoints: 2,
      maxPoints: MAX_MATCHING_POINTS
    });
    const profile = oneOf(
      request.body.profile,
      "Routing profile",
      ROUTING_PROFILE_OPTIONS,
      "bike"
    );

    try {
      const matchedPath = await fetchMatchedPath(tracePoints, profile);
      response.json(matchedPath);
    } catch (error) {
      response.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Map matching is unavailable. Falling back to the raw GPS line."
      });
    }
  })
);

app.post(
  "/api/photos",
  requireAuth,
  upload.single("photo"),
  asyncHandler(async (request, response) => {
    try {
      const routeTag = requireText(request.body.routeTag, "Route tag", { max: 80 });
      const caption = requireText(request.body.caption, "Caption", { max: 600 });

      if (!request.file) {
        throw new ValidationError("A valid image file is required.");
      }

      const photo = {
        id: createId("photo"),
        createdBy: request.member.name,
        createdById: request.member.id,
        routeTag,
        caption,
        imageUrl: `/uploads/${request.file.filename}`,
        createdAt: new Date().toISOString()
      };

      const nextStore = await updateStore((store) => {
        store.photos.unshift(photo);
        return store;
      });

      response.status(201).json({ photo, stats: buildStats(nextStore) });
    } catch (error) {
      await cleanupUpload(request.file?.path);
      throw error;
    }
  })
);

app.post(
  "/api/posts",
  requireAuth,
  asyncHandler(async (request, response) => {
    const post = {
      id: createId("post"),
      title: requireText(request.body.title, "Post title", { max: 160 }),
      createdBy: request.member.name,
      createdById: request.member.id,
      body: requireText(request.body.body, "Story body", { max: 6000 }),
      createdAt: new Date().toISOString()
    };

    const nextStore = await updateStore((store) => {
      store.posts.unshift(post);
      return store;
    });

    response.status(201).json({ post, stats: buildStats(nextStore) });
  })
);

app.put(
  "/api/riders/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const neighborhood = requireText(request.body.neighborhood, "Neighborhood", { max: 80 });
    const pace = oneOf(request.body.pace, "Ride pace", PACE_OPTIONS, "steady");
    const bike = optionalText(request.body.bike, "Bike", { max: 120, fallback: "" });
    const avatarUrl = optionalText(request.body.avatarUrl, "Avatar URL", {
      max: 400,
      fallback: ""
    });
    const bio = optionalText(request.body.bio, "Bio", {
      max: 600,
      fallback: "Ready to meet the crew and trade route notes."
    });

    let updatedMember;

    await updateStore((store) => {
      const member = store.members.find((item) => item.id === request.member.id);

      if (!member) {
        throw new ValidationError("Your account could not be found.");
      }

      member.neighborhood = neighborhood;
      member.pace = pace;
      member.bike = bike;
      member.avatarUrl = avatarUrl;
      member.bio = bio;
      updatedMember = member;
      return store;
    });

    response.json({ member: toPrivateMember(updatedMember) });
  })
);

app.post(
  "/api/riders/me/favorites",
  requireAuth,
  asyncHandler(async (request, response) => {
    const routeId = requireText(request.body.routeId, "Route", { max: 120 });

    let updatedMember;

    await updateStore((store) => {
      if (!store.routes.some((route) => route.id === routeId)) {
        throw new ValidationError("That route no longer exists.");
      }

      const member = store.members.find((item) => item.id === request.member.id);

      if (!member) {
        throw new ValidationError("Your account could not be found.");
      }

      const favorites = new Set(member.favoriteRouteIds ?? []);

      if (favorites.has(routeId)) {
        favorites.delete(routeId);
      } else {
        favorites.add(routeId);
      }

      member.favoriteRouteIds = [...favorites];
      updatedMember = member;
      return store;
    });

    response.json({ member: toPrivateMember(updatedMember) });
  })
);

app.get(
  "/api/groups",
  asyncHandler(async (_request, response) => {
    const store = await readStore();
    response.json({ groups: sortByCreatedAt(store.groups ?? []) });
  })
);

app.get(
  "/api/groups/:id",
  asyncHandler(async (request, response) => {
    const store = await readStore();
    const group = (store.groups ?? []).find((item) => item.id === request.params.id);

    if (!group) {
      response.status(404).json({ error: "That group could not be found." });
      return;
    }

    response.json({ group });
  })
);

app.post(
  "/api/groups",
  requireAuth,
  asyncHandler(async (request, response) => {
    const group = {
      id: createId("group"),
      name: requireText(request.body.name, "Group name", { max: 100 }),
      description: requireText(request.body.description, "Group description", { max: 900 }),
      memberIds: [request.member.id],
      pinnedRouteIds: [],
      createdBy: request.member.name,
      createdById: request.member.id,
      createdAt: new Date().toISOString()
    };

    let updatedMember;

    const nextStore = await updateStore((store) => {
      if (!Array.isArray(store.groups)) {
        store.groups = [];
      }

      store.groups.unshift(group);
      syncMemberGroupIds(store);
      updatedMember = store.members.find((item) => item.id === request.member.id);
      return store;
    });

    response.status(201).json({
      group,
      member: toPrivateMember(updatedMember),
      stats: buildStats(nextStore)
    });
  })
);

app.post(
  "/api/groups/:id/join",
  requireAuth,
  asyncHandler(async (request, response) => {
    let updatedGroup;
    let updatedMember;

    const nextStore = await updateStore((store) => {
      const group = (store.groups ?? []).find((item) => item.id === request.params.id);

      if (!group) {
        throw new ValidationError("That group could not be found.");
      }

      const memberIds = new Set(group.memberIds ?? []);
      memberIds.add(request.member.id);
      group.memberIds = [...memberIds];
      updatedGroup = group;

      syncMemberGroupIds(store);
      updatedMember = store.members.find((item) => item.id === request.member.id);
      return store;
    });

    response.json({
      group: updatedGroup,
      member: toPrivateMember(updatedMember),
      stats: buildStats(nextStore)
    });
  })
);

app.post(
  "/api/groups/:id/routes",
  requireAuth,
  asyncHandler(async (request, response) => {
    const routeId = requireText(request.body.routeId, "Route", { max: 120 });
    let updatedGroup;

    await updateStore((store) => {
      const group = (store.groups ?? []).find((item) => item.id === request.params.id);

      if (!group) {
        throw new ValidationError("That group could not be found.");
      }

      if (!(group.memberIds ?? []).includes(request.member.id)) {
        throw new ValidationError("Join the group before pinning routes to it.");
      }

      if (!store.routes.some((route) => route.id === routeId)) {
        throw new ValidationError("That route no longer exists.");
      }

      const pinnedRouteIds = new Set(group.pinnedRouteIds ?? []);
      pinnedRouteIds.add(routeId);
      group.pinnedRouteIds = [...pinnedRouteIds];
      updatedGroup = group;
      return store;
    });

    response.json({ group: updatedGroup });
  })
);

if (fs.existsSync(clientDistDirectory)) {
  app.use(express.static(clientDistDirectory));

  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/uploads")) {
      next();
      return;
    }

    response.sendFile(path.join(clientDistDirectory, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5 MB or smaller."
        : "Image upload failed.";
    response.status(400).json({ error: message });
    return;
  }

  if (error instanceof ValidationError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Something went wrong on our end." });
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Xxica server running on port ${port}`);
});

function buildBootstrapPayload(store) {
  return {
    club: store.club,
    members: sortByCreatedAt(store.members).map(toPublicMember),
    routes: sortByCreatedAt(store.routes),
    photos: sortByCreatedAt(store.photos),
    posts: sortByCreatedAt(store.posts),
    groups: sortByCreatedAt(store.groups ?? []),
    stats: buildStats(store),
    metricsByRider: buildMetricsByRider(store)
  };
}

function sortByCreatedAt(items) {
  return [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function buildStats(store) {
  const milesShared = store.routes.reduce((total, route) => total + Number(route.distanceMiles || 0), 0);

  return {
    memberCount: store.members.length,
    routeCount: store.routes.length,
    photoCount: store.photos.length,
    postCount: store.posts.length,
    rideCount: (store.rides ?? []).length,
    groupCount: (store.groups ?? []).length,
    milesShared: Number(milesShared.toFixed(1))
  };
}

function buildMetricsByRider(store) {
  const ridesByRider = new Map();

  for (const ride of store.rides ?? []) {
    const bucket = ridesByRider.get(ride.riderId) ?? [];
    bucket.push(ride);
    ridesByRider.set(ride.riderId, bucket);
  }

  const metricsByRider = {};

  for (const member of store.members) {
    metricsByRider[member.id] = buildRiderMetrics(ridesByRider.get(member.id) ?? []);
  }

  return metricsByRider;
}

function buildRiderMetrics(rides) {
  const milesBiked = rides.reduce((total, ride) => total + Number(ride.distanceMiles || 0), 0);
  const longestRide = rides.reduce(
    (longest, ride) => Math.max(longest, Number(ride.distanceMiles || 0)),
    0
  );

  return {
    ridesTaken: rides.length,
    routesTaken: new Set(rides.map((ride) => ride.routeId)).size,
    milesBiked: Number(milesBiked.toFixed(1)),
    longestRideMiles: Number(longestRide.toFixed(1))
  };
}


function syncMemberGroupIds(store) {
  const membershipsByMember = new Map();

  for (const group of store.groups ?? []) {
    for (const memberId of group.memberIds ?? []) {
      const memberships = membershipsByMember.get(memberId) ?? [];
      memberships.push(group.id);
      membershipsByMember.set(memberId, memberships);
    }
  }

  for (const member of store.members) {
    member.groupIds = membershipsByMember.get(member.id) ?? [];
  }
}

async function cleanupUpload(filePath) {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch {
    // The request already failed validation; a cleanup miss should not fail the API.
  }
}
