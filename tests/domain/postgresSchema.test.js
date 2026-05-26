import test from "node:test";
import assert from "node:assert/strict";
import * as schema from "../../src/db/schema.js";
import { setupPostgresSchemaSql, tableNames } from "../../src/db/schemaSql.js";

test("postgres schema exposes all MVP tables", () => {
  assert.deepEqual(tableNames, [
    "events",
    "members",
    "event_participants",
    "survey_submissions",
    "calculation_runs",
    "match_results",
    "vote_stats",
    "contact_view_logs",
    "system_heartbeats",
  ]);

  for (const exportName of [
    "events",
    "members",
    "eventParticipants",
    "surveySubmissions",
    "calculationRuns",
    "matchResults",
    "voteStats",
    "contactViewLogs",
    "systemHeartbeats",
  ]) {
    assert.ok(schema[exportName], `${exportName} should be exported`);
  }
});

test("setup SQL creates every table idempotently", () => {
  const normalizedSql = setupPostgresSchemaSql.toLowerCase().replace(/\s+/g, " ");

  for (const tableName of tableNames) {
    assert.match(normalizedSql, new RegExp(`create table if not exists ${tableName}\\b`));
  }
});
