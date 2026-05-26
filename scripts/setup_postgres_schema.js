import {
  closePostgresPool,
  ensurePostgresSchema,
  getPostgresPool,
  getTableCounts,
  keepAlive,
} from "../src/db/postgresStore.js";

try {
  await ensurePostgresSchema(getPostgresPool());
  await keepAlive();
  const counts = await getTableCounts();
  console.log(JSON.stringify({
    ok: true,
    tables: counts,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error.code ?? "schema_setup_failed",
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await closePostgresPool().catch(() => {});
}
