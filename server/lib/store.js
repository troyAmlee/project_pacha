import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "..", "data", "store.json");

let writeQueue = Promise.resolve();

export async function readStore() {
  const raw = await fs.readFile(storePath, "utf8");
  return JSON.parse(raw);
}

export function updateStore(mutator) {
  const result = writeQueue.then(async () => {
    const current = await readStore();
    const next = await mutator(structuredClone(current));
    await fs.writeFile(storePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
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
