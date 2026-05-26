import test from "node:test";
import assert from "node:assert/strict";
import { createSeedData } from "../../src/seedData.js";
import {
  calculateEvent,
  getParticipantResult,
  releaseCalculationRun,
  submitSurvey,
  viewContact,
} from "../../src/appLogic.js";

test("participant results and contact access expire after the event day", () => {
  const db = createSeedData({
    slug: "demo",
    eventDate: "2026-05-23",
    maleCapacity: 1,
    femaleCapacity: 1,
  });

  submitSurvey(db, "demo", {
    name: "Male",
    phone: "010-1111-1111",
    nickname: "m",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
  });
  submitSurvey(db, "demo", {
    name: "Female",
    phone: "010-2222-2222",
    nickname: "f",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
  });

  const run = calculateEvent(db, "demo", { now: "2026-05-23T12:00:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-23T12:10:00.000Z" });

  const sameDayResult = getParticipantResult(db, "demo", {
    name: "Male",
    phone: "1111",
  }, { now: "2026-05-23T14:59:00.000Z" });

  assert.equal(sameDayResult.status, "released");
  assert.equal(sameDayResult.matches.length, 1);

  const nextDayResult = getParticipantResult(db, "demo", {
    name: "Male",
    phone: "1111",
  }, { now: "2026-05-23T15:00:00.000Z" });

  assert.equal(nextDayResult.status, "expired");

  assert.throws(() => viewContact(db, "demo", {
    name: "Male",
    phone: "1111",
    matchResultId: sameDayResult.matches[0].id,
    targetParticipantId: sameDayResult.matches[0].target.participantId,
  }, { now: "2026-05-23T15:00:00.000Z" }), /result_expired/);
});

test("participant results expire at Korea midnight for the event day", () => {
  const db = createSeedData({
    slug: "demo",
    eventDate: "2026-05-23",
    maleCapacity: 1,
    femaleCapacity: 1,
  });

  submitSurvey(db, "demo", {
    name: "Male",
    phone: "010-1111-1111",
    nickname: "m",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
  });
  submitSurvey(db, "demo", {
    name: "Female",
    phone: "010-2222-2222",
    nickname: "f",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
  });

  const run = calculateEvent(db, "demo", { now: "2026-05-23T12:00:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-23T12:10:00.000Z" });

  const beforeKoreaMidnight = getParticipantResult(db, "demo", {
    name: "Male",
    phone: "1111",
  }, { now: "2026-05-23T14:59:00.000Z" });

  assert.equal(beforeKoreaMidnight.status, "released");

  const afterKoreaMidnight = getParticipantResult(db, "demo", {
    name: "Male",
    phone: "1111",
  }, { now: "2026-05-23T15:00:00.000Z" });

  assert.equal(afterKoreaMidnight.status, "expired");
});
