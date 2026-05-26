import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createSeedData } from "../../src/seedData.js";
import { mutateDb, readDb, readPublicEvent, writeDb } from "../../src/store.js";

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

test("readPublicEvent returns only participant-facing event metadata in JSON mode", async () => {
  const previousStore = process.env.BUBOO_STORE;
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const dataPath = path.join(process.cwd(), "_codex_runtime", `public-event-${Date.now()}.json`);
  delete process.env.BUBOO_STORE;
  process.env.BUBOO_DATA_PATH = dataPath;

  try {
    await writeDb(createSeedData({ slug: "demo", eventDate: "2026-05-23", maleCapacity: 4, femaleCapacity: 5 }));

    const event = await readPublicEvent("demo");

    assert.equal(event.publicSlug, "demo");
    assert.equal(event.eventDate, "2026-05-23");
    assert.equal(event.maleCapacity, 4);
    assert.equal(event.femaleCapacity, 5);
    assert.equal(Object.hasOwn(event, "members"), false);
    assert.equal(Object.hasOwn(event, "surveySubmissions"), false);
  } finally {
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
    await fs.rm(dataPath, { force: true });
    await fs.rm(`${dataPath}.tmp`, { force: true });
  }
});
