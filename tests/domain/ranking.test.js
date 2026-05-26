import test from "node:test";
import assert from "node:assert/strict";
import { calculateVoteStats } from "../../src/domain/ranking.js";

test("calculateVoteStats scores first as 2 points and second as 1 point", () => {
  const stats = calculateVoteStats(
    [
      { id: "P-M1", gender: "male" },
      { id: "P-M2", gender: "male" },
      { id: "P-F1", gender: "female" },
      { id: "P-F2", gender: "female" },
    ],
    [
      { participantId: "P-M1", firstChoiceId: "P-F1", secondChoiceId: "P-F2" },
      { participantId: "P-M2", firstChoiceId: "P-F1", secondChoiceId: "none" },
      { participantId: "P-F1", firstChoiceId: "none", secondChoiceId: "none" },
      { participantId: "P-F2", firstChoiceId: "P-M1", secondChoiceId: "none" },
    ],
  );

  assert.equal(stats.find((stat) => stat.participantId === "P-F1").score, 4);
  assert.equal(stats.find((stat) => stat.participantId === "P-F1").receivedFirstCount, 2);
  assert.equal(stats.find((stat) => stat.participantId === "P-F2").score, 1);
  assert.equal(stats.find((stat) => stat.participantId === "P-M1").score, 2);
});

test("calculateVoteStats uses RANK.EQ style competition ranking", () => {
  const participants = ["P-M1", "P-M2", "P-M3", "P-M4", "P-M5"].map((id) => ({ id, gender: "male" }));
  const submissions = [
    { participantId: "P-F1", firstChoiceId: "P-M1", secondChoiceId: "P-M2" },
    { participantId: "P-F2", firstChoiceId: "P-M1", secondChoiceId: "P-M3" },
    { participantId: "P-F3", firstChoiceId: "P-M2", secondChoiceId: "P-M1" },
    { participantId: "P-F4", firstChoiceId: "P-M3", secondChoiceId: "P-M5" },
    { participantId: "P-F5", firstChoiceId: "P-M4", secondChoiceId: "P-M5" },
  ];

  const ranks = Object.fromEntries(
    calculateVoteStats(participants, submissions).map((stat) => [stat.participantId, stat.genderRank]),
  );

  assert.deepEqual(ranks, {
    "P-M1": 1,
    "P-M2": 2,
    "P-M3": 2,
    "P-M4": 4,
    "P-M5": 4,
  });
});

test("calculateVoteStats leaves zero-score participants unranked", () => {
  const stats = calculateVoteStats(
    [
      { id: "P-M1", gender: "male" },
      { id: "P-M2", gender: "male" },
      { id: "P-M3", gender: "male" },
    ],
    [
      { participantId: "P-F1", firstChoiceId: "P-M1", secondChoiceId: "none" },
    ],
  );

  const ranks = Object.fromEntries(stats.map((stat) => [stat.participantId, stat.genderRank]));

  assert.deepEqual(ranks, {
    "P-M1": 1,
    "P-M2": null,
    "P-M3": null,
  });
});
