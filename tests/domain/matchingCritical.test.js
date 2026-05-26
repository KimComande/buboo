import test from "node:test";
import assert from "node:assert/strict";
import { createSeedData } from "../../src/seedData.js";
import {
  calculateEvent,
  getAdminDashboard,
  releaseCalculationRun,
  submitSurvey,
  updateMember,
} from "../../src/appLogic.js";
import { buildMatchResults } from "../../src/domain/matching.js";

test("reciprocal male and female rank combinations create the exact match code", () => {
  for (const maleRank of [null, 1, 2]) {
    for (const femaleRank of [null, 1, 2]) {
      const results = buildMatchResults([
        rankedSubmission("P-M1", "P-F1", maleRank),
        rankedSubmission("P-F1", "P-M1", femaleRank),
      ], {
        "P-M1": "male",
        "P-F1": "female",
      });

      if (maleRank && femaleRank) {
        assert.deepEqual(results, [{
          maleParticipantId: "P-M1",
          femaleParticipantId: "P-F1",
          maleChoiceRank: maleRank,
          femaleChoiceRank: femaleRank,
          matchCode: `M${maleRank}-F${femaleRank}`,
        }]);
      } else {
        assert.deepEqual(results, []);
      }
    }
  }
});

test("event calculation produces expected matches and gender popularity rankings", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 4, femaleCapacity: 4 });

  submitSeat(db, "male", 1, 1, 2);
  submitSeat(db, "male", 2, 1, 2);
  submitSeat(db, "male", 3, 3, 4);
  submitSeat(db, "male", 4, 4, "none");
  submitSeat(db, "female", 1, 1, 2);
  submitSeat(db, "female", 2, 2, 1);
  submitSeat(db, "female", 3, "none", "none");
  submitSeat(db, "female", 4, 4, "none");

  const run = calculateEvent(db, "demo");
  const matches = run.matches
    .map((match) => `${label(db, match.maleParticipantId)}-${label(db, match.femaleParticipantId)}:${match.matchCode}`)
    .sort();
  const stats = statsByLabel(run.voteStats);

  assert.deepEqual(matches, [
    "M1-F1:M1-F1",
    "M1-F2:M2-F2",
    "M2-F1:M1-F2",
    "M2-F2:M2-F1",
    "M4-F4:M1-F1",
  ]);
  assert.deepEqual(pickStats(stats, ["F1", "F2", "F3", "F4"]), {
    F1: { score: 4, rank: 1, first: 2, second: 0 },
    F2: { score: 2, rank: 3, first: 0, second: 2 },
    F3: { score: 2, rank: 3, first: 1, second: 0 },
    F4: { score: 3, rank: 2, first: 1, second: 1 },
  });
  assert.deepEqual(pickStats(stats, ["M1", "M2", "M3", "M4"]), {
    M1: { score: 3, rank: 1, first: 1, second: 1 },
    M2: { score: 3, rank: 1, first: 1, second: 1 },
    M3: { score: 0, rank: null, first: 0, second: 0 },
    M4: { score: 2, rank: 3, first: 1, second: 0 },
  });
});

test("one-way choices and all-none submissions do not create accidental matches", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 3, femaleCapacity: 3 });

  submitSeat(db, "male", 1, 1, "none");
  submitSeat(db, "male", 2, 2, 3);
  submitSeat(db, "male", 3, "none", "none");
  submitSeat(db, "female", 1, "none", "none");
  submitSeat(db, "female", 2, 3, "none");
  submitSeat(db, "female", 3, "none", "none");

  const run = calculateEvent(db, "demo");
  const stats = statsByLabel(run.voteStats);

  assert.deepEqual(run.matches, []);
  assert.equal(stats.F1.score, 2);
  assert.equal(stats.F2.score, 2);
  assert.equal(stats.F3.score, 1);
  assert.equal(stats.M3.score, 2);
});

test("latest submission version is the only version used for matching", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });

  const first = submitSeat(db, "male", 1, "none", "none", { comment: "old none" });
  const latest = submitSeat(db, "male", 1, 1, "none", { comment: "latest choice" });
  submitSeat(db, "female", 1, 1, "none");

  const run = calculateEvent(db, "demo");

  assert.equal(first.isLatest, false);
  assert.equal(latest.isLatest, true);
  assert.equal(run.matches.length, 1);
  assert.equal(run.matches[0].matchCode, "M1-F1");
});

test("unsubmitted seats are excluded while blacklist members remain matchable", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });

  submitSeat(db, "male", 1, 1, 2);
  const maleTwo = submitSeat(db, "male", 2, 2, "none");
  const femaleTwo = submitSeat(db, "female", 2, 2, "none");

  updateMember(db, maleTwo.memberId, { status: "blacklist" });

  const run = calculateEvent(db, "demo");
  const calculatedIds = new Set(run.voteStats.map((stat) => stat.participantId));

  assert.deepEqual(run.matches.map((match) => `${label(db, match.maleParticipantId)}-${label(db, match.femaleParticipantId)}`), [
    "M2-F2",
  ]);
  assert.equal(calculatedIds.has(maleTwo.eventParticipantId), true);
  assert.equal(calculatedIds.has(femaleTwo.eventParticipantId), true);
  assert.deepEqual(run.calculationSummary, {
    configuredMaleCount: 2,
    configuredFemaleCount: 2,
    submittedMaleCount: 2,
    submittedFemaleCount: 1,
    includedMaleCount: 2,
    includedFemaleCount: 1,
    excludedAbsentCount: 0,
    flaggedBlacklistCount: 1,
    unsubmittedCount: 1,
  });
});

