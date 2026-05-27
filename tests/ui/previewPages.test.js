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

test("participant recommended preview combines full survey flow with emphasized priority choices", () => {
  const filePath = "public/_preview/participant-ui-recommended.html";
  assert.equal(existsSync(filePath), true);

  const source = readFileSync(filePath, "utf8");
  assert.match(source, /추천 혼합안/);
  assert.match(source, /전체 흐름 \+ 호감 선택 강조/);
  assert.match(source, /data-preview="recommended-hybrid"/);
  assert.match(source, /class="[^"]*identity-section/);
  assert.match(source, /class="[^"]*priority-section/);
  assert.match(source, /class="[^"]*sticky-submit/);
  assert.match(source, /--brand-green: #0f6f63/);
  assert.match(source, /--romance: #a64267/);
  assert.match(source, /class="[^"]*rank-badge/);
  assert.match(source, /data-role="gender"/);
  assert.match(source, /data-role="own-seat"/);
  assert.match(source, /data-role="first-choice"/);
  assert.match(source, /data-role="second-choice"/);
  assert.match(source, /data-target-gender-label/);
  assert.match(source, /function updateGenderDependentFields/);
  assert.match(source, /여성분/);
  assert.match(source, /남성분/);
  assert.match(source, /여자 1번/);
  assert.match(source, /남자 1번/);

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
    assert.equal(countText(source, label) >= 1, true, `${label} should appear in the recommended option`);
  }

  assert.equal(countText(source, "<select") >= 4, true);
  assert.equal(countText(source, "<input") >= 3, true);
  assert.equal(countText(source, "<textarea") >= 1, true);
  assert.doesNotMatch(source, /DATABASE_URL|ADMIN_PASSWORD|local-admin/);
});

function countText(source, text) {
  return source.split(text).length - 1;
}
