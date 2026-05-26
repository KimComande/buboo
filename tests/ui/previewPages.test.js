import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("participant UI options preview exposes three comparable designs", () => {
  const filePath = "public/_preview/participant-ui-options.html";
  assert.equal(existsSync(filePath), true);

  const source = readFileSync(filePath, "utf8");
  assert.match(source, /A\. 단순 설문지형/);
  assert.match(source, /B\. 한 화면 집중형/);
  assert.match(source, /C\. 부부 카드형/);
  assert.match(source, /phone-frame/);
  assert.match(source, /mock-submit/);
  assert.doesNotMatch(source, /DATABASE_URL|ADMIN_PASSWORD|local-admin/);
});
