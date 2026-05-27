import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("participant UI options preview exposes three distinct full-field designs", () => {
  const filePath = "public/_preview/participant-ui-options.html";
  assert.equal(existsSync(filePath), true);

  const source = readFileSync(filePath, "utf8");

  assert.match(source, /A\. 전체 설문형/);
  assert.match(source, /B\. 단계 진행형/);
  assert.match(source, /C\. 빠른 제출형/);

  assert.match(source, /data-option="linear"/);
  assert.match(source, /data-option="stepper"/);
  assert.match(source, /data-option="quick"/);
  assert.match(source, /class="[^"]*step-progress/);
  assert.match(source, /class="[^"]*step-summary/);
  assert.match(source, /class="[^"]*quick-identity/);
  assert.match(source, /class="[^"]*priority-panel/);

  for (const label of [
    "성별",
    "본인 번호",
    "이름",
    "연락처",
    "닉네임",
    "1순위",
    "2순위",
    "부부에게 하고 싶은 말",
  ]) {
    assert.equal(countText(source, label) >= 3, true, `${label} should appear in all three options`);
  }

  assert.equal(countText(source, "<select") >= 9, true);
  assert.equal(countText(source, "<input") >= 9, true);
  assert.equal(countText(source, "<textarea") >= 3, true);
  assert.doesNotMatch(source, /DATABASE_URL|ADMIN_PASSWORD|local-admin/);
});

function countText(source, text) {
  return source.split(text).length - 1;
}
