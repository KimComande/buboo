import pg from "pg";
import { loadLocalEnv } from "../src/config/env.js";
import { closePostgresPool } from "../src/db/postgresStore.js";

const { Client } = pg;

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Put it in .env.local or the process environment.");
  process.exit(1);
}

const url = new URL(databaseUrl);
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query("select current_database() as database, current_user as user, now() as checked_at");
  console.log(JSON.stringify({
    ok: true,
    host: url.hostname,
    port: url.port,
    database: result.rows[0].database,
    user: result.rows[0].user,
    checkedAt: result.rows[0].checked_at,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    host: url.hostname,
    port: url.port,
    error: error.code ?? "connection_failed",
    message: error.message,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
  await closePostgresPool().catch(() => {});
}
