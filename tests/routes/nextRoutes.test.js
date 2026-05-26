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
