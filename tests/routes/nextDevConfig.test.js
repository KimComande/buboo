import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Next dev server allows 127.0.0.1 origin for local browser preview", () => {
  const config = readFileSync("next.config.js", "utf8");

  assert.match(config, /allowedDevOrigins/);
  assert.match(config, /127\.0\.0\.1/);
});
