import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const PACE_OPTIONS = ["easy", "steady", "fast"];
const TERRAIN_OPTIONS = ["city streets", "greenway", "gravel", "mixed surface"];

const app = express();
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
    // The client `accept` attribute is only a hint; enforce the type here.
    callback(null, /^image\/(png|jpe?g|gif|webp|avif)$/.test(file.mimetype));
  }
});

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(sessionSecret));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDirectory));

// Throttle credential endpoints to blunt brute-force and signup spam.
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

    response.json({
      club: store.club,
      members: sortByCreatedAt(store.members).map(toPublicMember),
      routes: sortByCreatedAt(store.routes),
      photos: sortByCreatedAt(store.photos),
      posts: sortByCreatedAt(store.posts),
      stats: buildStats(store)
    });
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
      bio,
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
    const route = {
      id: createId("route"),
      title: requireText(request.body.title, "Route name", { max: 120 }),
      createdBy: request.member.name,
      createdById: request.member.id,
      distanceMiles: Number(
        requirePositiveNumber(request.body.distanceMiles, "Distance").toFixed(1)
      ),
      start: requireText(request.body.start, "Start point", { max: 140 }),
      terrain: oneOf(request.body.terrain, "Terrain", TERRAIN_OPTIONS, "city streets"),
      notes: optionalText(request.body.notes, "Ride notes", {
        max: 1000,
        fallback: "Local route note coming soon."
      }),
      createdAt: new Date().toISOString()
    };

    const nextStore = await updateStore((store) => {
      store.routes.unshift(route);
      return store;
    });

    response.status(201).json({ route, stats: buildStats(nextStore) });
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
      // The request never persisted, so discard the orphaned upload.
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

// Central error handler: turns known failures into clean JSON responses.
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
  console.log(`North Star Ridebook server running on port ${port}`);
});

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
    milesShared: Number(milesShared.toFixed(1))
  };
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
