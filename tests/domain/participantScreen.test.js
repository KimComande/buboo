import test from "node:test";
import assert from "node:assert/strict";
import { participantScreenState } from "../../src/domain/participantScreen.js";

test("participant screen has only vote preparing and result states", () => {
  assert.equal(participantScreenState("ready"), "vote");
  assert.equal(participantScreenState("voting"), "vote");
  assert.equal(participantScreenState("closed"), "preparing");
  assert.equal(participantScreenState("released"), "result");
  assert.equal(participantScreenState("ended"), "result");
});

test("unknown participant event status falls back to preparing state", () => {
  assert.equal(participantScreenState("paused"), "preparing");
  assert.equal(participantScreenState(null), "preparing");
});
