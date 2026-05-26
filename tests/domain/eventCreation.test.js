import test from "node:test";
import assert from "node:assert/strict";
import { createSeedData } from "../../src/seedData.js";
import {
  createEvent,
  getAdminDashboard,
} from "../../src/appLogic.js";

test("createEvent creates a new event with a unique slug and fresh seat slots", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 5, femaleCapacity: 5 });

  const first = createEvent(db, {
    eventDate: "2026-05-23",
    title: "부부 테스트 모임",
    maleCapacity: 5,
    femaleCapacity: 4,
  }, { now: "2026-05-23T09:00:00.000Z" });
  const second = createEvent(db, {
    eventDate: "2026-05-23",
    maleCapacity: 3,
    femaleCapacity: 3,
  }, { now: "2026-05-23T10:00:00.000Z" });

  assert.equal(first.publicSlug, "buboo-260523-1");
  assert.equal(second.publicSlug, "buboo-260523-2");
  assert.equal(db.events.length, 3);
  assert.equal(db.eventParticipants.filter((participant) => participant.eventId === first.id).length, 9);
  assert.equal(db.eventParticipants.filter((participant) => participant.eventId === second.id).length, 6);
  assert.equal(getAdminDashboard(db, first.publicSlug).participants.length, 9);
  assert.equal(getAdminDashboard(db, "demo").participants.length, 10);
});

test("createEvent defaults event date to Korea today", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 5, femaleCapacity: 5 });

  const event = createEvent(db, {
    maleCapacity: 5,
    femaleCapacity: 5,
  }, { now: "2026-05-23T16:00:00.000Z" });

  assert.equal(event.eventDate, "2026-05-24");
  assert.equal(event.publicSlug, "buboo-260524-1");
});
