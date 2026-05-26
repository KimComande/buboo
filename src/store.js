import { promises as fs } from "node:fs";
import path from "node:path";
import { createSeedData } from "./seedData.js";
import * as postgresStore from "./db/postgresStore.js";

let mutationQueue = Promise.resolve();

export function activeStoreName() {
  return process.env.BUBOO_STORE === "postgres" ? "postgres" : "json";
}

export function getDataPath() {
  return process.env.BUBOO_DATA_PATH ?? path.join(process.cwd(), "data", "db.json");
}

export async function ensureDataFile() {
  if (activeStoreName() === "postgres") return null;
  return ensureDataFileAt(getDataPath());
}

async function ensureDataFileAt(dataPath) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  try {
    await fs.access(dataPath);
  } catch {
    await writeDbAt(dataPath, createSeedData());
  }
  return dataPath;
}

export async function readDb() {
  if (activeStoreName() === "postgres") return postgresStore.readDb();
  const dataPath = await ensureDataFile();
  return readDbAt(dataPath);
}

export async function writeDb(db) {
  if (activeStoreName() === "postgres") {
    await postgresStore.writeDb(db);
    return;
  }
  await writeDbAt(getDataPath(), db);
}

async function readDbAt(dataPath) {
  const raw = await fs.readFile(dataPath, "utf8");
  return JSON.parse(raw);
}

async function writeDbAt(dataPath, db) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  const tmpPath = `${dataPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  try {
    await renameWithRetry(tmpPath, dataPath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}

async function renameWithRetry(sourcePath, destinationPath) {
  const retryableCodes = new Set(["EBUSY", "EPERM"]);
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!retryableCodes.has(error.code) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}

export function mutateDb(mutator) {
  if (activeStoreName() === "postgres") return postgresStore.mutateDb(mutator);

  const dataPath = getDataPath();
  const nextMutation = mutationQueue.then(async () => {
    await ensureDataFileAt(dataPath);
    const db = await readDbAt(dataPath);
    const result = await mutator(db);
    await writeDbAt(dataPath, db);
    return result;
  });

  mutationQueue = nextMutation.catch(() => {});
  return nextMutation;
}

export async function keepAlive() {
  if (activeStoreName() !== "postgres") return { ok: true, skipped: true, store: "json" };
  return postgresStore.keepAlive();
}
