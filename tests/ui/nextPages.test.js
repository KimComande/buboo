import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("participant page uses the agreed offline vote form copy", () => {
  assert.equal(existsSync("app/e/[slug]/page.jsx"), true);
  assert.equal(existsSync("src/components/event/EventClient.jsx"), true);

  const pageSource = readFileSync("app/e/[slug]/page.jsx", "utf8");
  assert.match(pageSource, /readPublicEvent/);
  assert.match(pageSource, /initialEventData/);

  const source = readFileSync("src/components/event/EventClient.jsx", "utf8");
  assert.match(source, /initialEventData/);
  assert.match(source, /loading-spinner/);
  assert.match(source, /participantScreenState/);
  assert.match(source, /screenState === "vote"/);
  assert.match(source, /screenState === "preparing"/);
  assert.match(source, /screenState === "result"/);
  assert.match(source, /vote-panel/);
  assert.match(source, /vote-form/);
  assert.match(source, /form-question/);
  assert.match(source, /question-text/);
  assert.match(source, /성별/);
  assert.match(source, /본인 번호를 선택해주세요/);
  assert.match(source, /예시\) 김하늘/);
  assert.match(source, /예시\) 01011223344/);
  assert.match(source, /들어오시며 말씀주신 닉네임/);
  assert.match(source, /예시\) 제이/);
  assert.match(source, /오늘의 1순위/);
  assert.match(source, /오늘의 2순위/);
  assert.match(source, /const ownCapacity = vote\.gender === "male" \? eventData\?\.maleCapacity : eventData\?\.femaleCapacity/);
  assert.match(source, /const targetCapacity = vote\.gender === "male" \? eventData\?\.femaleCapacity : eventData\?\.maleCapacity/);
  assert.match(source, /targetGenderText = vote\.gender === "male" \? "여성"/);
  assert.match(source, /targetSeatText = vote\.gender === "male" \? "여자"/);
  assert.match(source, /if \(field === "gender"\)/);
  assert.match(source, /next\.firstChoiceSeatNo = ""/);
  assert.match(source, /next\.secondChoiceSeatNo = ""/);
  assert.match(source, /분은 누구였나요\?/);
  assert.match(source, /\[선택\] 부부에게 하고 싶은 말/);
  assert.match(source, /결과 정리 중/);
  assert.match(source, /매칭 결과 확인/);
  assert.match(source, /canCheckResult/);
  assert.match(source, /연락처 보기/);
  assert.match(source, /두 분의 마음이 닿았어요\.❤/);
  assert.match(source, /서로를 향한 따뜻한 선택이 확인되어 매칭되었어요/);
  assert.doesNotMatch(source, /<h3>매칭되었습니다<\/h3>/);
  assert.match(source, /genderText\(match\.target\.gender\)} {match\.target\.seatNo}번/);
  assert.doesNotMatch(source, /match\.target\.name/);
  assert.doesNotMatch(source, /match\.target\.nickname/);
  assert.match(source, /아쉽게도 이번에는 서로의 마음이 닿지 않았어요/);
  assert.match(source, /귀한 시간 내어 부부와 함께해 주셔서 진심으로 감사드립니다/);
  assert.match(source, /앞으로 다가올 소중한 인연을 늘 응원하겠습니다/);
  assert.match(source, /입력하신 정보로 호감 결과를 찾지 못했어요/);
  assert.match(source, /다시 확인하시고 입력해주세요/);
  assert.doesNotMatch(source, /확인 실패/);
  assert.doesNotMatch(source, /입력하신 정보로 제출 내역을 찾지 못했습니다/);
  assert.doesNotMatch(source, /아쉽게도 서로 연결되지 않았어요/);
  assert.doesNotMatch(source, /참석해 주셔서 감사해요/);
  assert.doesNotMatch(source, /좋은 인연을 만나기를 먼발치에서 응원하겠습니다/);
  assert.doesNotMatch(source, /오늘은 서로 연결된 호감이 확인되지 않았어요/);
  assert.match(source, /result_expired|expired/);
  assert.doesNotMatch(source, /불러오는 중입니다/);
  assert.doesNotMatch(source, /마감 및 계산/);
  assert.doesNotMatch(source, /플랫폼 닉네임/);
  assert.doesNotMatch(source, /선택 서술형/);
  assert.doesNotMatch(source, /reviewNote/);

  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /::placeholder/);
  assert.match(css, /--placeholder/);
  assert.match(css, /@keyframes spin/);
  assert.match(css, /\.vote-form/);
  assert.match(css, /\.form-question/);
  assert.match(css, /\.question-text/);
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

test("admin dashboard exposes mobile card labels for dense operational tables", () => {
  const source = readFileSync("src/components/admin/AdminDashboardClient.jsx", "utf8");
  assert.match(source, /mobile-card-table participant-table/);
  assert.match(source, /mobile-card-table member-table/);
  assert.match(source, /data-label="번호"/);
  assert.match(source, /data-label="최신 제출"/);
  assert.match(source, /data-label="프로필"/);
  assert.match(source, /data-label="최고순위\/참여"/);
  assert.match(source, /table-scroll-hint/);

  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.mobile-card-table/);
  assert.match(css, /td::before/);
  assert.match(css, /content: attr\(data-label\)/);
});

test("admin member search explains aliases and participation history", () => {
  const source = readFileSync("src/components/admin/AdminDashboardClient.jsx", "utf8");
  assert.match(source, /이름 이력/);
  assert.match(source, /닉네임 이력/);
  assert.match(source, /최근 참여/);
  assert.match(source, /submittedNickname/);
  assert.match(source, /member-history-list/);
});
