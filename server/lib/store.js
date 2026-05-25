import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_STORE_FILE = path.resolve(__dirname, "..", "data", "store.json");
const STORE_FILE = process.env.STORE_FILE
  ? path.resolve(process.env.STORE_FILE)
  : SEED_STORE_FILE;

let writeQueue = Promise.resolve();
let initPromise = null;

async function ensureStoreFile() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await fs.access(STORE_FILE);
      return;
    } catch {
      // First boot against an empty disk: seed from the repo default if we can,
      // otherwise start from an empty store so the server still comes up.
      await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
      try {
        const seed = await fs.readFile(SEED_STORE_FILE, "utf8");
        await fs.writeFile(STORE_FILE, seed, "utf8");
      } catch {
        const empty = { members: [], routes: [], rides: [], groups: [], journal: [] };
        await fs.writeFile(STORE_FILE, `${JSON.stringify(empty, null, 2)}\n`, "utf8");
      }
    }
  })().catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

export async function readStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  return JSON.parse(raw);
}

export function updateStore(mutator) {
  const result = writeQueue.then(async () => {
    const current = await readStore();
    const next = await mutator(structuredClone(current));
    await fs.writeFile(STORE_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  });

  // Keep the serialized queue alive even when a mutation rejects, otherwise a
  // single failed write (e.g. a validation error) would stall every later one.
  writeQueue = result.catch(() => {});

  return result;
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
