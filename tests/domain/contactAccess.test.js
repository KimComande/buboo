import test from "node:test";
import assert from "node:assert/strict";
import { canViewContact } from "../../src/domain/contactAccess.js";

const base = {
  eventStatus: "released",
  eventReleasedCalculationRunId: "RUN1",
  matchCalculationRunId: "RUN1",
  matchStatus: "released",
  viewerParticipantId: "P-M1",
  targetParticipantId: "P-F2",
  maleParticipantId: "P-M1",
  femaleParticipantId: "P-F2",
};

test("match parties can view counterparty contact", () => {
  assert.deepEqual(canViewContact(base), { ok: true });
});

test("non party cannot view contact", () => {
  assert.deepEqual(canViewContact({ ...base, viewerParticipantId: "P-M2" }), {
    ok: false,
    reason: "viewer_not_party",
  });
});

test("viewer cannot request a non counterparty target", () => {
  assert.deepEqual(canViewContact({ ...base, targetParticipantId: "P-F3" }), {
    ok: false,
    reason: "target_not_counterparty",
  });
});

test("superseded calculation run cannot expose contact", () => {
  assert.deepEqual(canViewContact({ ...base, matchCalculationRunId: "RUN0" }), {
    ok: false,
    reason: "not_current_released_run",
  });
});

test("event must be released", () => {
  assert.deepEqual(canViewContact({ ...base, eventStatus: "closed" }), {
    ok: false,
    reason: "event_not_released",
  });
});