test("seven-person gender pools calculate matches, ranks, and best-rank denominator", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 7, femaleCapacity: 7 });

  for (let seatNo = 1; seatNo <= 7; seatNo += 1) {
    submitSeat(db, "male", seatNo, seatNo === 4 ? 4 : "none", "none");
    submitSeat(db, "female", seatNo, seatNo === 4 ? 4 : "none", "none");
  }

  const run = calculateEvent(db, "demo", { now: "2026-05-23T10:00:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-23T10:01:00.000Z" });
  const dashboard = getAdminDashboard(db, "demo");
  const stats = statsByLabel(run.voteStats);
  const maleFourMember = db.members.find((member) => member.phone === normalizedPhoneFor("male", 4));
  const maleFourSummary = dashboard.memberSummaries.find((summary) => summary.id === maleFourMember.id);

  assert.equal(run.matches.length, 1);
  assert.equal(`${label(db, run.matches[0].maleParticipantId)}-${label(db, run.matches[0].femaleParticipantId)}`, "M4-F4");
  assert.equal(run.calculationSummary.includedMaleCount, 7);
  assert.equal(run.calculationSummary.includedFemaleCount, 7);
  assert.equal(run.voteStats.length, 14);
  assert.deepEqual(pickStats(stats, ["M4", "F4"]), {
    M4: { score: 2, rank: 1, first: 1, second: 0 },
    F4: { score: 2, rank: 1, first: 1, second: 0 },
  });
  assert.equal(maleFourSummary.bestRank, 1);
  assert.equal(maleFourSummary.bestRankDenominator, 7);
  assert.equal(maleFourSummary.averagePopularityRate, 100);
  assert.equal(maleFourSummary.averageMatchRate, 50);
  assert.equal(maleFourSummary.matchedEventRate, 50);
});

test("event calculation uses only submitted participants as the calculation pool", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 5, femaleCapacity: 5 });

  submitSeat(db, "male", 1, 1, 2);
  submitSeat(db, "male", 2, 1, "none");
  submitSeat(db, "male", 3, "none", "none");
  submitSeat(db, "male", 4, 5, "none");
  submitSeat(db, "female", 1, 1, 2);
  submitSeat(db, "female", 2, 1, "none");

  const run = calculateEvent(db, "demo");
  const calculatedLabels = run.voteStats.map((stat) => `${stat.gender === "male" ? "M" : "F"}${stat.seatNo}`).sort();
  const matchLabels = run.matches.map((match) => `${label(db, match.maleParticipantId)}-${label(db, match.femaleParticipantId)}`).sort();

  assert.deepEqual(calculatedLabels, ["F1", "F2", "M1", "M2", "M3", "M4"]);
  assert.deepEqual(matchLabels, ["M1-F1", "M1-F2", "M2-F1"]);
  assert.deepEqual(run.calculationSummary, {
    configuredMaleCount: 5,
    configuredFemaleCount: 5,
    submittedMaleCount: 4,
    submittedFemaleCount: 2,
    includedMaleCount: 4,
    includedFemaleCount: 2,
    excludedAbsentCount: 0,
    flaggedBlacklistCount: 0,
    unsubmittedCount: 4,
  });
  assert.equal(run.voteStats.some((stat) => stat.seatNo === 5), false);
  assert.equal(run.matches.some((match) => label(db, match.femaleParticipantId) === "F5"), false);
});

function rankedSubmission(participantId, targetParticipantId, rank) {
  return {
    participantId,
    firstChoiceId: rank === 1 ? targetParticipantId : "none",
    secondChoiceId: rank === 2 ? targetParticipantId : "none",
  };
}

function submitSeat(db, gender, seatNo, firstChoiceSeatNo, secondChoiceSeatNo, overrides = {}) {
  return submitSurvey(db, "demo", {
    name: `${gender}-${seatNo}`,
    phone: phoneFor(gender, seatNo),
    nickname: `${gender[0]}${seatNo}`,
    gender,
    seatNo,
    firstChoiceSeatNo,
    secondChoiceSeatNo,
    reviewNote: "",
    comment: "",
    ...overrides,
  });
}

function phoneFor(gender, seatNo) {
  const prefix = gender === "male" ? "1000" : "2000";
  return `010-${prefix}-${String(seatNo).padStart(4, "0")}`;
}

function normalizedPhoneFor(gender, seatNo) {
  return phoneFor(gender, seatNo).replace(/\D/g, "");
}

function label(db, participantId) {
  const participant = db.eventParticipants.find((item) => item.id === participantId);
  return `${participant.gender === "male" ? "M" : "F"}${participant.seatNo}`;
}

function statsByLabel(stats) {
  return Object.fromEntries(stats.map((stat) => [
    `${stat.gender === "male" ? "M" : "F"}${stat.seatNo}`,
    {
      score: stat.score,
      rank: stat.genderRank,
      first: stat.receivedFirstCount,
      second: stat.receivedSecondCount,
    },
  ]));
}

function pickStats(stats, keys) {
  return Object.fromEntries(keys.map((key) => [key, stats[key]]));
}
