import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../../src/demoData.js";
import { createSeedData } from "../../src/seedData.js";
import {
  calculateEvent,
  createEvent,
  getAdminDashboard,
  getParticipantResult,
  getPublicEvent,
  releaseCalculationRun,
  submitSurvey,
  updateMember,
  viewContact,
} from "../../src/appLogic.js";

test("createSeedData defaults to five seats and present attendance", () => {
  const db = createSeedData({ slug: "demo" });

  assert.equal(db.events[0].title, "부부, 호기심에서 결혼까지 (260521)");
  assert.equal(db.events[0].maleCapacity, 5);
  assert.equal(db.events[0].femaleCapacity, 5);
  assert.equal(db.eventParticipants.length, 10);
  assert.equal(db.eventParticipants.every((participant) => participant.attendanceStatus === "present"), true);
});

test("getPublicEvent strips date suffix from participant display title", () => {
  const db = createSeedData({ slug: "demo", eventDate: "2026-05-09" });
  const event = getPublicEvent(db, "demo");

  assert.equal(event.title, "부부, 호기심에서 결혼까지 (260509)");
  assert.equal(event.displayTitle, "부부, 호기심에서 결혼까지");
});

test("createDemoData seeds three 5x5 calculation rounds with logs and member statuses", () => {
  const db = createDemoData();
  const dashboard = getAdminDashboard(db, "demo");

  assert.equal(db.events[0].maleCapacity, 5);
  assert.equal(db.events[0].femaleCapacity, 5);
  assert.equal(db.eventParticipants.length, 10);
  assert.equal(db.members.length, 10);
  assert.equal(db.calculationRuns.length, 3);
  assert.equal(db.calculationRuns.every((run) => run.status === "released"), true);
  assert.equal(db.voteStats.length, 30);
  assert.equal(db.contactViewLogs.length >= 3, true);
  assert.equal(db.members.some((member) => member.status === "blacklist"), true);
  assert.equal(db.members.some((member) => member.status === "poor_quality"), true);
  assert.equal(db.members.every((member) => ["normal", "poor_quality", "blacklist"].includes(member.status)), true);
  assert.equal(dashboard.latestRun.calculationSummary.excludedAbsentCount, 0);
  assert.equal(dashboard.latestRun.calculationSummary.flaggedBlacklistCount, 2);
  assert.equal(dashboard.memberSummaries.length, 10);
  assert.equal(dashboard.memberSummaries.some((summary) => summary.history.length >= 1), true);
  assert.equal(dashboard.memberSummaries.some((summary) => summary.bestRank !== null), true);
  assert.deepEqual(
    [...new Set(dashboard.memberSummaries[0].history.map((history) => history.eventDate))],
    ["2026-05-09"],
  );
});

test("manual member profile is kept when the same phone submits again", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  const first = submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  });

  updateMember(db, first.memberId, {
    mbti: "ENFJ",
    strengths: "대화가 편안함",
    job: "기획자",
    height: "178",
    desiredPartner: "따뜻하게 소통하는 사람",
    memo: "수기 프로필 입력",
  });

  submitSurvey(db, "demo", {
    name: "Kim",
    phone: "01011112222",
    nickname: "alpha2",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "다시 제출",
  });

  const member = db.members.find((item) => item.id === first.memberId);
  assert.equal(db.members.length, 1);
  assert.equal(member.nickname, "alpha");
  assert.equal(member.latestNickname, "alpha2");
  assert.deepEqual(member.nicknameAliases, ["alpha", "alpha2"]);
  assert.equal(member.mbti, "ENFJ");
  assert.equal(member.strengths, "대화가 편안함");
  assert.equal(member.job, "기획자");
  assert.equal(member.height, "178");
  assert.equal(member.desiredPartner, "따뜻하게 소통하는 사람");
  assert.equal(member.memo, "수기 프로필 입력");
});

