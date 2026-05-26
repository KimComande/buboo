import test from "node:test";
import assert from "node:assert/strict";
import { buildMatchResults } from "../../src/domain/matching.js";

test("buildMatchResults creates all reciprocal rank combinations", () => {
  const submissions = [
    { participantId: "P-M1", firstChoiceId: "P-F1", secondChoiceId: "P-F2" },
    { participantId: "P-M2", firstChoiceId: "P-F3", secondChoiceId: "P-F4" },
    { participantId: "P-M3", firstChoiceId: "P-F5", secondChoiceId: "P-F6" },
    { participantId: "P-M4", firstChoiceId: "P-F7", secondChoiceId: "P-F8" },
    { participantId: "P-F1", firstChoiceId: "P-M1", secondChoiceId: "none" },
    { participantId: "P-F2", firstChoiceId: "none", secondChoiceId: "P-M1" },
    { participantId: "P-F3", firstChoiceId: "P-M9", secondChoiceId: "P-M2" },
    { participantId: "P-F4", firstChoiceId: "none", secondChoiceId: "P-M2" },
    { participantId: "P-F5", firstChoiceId: "P-M3", secondChoiceId: "none" },
    { participantId: "P-F6", firstChoiceId: "none", secondChoiceId: "P-M3" },
    { participantId: "P-F7", firstChoiceId: "P-M9", secondChoiceId: "P-M4" },
    { participantId: "P-F8", firstChoiceId: "none", secondChoiceId: "P-M4" },
  ];

  const results = buildMatchResults(submissions, {
    "P-M1": "male",
    "P-M2": "male",
    "P-M3": "male",
    "P-M4": "male",
    "P-F1": "female",
    "P-F2": "female",
    "P-F3": "female",
    "P-F4": "female",
    "P-F5": "female",
    "P-F6": "female",
    "P-F7": "female",
    "P-F8": "female",
  });

  assert.deepEqual(results.map((result) => result.matchCode).sort(), [
    "M1-F1",
    "M1-F1",
    "M1-F2",
    "M1-F2",
    "M2-F2",
    "M2-F2",
    "M2-F2",
    "M2-F2",
  ]);
});

test("buildMatchResults ignores none and non reciprocal choices", () => {
  const submissions = [
    { participantId: "P-M1", firstChoiceId: "none", secondChoiceId: "none" },
    { participantId: "P-M2", firstChoiceId: "P-F1", secondChoiceId: "none" },
    { participantId: "P-F1", firstChoiceId: "none", secondChoiceId: "none" },
  ];
  const results = buildMatchResults(submissions, {
    "P-M1": "male",
    "P-M2": "male",
    "P-F1": "female",
  });

  assert.deepEqual(results, []);
});
