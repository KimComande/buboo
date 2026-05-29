import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const requiredRouteFiles = [
  "app/api/events/[slug]/public/route.js",
  "app/api/events/[slug]/submissions/route.js",
  "app/api/events/[slug]/result/route.js",
  "app/api/events/[slug]/contact/route.js",
  "app/api/admin/login/route.js",
  "app/api/admin/events/route.js",
  "app/api/admin/events/[slug]/dashboard/route.js",
  "app/api/admin/events/[slug]/settings/route.js",
  "app/api/admin/events/[slug]/calculate/route.js",
  "app/api/admin/events/[slug]/release/route.js",
  "app/api/admin/members/[memberId]/route.js",
  "app/api/internal/keepalive/route.js",
];

test("Next API route surface covers participant admin and keepalive flows", () => {
  for (const filePath of requiredRouteFiles) {
    assert.equal(existsSync(filePath), true, `${filePath} should exist`);
  }
});

test("participant public route uses a light event lookup", () => {
  const routeSource = readFileSync("app/api/events/[slug]/public/route.js", "utf8");
  const storeSource = readFileSync("src/store.js", "utf8");
  const postgresSource = readFileSync("src/db/postgresStore.js", "utf8");

  assert.match(routeSource, /readPublicEvent/);
  assert.doesNotMatch(routeSource, /readDb/);
  assert.match(storeSource, /readPublicEvent/);
  assert.match(postgresSource, /readPublicEvent/);
  assert.doesNotMatch(postgresSource.match(/export async function readPublicEvent[\s\S]*?(?=\nexport async function|\nasync function|\nfunction |$)/)?.[0] ?? "", /snapshotFromDb/);
});

test("participant submission route uses a dedicated store mutation", () => {
  const routeSource = readFileSync("app/api/events/[slug]/submissions/route.js", "utf8");
  const storeSource = readFileSync("src/store.js", "utf8");
  const postgresSource = readFileSync("src/db/postgresStore.js", "utf8");

  assert.match(routeSource, /submitSurveyToStore/);
  assert.doesNotMatch(routeSource, /mutateDb/);
  assert.match(storeSource, /submitSurveyToStore/);
  assert.match(postgresSource, /export async function submitSurvey/);
  assert.doesNotMatch(postgresSource.match(/export async function submitSurvey[\s\S]*?(?=\nexport async function|\nasync function|\nfunction |$)/)?.[0] ?? "", /snapshotFromDb/);
});

test("participant result and contact routes use light participant-specific store paths", () => {
  const resultRouteSource = readFileSync("app/api/events/[slug]/result/route.js", "utf8");
  const contactRouteSource = readFileSync("app/api/events/[slug]/contact/route.js", "utf8");
  const storeSource = readFileSync("src/store.js", "utf8");
  const postgresSource = readFileSync("src/db/postgresStore.js", "utf8");
  const postgresResultSource = postgresSource.match(/export async function getParticipantResult[\s\S]*?(?=\nexport async function|\nasync function|\nfunction |$)/)?.[0] ?? "";
  const postgresContactSource = postgresSource.match(/export async function viewContact[\s\S]*?(?=\nexport async function|\nasync function|\nfunction |$)/)?.[0] ?? "";

  assert.match(resultRouteSource, /getParticipantResultFromStore/);
  assert.doesNotMatch(resultRouteSource, /readDb/);
  assert.match(contactRouteSource, /viewContactFromStore/);
  assert.doesNotMatch(contactRouteSource, /mutateDb/);
  assert.match(storeSource, /getParticipantResultFromStore/);
  assert.match(storeSource, /viewContactFromStore/);
  assert.match(postgresSource, /export async function getParticipantResult/);
  assert.match(postgresSource, /export async function viewContact/);
  assert.doesNotMatch(postgresResultSource, /snapshotFromDb/);
  assert.doesNotMatch(postgresContactSource, /snapshotFromDb/);
  assert.doesNotMatch(postgresContactSource, /writeSnapshot/);
});

test("admin API routes use signed cookie auth and keep admin path hidden", () => {
  const authHelper = readFileSync("src/http/adminAuth.js", "utf8");
  assert.match(authHelper, /buboo_admin_session/);
  assert.match(authHelper, /ADMIN_PASSWORD/);
  assert.match(authHelper, /ADMIN_SESSION_SECRET/);
  assert.match(authHelper, /timingSafeEqual/);

  assert.equal(existsSync("app/buboo-ops-local/page.jsx"), true);
  assert.equal(existsSync("app/buboo-ops-local/login/page.jsx"), true);
  assert.equal(existsSync("app/admin/page.jsx"), false);
});

test("Vercel cron calls the internal keepalive route", () => {
  assert.equal(existsSync("vercel.json"), true);
  const vercelJson = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(vercelJson.crons, [
    {
      path: "/api/internal/keepalive",
      schedule: "0 18 * * *",
    },
  ]);
});
