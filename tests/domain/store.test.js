import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { mutateDb, readDb, writeDb } from "../../src/store.js";

test("mutateDb serializes concurrent file mutations", async () => {
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const dataPath = path.join(process.cwd(), "data", `test-store-${Date.now()}.json`);
  process.env.BUBOO_DATA_PATH = dataPath;

  try {
    await writeDb({ counter: 0 });

    await Promise.all(Array.from({ length: 12 }, async () => mutateDb(async (db) => {
      const current = db.counter;
      await new Promise((resolve) => setTimeout(resolve, 5));
      db.counter = current + 1;
    })));

    const db = await readDb();
    assert.equal(db.counter, 12);
  } finally {
    if (previousDataPath === undefined) {
      delete process.env.BUBOO_DATA_PATH;
    } else {
      process.env.BUBOO_DATA_PATH = previousDataPath;
    }
    await fs.rm(dataPath, { force: true });
    await fs.rm(`${dataPath}.tmp`, { force: true });
  }
});

test("mutateDb keeps one data path for the whole mutation", async () => {
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const firstPath = path.join(process.cwd(), "_codex_runtime", `test-store-first-${Date.now()}.json`);
  const secondPath = path.join(process.cwd(), "_codex_runtime", `test-store-second-${Date.now()}.json`);
  process.env.BUBOO_DATA_PATH = firstPath;

  try {
    await writeDb({ counter: 0 });
    await mutateDb(async (db) => {
      db.counter = 1;
      process.env.BUBOO_DATA_PATH = secondPath;
    });

    const firstDb = JSON.parse(await fs.readFile(firstPath, "utf8"));
    assert.equal(firstDb.counter, 1);
    await assert.rejects(() => fs.access(secondPath), /ENOENT/);
  } finally {
    if (previousDataPath === undefined) {
      delete process.env.BUBOO_DATA_PATH;
    } else {
      process.env.BUBOO_DATA_PATH = previousDataPath;
    }
    await fs.rm(firstPath, { force: true });
    await fs.rm(`${firstPath}.tmp`, { force: true });
    await fs.rm(secondPath, { force: true });
    await fs.rm(`${secondPath}.tmp`, { force: true });
  }
});
