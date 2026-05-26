import {
  calculateEvent,
  getParticipantResult,
  releaseCalculationRun,
  submitSurvey,
  updateMember,
  viewContact,
} from "./appLogic.js";
import { createSeedData } from "./seedData.js";

const DEMO_PEOPLE = [
  { gender: "male", seatNo: 1, name: "김도윤", phone: "010-1001-1001", nickname: "도윤" },
  { gender: "male", seatNo: 2, name: "이준호", phone: "010-1002-1002", nickname: "준" },
  { gender: "male", seatNo: 3, name: "박민재", phone: "010-1003-1003", nickname: "재이" },
  { gender: "male", seatNo: 4, name: "최현우", phone: "010-1004-1004", nickname: "현" },
  { gender: "male", seatNo: 5, name: "정우진", phone: "010-1005-1005", nickname: "우디" },
  { gender: "female", seatNo: 1, name: "김서연", phone: "010-2001-2001", nickname: "서연" },
  { gender: "female", seatNo: 2, name: "이지현", phone: "010-2002-2002", nickname: "지니" },
  { gender: "female", seatNo: 3, name: "박하은", phone: "010-2003-2003", nickname: "하니" },
  { gender: "female", seatNo: 4, name: "최유나", phone: "010-2004-2004", nickname: "유나" },
  { gender: "female", seatNo: 5, name: "정다은", phone: "010-2005-2005", nickname: "다다" },
];

const ROUND_CHOICES = [
  {
    at: "2026-03-14T11:50:00.000Z",
    choices: [
      ["male", 1, 1, 2],
      ["male", 2, 2, 3],
      ["male", 3, "none", "none"],
      ["male", 4, 4, 1],
      ["male", 5, 5, 3],
      ["female", 1, 1, 4],
      ["female", 2, 1, 2],
      ["female", 3, 5, 2],
      ["female", 4, 4, 1],
      ["female", 5, 5, "none"],
    ],
  },
  {
    at: "2026-04-11T12:05:00.000Z",
    choices: [
      ["male", 1, 2, 1],
      ["male", 2, 2, 4],
      ["male", 3, 3, 2],
      ["male", 4, 4, "none"],
      ["male", 5, 5, 1],
      ["female", 1, 5, 1],
      ["female", 2, 1, 3],
      ["female", 3, 3, "none"],
      ["female", 4, 2, 4],
      ["female", 5, 5, "none"],
    ],
  },
  {
    at: "2026-05-09T12:20:00.000Z",
    choices: [
      ["male", 1, 2, "none"],
      ["male", 2, 4, 2],
      ["male", 3, 3, 5],
      ["male", 4, 4, 1],
      ["male", 5, "none", "none"],
      ["female", 1, 4, "none"],
      ["female", 2, 1, 2],
      ["female", 3, 3, "none"],
      ["female", 4, 2, 4],
      ["female", 5, 3, "none"],
    ],
  },
];

export function createDemoData() {
  const db = createSeedData({
    slug: "demo",
    title: "부부, 호기심에서 결혼까지 (260509)",
    eventDate: "2026-05-09",
    maleCapacity: 5,
    femaleCapacity: 5,
  });

  ROUND_CHOICES.forEach((round, roundIndex) => {
    db.events[0].status = "voting";
    for (const [gender, seatNo, firstChoiceSeatNo, secondChoiceSeatNo] of round.choices) {
      const person = DEMO_PEOPLE.find((item) => item.gender === gender && item.seatNo === seatNo);
      submitSurvey(db, "demo", {
        ...person,
        firstChoiceSeatNo,
        secondChoiceSeatNo,
        reviewNote: roundIndex === 0 && seatNo === 1 ? "후기 작성 예정" : "",
        comment: demoComment(gender, seatNo, roundIndex),
      }, {
        now: addMinutes(round.at, seatNo),
      });
    }

    if (roundIndex === ROUND_CHOICES.length - 1) {
      markDemoMemberStatuses(db);
    }

    const run = calculateEvent(db, "demo", {
      now: addMinutes(round.at, 20),
    });
    releaseCalculationRun(db, "demo", run.id, {
      now: addMinutes(round.at, 22),
    });
    seedContactViewsForRun(db, run.id, roundIndex, round.at);
  });

  return db;
}

function seedContactViewsForRun(db, runId, roundIndex, baseTime) {
  const matches = db.matchResults
    .filter((match) => match.calculationRunId === runId)
    .slice(0, 3);

  matches.forEach((match, index) => {
    const viewer = participantSubmission(db, index % 2 === 0 ? match.maleParticipantId : match.femaleParticipantId);
    const targetParticipantId = viewer.eventParticipantId === match.maleParticipantId
      ? match.femaleParticipantId
      : match.maleParticipantId;

    viewContact(db, "demo", {
      name: viewer.name,
      phone: viewer.phone,
      matchResultId: match.id,
      targetParticipantId,
      ipAddress: `127.0.0.${roundIndex + 1}`,
      userAgent: "demo-seed",
    }, {
      now: addMinutes(baseTime, 30 + index),
    });

    db.contactViewLogs.at(-1).viewedAt = addMinutes(baseTime, 30 + index);
  });
}

function markDemoMemberStatuses(db) {
  const byPhone = Object.fromEntries(db.members.map((member) => [member.phone, member]));
  updateMember(db, byPhone["01010021002"].id, {
    status: "normal",
    mbti: "ENTJ",
    job: "스타트업 기획",
    height: "181",
    strengths: "대화 리드가 좋음",
    desiredPartner: "밝고 대화가 잘 통하는 사람",
    memo: "득표가 꾸준히 높은 편",
  });
  updateMember(db, byPhone["01010031003"].id, {
    status: "normal",
    mbti: "ISFP",
    job: "디자이너",
    height: "176",
    strengths: "차분함",
    desiredPartner: "편안한 사람",
    memo: "재참여 의사 낮음",
  });
  updateMember(db, byPhone["01010051005"].id, {
    status: "poor_quality",
    mbti: "ESTP",
    job: "영업",
    height: "179",
    strengths: "에너지 있음",
    desiredPartner: "활동적인 사람",
    memo: "분위기 기여도 낮아 재초대 보류",
  });
  updateMember(db, byPhone["01020042004"].id, {
    status: "blacklist",
    mbti: "INFJ",
    job: "연구원",
    height: "164",
    strengths: "경청",
    desiredPartner: "진중한 사람",
    memo: "운영자 확인 필요",
  });
  updateMember(db, byPhone["01020052005"].id, {
    status: "blacklist",
    mbti: "ENFP",
    job: "마케터",
    height: "167",
    strengths: "활발함",
    desiredPartner: "유머 있는 사람",
    memo: "블랙리스트(퀄리티 X, 모임 참여 도중 이탈 등)",
  });
}

function participantSubmission(db, participantId) {
  const participant = db.eventParticipants.find((item) => item.id === participantId);
  return db.surveySubmissions.find((submission) => submission.id === participant.latestSubmissionId);
}

function demoComment(gender, seatNo, roundIndex) {
  if (roundIndex === 0 && gender === "male" && seatNo === 3) return "오늘은 없음으로 제출합니다.";
  if (roundIndex === 1 && gender === "female" && seatNo === 4) return "수정 제출합니다.";
  if (roundIndex === 2 && gender === "male" && seatNo === 5) return "선택 안 한 것으로 봐주세요.";
  return "";
}

function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