test("same phone keeps canonical member identity and records name aliases", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  const first = submitSurvey(db, "demo", {
    name: "김도윤",
    phone: "010-1111-2222",
    nickname: "도윤",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:00:00.000Z" });

  submitSurvey(db, "demo", {
    name: "김도유",
    phone: "01011112222",
    nickname: "준호",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "닉네임 변경",
  }, { now: "2026-05-21T10:05:00.000Z" });

  const member = db.members.find((item) => item.id === first.memberId);
  assert.equal(db.members.length, 1);
  assert.equal(member.name, "김도윤");
  assert.equal(member.nickname, "도윤");
  assert.equal(member.canonicalName, "김도윤");
  assert.equal(member.canonicalNickname, "도윤");
  assert.equal(member.latestName, "김도유");
  assert.equal(member.latestNickname, "준호");
  assert.deepEqual(member.nameAliases, ["김도윤", "김도유"]);
  assert.deepEqual(member.nicknameAliases, ["도윤", "준호"]);
});

test("full phone authentication tolerates name typos while last four stays alias strict", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  submitSurvey(db, "demo", {
    name: "김도윤",
    phone: "010-1111-2222",
    nickname: "도윤",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:00:00.000Z" });

  submitSurvey(db, "demo", {
    name: "김도유",
    phone: "01011112222",
    nickname: "준호",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "이름 오타",
  }, { now: "2026-05-21T10:05:00.000Z" });

  const run = calculateEvent(db, "demo", { now: "2026-05-21T10:10:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-21T10:11:00.000Z" });

  const exactPhone = getParticipantResult(db, "demo", {
    name: "김도윤",
    phone: "01011112222",
  }, { now: "2026-05-21T14:00:00.000Z" });
  assert.equal(exactPhone.viewer.seatNo, 1);

  const aliasLastFour = getParticipantResult(db, "demo", {
    name: "김도윤",
    phone: "2222",
  }, { now: "2026-05-21T14:00:00.000Z" });
  assert.equal(aliasLastFour.viewer.seatNo, 1);

  assert.throws(() => getParticipantResult(db, "demo", {
    name: "김도영",
    phone: "2222",
  }, { now: "2026-05-21T14:00:00.000Z" }), /participant_auth_failed/);
});

test("participant result can be verified with phone last four digits", () => {
  const db = createDemoData();
  const result = getParticipantResult(db, "demo", {
    name: "김도윤",
    phone: "1001",
  }, { now: "2026-05-09T14:00:00.000Z" });

  assert.equal(result.status, "released");
  assert.equal(result.viewer.name, "김도윤");
});

test("participant result does not expose internal match rank details", () => {
  const db = createDemoData();
  const result = getParticipantResult(db, "demo", {
    name: "김도윤",
    phone: "1001",
  }, { now: "2026-05-09T14:00:00.000Z" });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].matchCode, undefined);
  assert.equal(result.matches[0].maleChoiceRank, undefined);
  assert.equal(result.matches[0].femaleChoiceRank, undefined);
});

test("participant result keeps matched participant names private", () => {
  const db = createDemoData();
  const result = getParticipantResult(db, "demo", {
    name: "김도윤",
    phone: "1001",
  }, { now: "2026-05-09T14:00:00.000Z" });

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].target.gender, "female");
  assert.equal(result.matches[0].target.seatNo, 2);
  assert.equal(result.matches[0].target.name, undefined);
  assert.equal(result.matches[0].target.nickname, undefined);
});

test("last four digit authentication rejects ambiguous same-name candidates", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 1 });

  submitSurvey(db, "demo", {
    name: "Kim Same",
    phone: "010-1111-1001",
    nickname: "one",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:00:00.000Z" });

  submitSurvey(db, "demo", {
    name: "Kim Same",
    phone: "010-2222-1001",
    nickname: "two",
    gender: "male",
    seatNo: 2,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:01:00.000Z" });

  const run = calculateEvent(db, "demo", { now: "2026-05-21T10:10:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-21T10:11:00.000Z" });

  assert.throws(() => getParticipantResult(db, "demo", {
    name: "Kim Same",
    phone: "1001",
  }, { now: "2026-05-21T14:00:00.000Z" }), /participant_auth_ambiguous/);

  const exact = getParticipantResult(db, "demo", {
    name: "Kim Same",
    phone: "01011111001",
  }, { now: "2026-05-21T14:00:00.000Z" });
  assert.equal(exact.viewer.seatNo, 1);
});

test("member blacklist status is managed on the member profile", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  const submission = submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  });

  const member = updateMember(db, submission.memberId, {
    status: "blacklist",
  });
  assert.equal(member.status, "blacklist");
});

