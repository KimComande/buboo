import test from "node:test";
import assert from "node:assert/strict";
import { validateChoicePair, resolveChoice } from "../../src/domain/choices.js";

test("choice pair allows two different participants", () => {
  assert.deepEqual(validateChoicePair("P-F1", "P-F2"), { ok: true });
});

test("choice pair allows participant then none", () => {
  assert.deepEqual(validateChoicePair("P-F1", "none"), { ok: true });
});

test("choice pair allows none then none", () => {
  assert.deepEqual(validateChoicePair("none", "none"), { ok: true });
});

test("choice pair rejects none then participant", () => {
  assert.deepEqual(validateChoicePair("none", "P-F1"), {
    ok: false,
    reason: "first_none_second_present",
  });
});

test("choice pair rejects duplicate participants", () => {
  assert.deepEqual(validateChoicePair("P-F1", "P-F1"), {
    ok: false,
    reason: "duplicate_choice",
  });
});

test("resolveChoice returns none for explicit none", () => {
  assert.deepEqual(resolveChoice({
    sourceParticipantId: "P-M1",
    targetParticipantId: "none",
    activeTargetIds: ["P-F1", "P-F2"],
  }), { status: "none", targetParticipantId: null });
});

test("resolveChoice rejects targets outside active participants", () => {
  assert.deepEqual(resolveChoice({
    sourceParticipantId: "P-M1",
    targetParticipantId: "P-F9",
    activeTargetIds: ["P-F1", "P-F2"],
  }), { status: "invalid", reason: "target_not_active" });
});
