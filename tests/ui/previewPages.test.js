import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("participant UI options preview exposes three comparable designs", () => {
  const filePath = "public/_preview/participant-ui-options.html";
  assert.equal(existsSync(filePath), true);

  const source = readFileSync(filePath, "utf8");
  assert.match(source, /A\. 단순 설문지형/);
  assert.match(source, /B\. 그룹 설문형/);
  assert.match(source, /C\. 부부 카드형/);
  assert.match(source, /phone-frame/);
  assert.match(source, /mock-submit/);
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
