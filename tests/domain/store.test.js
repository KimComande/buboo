import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createDemoData } from "../../src/demoData.js";
import { createSeedData } from "../../src/seedData.js";
import {
  getParticipantResultFromStore,
  mutateDb,
  readDb,
  readPublicEvent,
  submitSurveyToStore,
  viewContactFromStore,
  writeDb,
} from "../../src/store.js";

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

test("submitSurveyToStore stores participant submissions in JSON mode", async () => {
  const previousStore = process.env.BUBOO_STORE;
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const dataPath = path.join(process.cwd(), "_codex_runtime", `submit-store-${Date.now()}.json`);
  delete process.env.BUBOO_STORE;
  process.env.BUBOO_DATA_PATH = dataPath;

  try {
    await writeDb(createSeedData({ slug: "demo", eventDate: "2026-05-23", maleCapacity: 1, femaleCapacity: 1 }));

    const submission = await submitSurveyToStore("demo", {
      gender: "male",
      seatNo: 1,
      name: "김하늘",
      phone: "010-1111-2222",
      nickname: "하늘",
      firstChoiceSeatNo: "none",
      secondChoiceSeatNo: "none",
      comment: "",
    });
    const db = await readDb();

    assert.equal(submission.memberId, "MEM-1");
    assert.equal(db.surveySubmissions.length, 1);
    assert.equal(db.eventParticipants[0].latestSubmissionId, submission.id);
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

test("participant result and contact store helpers work in JSON mode", async () => {
  const previousStore = process.env.BUBOO_STORE;
  const previousDataPath = process.env.BUBOO_DATA_PATH;
  const dataPath = path.join(process.cwd(), "_codex_runtime", `participant-result-store-${Date.now()}.json`);
  delete process.env.BUBOO_STORE;
  process.env.BUBOO_DATA_PATH = dataPath;

  try {
    await writeDb(createDemoData());

    const result = await getParticipantResultFromStore("demo", {
      name: "김도윤",
      phone: "1001",
    }, {
      now: "2026-05-09T13:00:00.000Z",
    });

    assert.equal(result.status, "released");
    assert.equal(result.matches.length > 0, true);
    assert.equal(result.matches[0].target.phone, undefined);

    const contact = await viewContactFromStore("demo", {
      name: "김도윤",
      phone: "1001",
      matchResultId: result.matches[0].id,
      targetParticipantId: result.matches[0].target.participantId,
      ipAddress: "127.0.0.1",
      userAgent: "store-test",
    }, {
      now: "2026-05-09T13:01:00.000Z",
    });
    const db = await readDb();

    assert.equal(contact.target.phone.length > 0, true);
    assert.equal(contact.target.name, undefined);
    assert.equal(contact.target.nickname, undefined);
    assert.equal(db.contactViewLogs.at(-1).matchResultId, result.matches[0].id);
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