test("event calculations use submitted seats and keep blacklist as a member flag only", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });

  const maleOne = submitSurvey(db, "demo", {
    name: "Male One",
    phone: "010-1111-1111",
    nickname: "m1",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  });
  const femaleOne = submitSurvey(db, "demo", {
    name: "Female One",
    phone: "010-3333-3333",
    nickname: "f1",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  });
  const femaleTwo = submitSurvey(db, "demo", {
    name: "Female Two",
    phone: "010-4444-4444",
    nickname: "f2",
    gender: "female",
    seatNo: 2,
    firstChoiceSeatNo: 2,
    secondChoiceSeatNo: "none",
    comment: "",
  });

  updateMember(db, femaleTwo.memberId, { status: "blacklist" });

  const run = calculateEvent(db, "demo");
  const calculatedParticipantIds = new Set(run.voteStats.map((stat) => stat.participantId));

  assert.deepEqual(run.matches.map((match) => match.femaleParticipantId), [
    femaleOne.eventParticipantId,
  ]);
  assert.equal(calculatedParticipantIds.has(maleOne.eventParticipantId), true);
  assert.equal(calculatedParticipantIds.has(femaleOne.eventParticipantId), true);
  assert.equal(calculatedParticipantIds.has(femaleTwo.eventParticipantId), true);
  assert.deepEqual(run.calculationSummary, {
    configuredMaleCount: 2,
    configuredFemaleCount: 2,
    submittedMaleCount: 1,
    submittedFemaleCount: 2,
    includedMaleCount: 1,
    includedFemaleCount: 2,
    excludedAbsentCount: 0,
    flaggedBlacklistCount: 1,
    unsubmittedCount: 1,
  });
});

test("member status is normalized and limited to supported values", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  const submission = submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  });

  const poorQuality = updateMember(db, submission.memberId, { status: "poor_quality" });
  assert.equal(poorQuality.status, "poor_quality");

  const legacyInactive = updateMember(db, submission.memberId, { status: "inactive" });
  assert.equal(legacyInactive.status, "normal");

  const legacyDoNotInvite = updateMember(db, submission.memberId, { status: "do_not_invite" });
  assert.equal(legacyDoNotInvite.status, "blacklist");

  assert.throws(() => updateMember(db, submission.memberId, {
    status: "unknown_status",
  }), /invalid_member_status/);
});

test("only the latest draft calculation run can be released", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 1, femaleCapacity: 1 });
  submitSurvey(db, "demo", {
    name: "Male",
    phone: "010-1111-1111",
    nickname: "m",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  });

  const firstRun = calculateEvent(db, "demo", { now: "2026-05-21T10:00:00.000Z" });
  const secondRun = calculateEvent(db, "demo", { now: "2026-05-21T10:05:00.000Z" });

  assert.throws(() => releaseCalculationRun(db, "demo", firstRun.id), /calculation_run_not_latest/);

  releaseCalculationRun(db, "demo", secondRun.id);
  assert.throws(() => releaseCalculationRun(db, "demo", secondRun.id), /calculation_run_not_draft/);
});

test("member summary uses released event-level popularity and matching rates", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });
  const maleOne = submitSurvey(db, "demo", {
    name: "Male One",
    phone: "010-1111-1111",
    nickname: "m1",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  });
  submitSurvey(db, "demo", {
    name: "Male Two",
    phone: "010-2222-2222",
    nickname: "m2",
    gender: "male",
    seatNo: 2,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  });
  submitSurvey(db, "demo", {
    name: "Female One",
    phone: "010-3333-3333",
    nickname: "f1",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  });
  submitSurvey(db, "demo", {
    name: "Female Two",
    phone: "010-4444-4444",
    nickname: "f2",
    gender: "female",
    seatNo: 2,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  });

  const releasedRun = calculateEvent(db, "demo", { now: "2026-05-21T10:00:00.000Z" });
  releaseCalculationRun(db, "demo", releasedRun.id, { now: "2026-05-21T10:01:00.000Z" });
  calculateEvent(db, "demo", { now: "2026-05-21T10:05:00.000Z" });

  const dashboard = getAdminDashboard(db, "demo");
  const member = dashboard.memberSummaries.find((summary) => summary.id === maleOne.memberId);

  assert.equal(member.participationCount, 1);
  assert.equal(member.confirmedParticipationCount, 1);
  assert.equal(member.totalMatchCount, 1);
  assert.equal(member.averageMatchesPerEvent, 1);
  assert.equal(member.averageMatchRate, 50);
  assert.equal(member.matchedEventRate, 50);
  assert.equal(member.averagePopularityRate, 100);
  assert.equal(member.bestRank, 1);
  assert.equal(member.bestRankDenominator, 2);
});

