import { readFile } from "node:fs/promises";
import {
  closePostgresPool,
  ensurePostgresSchema,
  getPostgresPool,
  getTableCounts,
  writeDb,
} from "../src/db/postgresStore.js";

const force = process.argv.includes("--force");
const sourceArgIndex = process.argv.findIndex((arg) => arg === "--source");
const sourcePath = sourceArgIndex >= 0
  ? process.argv[sourceArgIndex + 1]
  : "data/db.json";

const coreTables = [
  "events",
  "members",
  "event_participants",
  "survey_submissions",
  "calculation_runs",
  "match_results",
  "vote_stats",
  "contact_view_logs",
];

try {
  const db = JSON.parse(await readFile(sourcePath, "utf8"));
  await ensurePostgresSchema(getPostgresPool());
  const before = await getTableCounts();
  const occupiedTables = coreTables.filter((tableName) => before[tableName] > 0);
  if (occupiedTables.length > 0 && !force) {
    console.error(JSON.stringify({
      ok: false,
      error: "remote_tables_not_empty",
      occupiedTables,
      hint: "Run npm run db:migrate -- --force only after confirming overwrite is intended.",
    }, null, 2));
    process.exit(1);
  }

  await writeDb(db);
  const after = await getTableCounts();
  console.log(JSON.stringify({
    ok: true,
    sourcePath,
    forced: force,
    migrated: {
      members: db.members.length,
      events: db.events.length,
      eventParticipants: db.eventParticipants.length,
      surveySubmissions: db.surveySubmissions.length,
      calculationRuns: db.calculationRuns.length,
      matchResults: db.matchResults.length,
      voteStats: db.voteStats.length,
      contactViewLogs: db.contactViewLogs.length,
    },
    remoteCounts: after,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error.code ?? "migration_failed",
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await closePostgresPool().catch(() => {});
}
