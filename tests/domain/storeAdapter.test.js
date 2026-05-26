import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { activeStoreName, ensureDataFile } from "../../src/store.js";

test("store uses JSON mode by default", () => {
  const previousStore = process.env.BUBOO_STORE;
  delete process.env.BUBOO_STORE;

  try {
    assert.equal(activeStoreName(), "json");
  } finally {
    if (previousStore === undefined) {
      delete process.env.BUBOO_STORE;
    } else {
      process.env.BUBOO_STORE = previousStore;
    }
  }
});

test("store uses Postgres mode only when explicitly requested", () => {
  const previousStore = process.env.BUBOO_STORE;
  process.env.BUBOO_STORE = "postgres";

  try {
    assert.equal(activeStoreName(), "postgres");
  } finally {
    if (previousStore === undefined) {
      delete process.env.BUBOO_STORE;
    } else {
      process.env.BUBOO_STORE = previousStore;
    }
  }
});

test("Postgres mode startup does not create a local JSON data file", async () => {
  const previousStore = process.env.BUBOO_STORE;
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const dataPath = path.join(process.cwd(), "_codex_runtime", `postgres-mode-${Date.now()}.json`);
  process.env.BUBOO_STORE = "postgres";
  process.env.BUBOO_DATA_PATH = dataPath;

  try {
    const result = await ensureDataFile();

    assert.equal(result, null);
    assert.equal(existsSync(dataPath), false);
  } finally {
    await rm(dataPath, { force: true });
    if (previousStore === undefined) {
      delete process.env.BUBOO_STORE;
    } else {
      process.env.BUBOO_STORE = previousStore;
    }
    if (previousDataPath === undefined) {
      delete process.env.BUBOO_DATA_PATH;
    } else {
      process.env.BUBOO_DATA_PATH = previousDataPath;
    }
  }
});