test("member summary history includes submitted nicknames for alias review", () => {
  const db = createSeedData({ slug: "demo", eventDate: "2026-01-03", maleCapacity: 1, femaleCapacity: 1 });
  const first = submitSurvey(db, "demo", {
    name: "류현식",
    phone: "010-5282-2266",
    nickname: "포도",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-01-03T10:00:00.000Z" });
  submitSurvey(db, "demo", {
    name: "상대",
    phone: "010-0000-0001",
    nickname: "상대1",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-01-03T10:01:00.000Z" });
  const firstRun = calculateEvent(db, "demo", { now: "2026-01-03T10:10:00.000Z" });
  releaseCalculationRun(db, "demo", firstRun.id, { now: "2026-01-03T10:11:00.000Z" });

  const secondEvent = createEvent(db, {
    title: "두 번째 모임",
    eventDate: "2026-02-21",
    maleCapacity: 1,
    femaleCapacity: 1,
  }, { now: "2026-02-21T10:00:00.000Z" });
  submitSurvey(db, secondEvent.publicSlug, {
    name: "류현식",
    phone: "01052822266",
    nickname: "딩동",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-02-21T10:02:00.000Z" });
  submitSurvey(db, secondEvent.publicSlug, {
    name: "상대",
    phone: "010-0000-0002",
    nickname: "상대2",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-02-21T10:03:00.000Z" });
  const secondRun = calculateEvent(db, secondEvent.publicSlug, { now: "2026-02-21T10:10:00.000Z" });
  releaseCalculationRun(db, secondEvent.publicSlug, secondRun.id, { now: "2026-02-21T10:11:00.000Z" });

  const dashboard = getAdminDashboard(db, secondEvent.publicSlug);
  const member = dashboard.memberSummaries.find((summary) => summary.id === first.memberId);

  assert.deepEqual(member.nicknameAliases, ["포도", "딩동"]);
  assert.deepEqual(member.history.map((item) => item.submittedNickname), ["포도", "딩동"]);
  assert.deepEqual(member.history.map((item) => item.submittedName), ["류현식", "류현식"]);
});

test("member summary breaks equal best ranks by larger participation denominator", () => {
  const targetMember = {
    id: "MEM-target",
    name: "Target",
    phone: "01011112222",
    nickname: "target",
    gender: "male",
    status: "normal",
    memo: "",
    mbti: "",
    strengths: "",
    job: "",
    height: "",
    desiredPartner: "",
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T09:00:00.000Z",
  };
  const db = {
    members: [targetMember],
    events: [
      releasedEvent("EVT-five", "five", "RUN-five-1"),
      releasedEvent("EVT-seven", "seven", "RUN-seven-1"),
    ],
    eventParticipants: [
      participant("EP-five-target", "EVT-five", "male", 1, targetMember.id),
      participant("EP-seven-target", "EVT-seven", "male", 1, targetMember.id),
    ],
    surveySubmissions: [],
    calculationRuns: [
      releasedRun("RUN-five-1", "EVT-five", 5, "2026-05-01T10:00:00.000Z"),
      releasedRun("RUN-seven-1", "EVT-seven", 7, "2026-05-08T10:00:00.000Z"),
    ],
    matchResults: [],
    voteStats: [
      ...rankedStats("RUN-five-1", "EVT-five", "EP-five-target", 5),
      ...rankedStats("RUN-seven-1", "EVT-seven", "EP-seven-target", 7),
    ],
    contactViewLogs: [],
  };

  const dashboard = getAdminDashboard(db, "five");
  const summary = dashboard.memberSummaries.find((item) => item.id === targetMember.id);

  assert.equal(summary.bestRank, 4);
  assert.equal(summary.bestRankDenominator, 7);
});

test("submitSurvey stores repeated seat submissions as versions and keeps latest active", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });

  const first = submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "first",
  }, { now: "2026-05-21T10:00:00.000Z" });

  const second = submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 2,
    secondChoiceSeatNo: "none",
    comment: "updated",
  }, { now: "2026-05-21T10:05:00.000Z" });

  const participant = db.eventParticipants.find((item) => item.id === first.eventParticipantId);

  assert.equal(first.version, 1);
  assert.equal(first.isLatest, false);
  assert.equal(second.version, 2);
  assert.equal(second.isLatest, true);
  assert.equal(participant.latestSubmissionId, second.id);
  assert.equal(participant.attendanceStatus, "present");
  assert.equal(db.surveySubmissions.length, 2);
});

test("submitSurvey rejects blank choice placeholders", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });

  assert.throws(() => submitSurvey(db, "demo", {
    name: "Kim",
    phone: "010-1111-2222",
    nickname: "alpha",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: "",
    secondChoiceSeatNo: "none",
    comment: "",
  }), /choice_required/);
});

