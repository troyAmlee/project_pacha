import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("navigation routing is available without a login session", async () => {
  const fakeProvider = await startFakeGraphHopper();
  const appPort = await getAvailablePort();
  const app = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ALLOW_OSRM_BIKE_FALLBACK: "false",
      GRAPHHOPPER_API_KEY: "test-key",
      GRAPHHOPPER_BASE_URL: fakeProvider.baseUrl,
      PORT: String(appPort),
      ROUTING_PROVIDER: "graphhopper"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForHealth(appPort);

    const response = await fetch(`http://127.0.0.1:${appPort}/api/navigation/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: [
          [44.95, -93.3],
          [44.96, -93.28]
        ],
        profile: "bike"
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.source, "graphhopper");
    assert.deepEqual(payload.path, [
      [44.95, -93.3],
      [44.955, -93.29],
      [44.96, -93.28]
    ]);
  } finally {
    app.kill();
    await fakeProvider.close();
  }
});

function startFakeGraphHopper() {
  const server = http.createServer((request, response) => {
    if (request.method !== "POST" || request.url?.startsWith("/api/1/route") !== true) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        paths: [
          {
            details: {
              road_class: [[0, 2, "CYCLEWAY"]]
            },
            distance: 1800,
            instructions: [],
            points: {
              coordinates: [
                [-93.3, 44.95],
                [-93.29, 44.955],
                [-93.28, 44.96]
              ]
            },
            time: 420000
          }
        ]
      })
    );
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done))
      });
    });
  });
}

function getAvailablePort() {
  const server = http.createServer();

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the child process starts listening.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Server did not become healthy in time.");
}
