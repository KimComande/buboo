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
  assert.match(source, /--canvas: #f7f8fb/);
  assert.match(source, /--wash-mint: #e8f7f2/);
  assert.match(source, /--wash-blush: #fff1f5/);
  assert.match(source, /--glass: rgba\(255, 255, 255, 0\.78\)/);
  assert.match(source, /backdrop-filter: blur\(18px\)/);
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

test("participant result preview demonstrates matched and no-match lookups", () => {
  const filePath = "public/_preview/participant-result-check.html";
  assert.equal(existsSync(filePath), true);

  const source = readFileSync(filePath, "utf8");
  assert.match(source, /매칭 결과 확인 미리보기/);
  assert.match(source, /data-preview="participant-result-demo"/);
  assert.match(source, /김 \/ 1234/);
  assert.match(source, /이 \/ 1123/);
  assert.doesNotMatch(source, /결과 있음/);
  assert.match(source, /연결 없음/);
  assert.match(source, /data-sample="matched"/);
  assert.match(source, /data-sample="none"/);
  assert.match(source, /function lookupDemoResult/);
  assert.match(source, /class="[^"]*matched-result/);
  assert.match(source, /class="[^"]*no-match-result/);
  assert.match(source, /이름과 연락처로 결과를 확인해 주세요/);
  assert.match(source, /연락처는 전체 번호 또는 뒤 4자리로 확인할 수 있어요/);
  assert.doesNotMatch(source, /연락처는 전체 번호 또는 뒤 4자리로 확인할 수 있습니다/);
  assert.match(source, /두 분의 마음이 닿았어요\. ❤/);
  assert.match(source, /서로를 향한 따뜻한 호감이 확인되어 매칭되었어요/);
  assert.doesNotMatch(source, /두 분의 마음이 닿았어요\.❤/);
  assert.doesNotMatch(source, /서로를 향한 따뜻한 선택이 확인되어 매칭되었어요/);
  assert.doesNotMatch(source, /서로의 선택이 확인되어 매칭되었습니다/);
  assert.doesNotMatch(source, /서로의 선택이 확인되었습니다/);
  assert.doesNotMatch(source, /<p class="result-kicker">결과 있음<\/p>/);
  assert.match(source, /입력해 주신 정보와 일치하는 결과를 찾지 못했어요/);
  assert.match(source, /정보가 정확한지 다시 한번 확인해 주세요/);
  assert.doesNotMatch(source, /확인 실패/);
  assert.doesNotMatch(source, /입력하신 정보로 호감 결과를 찾지 못했어요/);
  assert.doesNotMatch(source, /다시 확인하시고 입력해주세요/);
  assert.match(source, /아쉽게도 이번에는 서로의 마음이 닿지 않았어요/);
  assert.match(source, /귀한 시간 내어 부부와 함께해 주셔서 진심으로 감사드려요/);
  assert.match(source, /앞으로 다가올 소중한 인연을 늘 응원할게요/);
  assert.doesNotMatch(source, /아쉽게도 서로 연결되지 않았어요/);
  assert.doesNotMatch(source, /참석해 주셔서 감사해요/);
  assert.doesNotMatch(source, /귀한 시간 내어 부부와 함께해 주셔서 진심으로 감사드립니다/);
  assert.doesNotMatch(source, /좋은 인연을 만나기를 먼발치에서 응원하겠습니다/);
  assert.doesNotMatch(source, /앞으로 다가올 소중한 인연을 늘 응원하겠습니다/);
  assert.match(source, /여자 2번/);
  assert.match(source, /연락처 보기/);
  assert.match(source, /010-2002-2002/);
  assert.doesNotMatch(source, /이서연|서연/);
  assert.doesNotMatch(source, /<p class="result-kicker">결과 없음<\/p>/);
  assert.doesNotMatch(source, /DATABASE_URL|ADMIN_PASSWORD|local-admin/);
});

function countText(source, text) {
  return source.split(text).length - 1;
}