test("released result exposes contact only through matched-party contact view", () => {
  const db = createSeedData({ slug: "demo", maleCapacity: 2, femaleCapacity: 2 });

  submitSurvey(db, "demo", {
    name: "Male One",
    phone: "010-1111-1111",
    nickname: "m1",
    gender: "male",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:00:00.000Z" });

  submitSurvey(db, "demo", {
    name: "Female One",
    phone: "010-2222-2222",
    nickname: "f1",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:01:00.000Z" });

  submitSurvey(db, "demo", {
    name: "Female One",
    phone: "010-2222-2222",
    nickname: "f1",
    gender: "female",
    seatNo: 1,
    firstChoiceSeatNo: 1,
    secondChoiceSeatNo: "none",
    comment: "changed to match",
  }, { now: "2026-05-21T10:02:00.000Z" });

  submitSurvey(db, "demo", {
    name: "Male Two",
    phone: "010-3333-3333",
    nickname: "m2",
    gender: "male",
    seatNo: 2,
    firstChoiceSeatNo: "none",
    secondChoiceSeatNo: "none",
    comment: "",
  }, { now: "2026-05-21T10:03:00.000Z" });

  const run = calculateEvent(db, "demo", { now: "2026-05-21T10:10:00.000Z" });
  releaseCalculationRun(db, "demo", run.id, { now: "2026-05-21T10:11:00.000Z" });

  const result = getParticipantResult(db, "demo", {
    name: "Male One",
    phone: "01011111111",
  }, { now: "2026-05-21T14:00:00.000Z" });

  assert.equal(result.status, "released");
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].target.phone, undefined);
  assert.equal(result.matches[0].target.name, undefined);
  assert.equal(result.matches[0].target.nickname, undefined);

  const contact = viewContact(db, "demo", {
    name: "Male One",
    phone: "01011111111",
    matchResultId: result.matches[0].id,
    targetParticipantId: result.matches[0].target.participantId,
    ipAddress: "127.0.0.1",
    userAgent: "node-test",
  }, { now: "2026-05-21T14:00:00.000Z" });

  assert.equal(contact.target.phone, "01022222222");
  assert.equal(contact.target.name, undefined);
  assert.equal(contact.target.nickname, undefined);
  assert.equal(db.contactViewLogs.length, 1);

  assert.throws(() => viewContact(db, "demo", {
    name: "Male Two",
    phone: "01033333333",
    matchResultId: result.matches[0].id,
    targetParticipantId: result.matches[0].target.participantId,
  }, { now: "2026-05-21T14:00:00.000Z" }), /viewer_not_party/);
});

function releasedEvent(id, slug, releasedCalculationRunId) {
  return {
    id,
    title: slug,
    eventDate: "2026-05-01",
    publicSlug: slug,
    status: "released",
    releasedCalculationRunId,
  };
}

function releasedRun(id, eventId, includedMaleCount, createdAt) {
  return {
    id,
    eventId,
    runNo: 1,
    status: "released",
    createdAt,
    releasedAt: createdAt,
    warnings: [],
    calculationSummary: {
      includedMaleCount,
      includedFemaleCount: includedMaleCount,
      excludedAbsentCount: 0,
      flaggedBlacklistCount: 0,
    },
  };
}

function participant(id, eventId, gender, seatNo, memberId = null) {
  return {
    id,
    eventId,
    gender,
    seatNo,
    memberId,
    latestSubmissionId: null,
    attendanceStatus: "present",
    isActive: true,
  };
}

function rankedStats(runId, eventId, targetParticipantId, denominator) {
  const stats = [];
  for (let rank = 1; rank <= denominator; rank += 1) {
    const participantId = rank === 4 ? targetParticipantId : `${runId}-P${rank}`;
    stats.push({
      id: `VS-${runId}-${rank}`,
      eventId,
      calculationRunId: runId,
      participantId,
      gender: "male",
      seatNo: rank,
      name: rank === 4 ? "Target" : `Other ${rank}`,
      nickname: rank === 4 ? "target" : `other${rank}`,
      receivedFirstCount: 0,
      receivedSecondCount: 0,
      score: denominator - rank,
      genderRank: rank,
    });
  }
  return stats;
}
