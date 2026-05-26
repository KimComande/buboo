import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("participant page uses the agreed offline vote form copy", () => {
  assert.equal(existsSync("app/e/[slug]/page.jsx"), true);
  assert.equal(existsSync("src/components/event/EventClient.jsx"), true);

  const source = readFileSync("src/components/event/EventClient.jsx", "utf8");
  assert.match(source, /성별/);
  assert.match(source, /본인 번호를 선택해주세요/);
  assert.match(source, /예시\) 김하늘/);
  assert.match(source, /예시\) 01011223344/);
  assert.match(source, /들어오시며 말씀주신 닉네임/);
  assert.match(source, /예시\) 제이/);
  assert.match(source, /오늘의 1순위/);
  assert.match(source, /오늘의 2순위/);
  assert.match(source, /targetGenderText = vote\.gender === "male" \? "여성"/);
  assert.match(source, /분은 누구였나요\?/);
  assert.match(source, /\[선택\] 부부에게 하고 싶은 말/);
  assert.match(source, /결과 확인/);
  assert.match(source, /연락처 보기/);
  assert.match(source, /result_expired|expired/);
  assert.doesNotMatch(source, /플랫폼 닉네임/);
  assert.doesNotMatch(source, /선택 서술형/);
  assert.doesNotMatch(source, /reviewNote/);

  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /::placeholder/);
  assert.match(css, /--placeholder/);
});

test("admin pages are React flows for login dashboard operations and member search", () => {
  assert.equal(existsSync("app/buboo-ops-local/login/page.jsx"), true);
  assert.equal(existsSync("app/buboo-ops-local/page.jsx"), true);
  assert.equal(existsSync("src/components/admin/AdminLoginClient.jsx"), true);
  assert.equal(existsSync("src/components/admin/AdminDashboardClient.jsx"), true);

  const source = readFileSync("src/components/admin/AdminDashboardClient.jsx", "utf8");
  assert.match(source, /마감 및 계산/);
  assert.match(source, /결과 공개/);
  assert.match(source, /현재 모임/);
  assert.match(source, /행사명/);
  assert.match(source, /행사일/);
  assert.match(source, /새 모임 만들기/);
  assert.match(source, /마감 및 계산 후 회차가 표시됩니다/);
  assert.match(source, /koreaTodayDate/);
  assert.match(source, /명 기준/);
  assert.match(source, /memberKeyword/);
  assert.match(source, /selectedRunId/);
  assert.doesNotMatch(source, /모임 정보 저장/);
  assert.doesNotMatch(source, /설정 저장/);
  assert.doesNotMatch(source, /계산 없음/);
  assert.doesNotMatch(source, /아직 계산 전/);
});
