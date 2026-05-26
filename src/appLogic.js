import { validateChoicePair } from "./domain/choices.js";
import { canViewContact } from "./domain/contactAccess.js";
import { buildMatchResults } from "./domain/matching.js";
import { calculateVoteStats } from "./domain/ranking.js";

export class AppError extends Error {
  constructor(reason, statusCode = 400) {
    super(reason);
    this.name = "AppError";
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export function submitSurvey(db, slug, payload, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  if (!["voting", "ready"].includes(event.status)) {
    throw new AppError("event_not_accepting_votes", 409);
  }

  const gender = normalizeGender(payload.gender);
  const seatNo = parseSeatNo(payload.seatNo);
  const participant = findParticipantBySeat(db, event.id, gender, seatNo);
  if (!participant || !participant.isActive) throw new AppError("participant_slot_not_active", 400);

  const firstChoiceId = choiceSeatToParticipantId(db, event, gender, payload.firstChoiceSeatNo);
  const secondChoiceId = choiceSeatToParticipantId(db, event, gender, payload.secondChoiceSeatNo);
  const validation = validateChoicePair(firstChoiceId, secondChoiceId);
  if (!validation.ok) throw new AppError(validation.reason, 400);

  const phone = normalizePhone(payload.phone);
  const name = requiredText(payload.name, "name_required");
  const nickname = requiredText(payload.nickname, "nickname_required");
  if (!phone) throw new AppError("phone_required", 400);

  const member = upsertMember(db, {
    name,
    phone,
    nickname,
    gender,
    now,
  });

  const previousSubmissions = db.surveySubmissions.filter(
    (submission) => submission.eventParticipantId === participant.id,
  );
  const version = previousSubmissions.length + 1;
  for (const submission of previousSubmissions) {
    submission.isLatest = false;
  }

  const submission = {
    id: `SUB-${event.id}-${participant.gender}-${participant.seatNo}-v${version}`,
    eventId: event.id,
    eventParticipantId: participant.id,
    memberId: member.id,
    version,
    submittedAt: now,
    name,
    phone,
    phoneLast4: phone.slice(-4),
    nickname,
    gender,
    seatNo,
    firstChoiceId,
    secondChoiceId,
    reviewNote: String(payload.reviewNote ?? "").trim(),
    comment: String(payload.comment ?? "").trim(),
    isLatest: true,
    createdAt: now,
  };

  db.surveySubmissions.push(submission);
  participant.memberId = member.id;
  participant.latestSubmissionId = submission.id;
  if (!participant.attendanceStatus || participant.attendanceStatus === "empty") {
    participant.attendanceStatus = "present";
  }
  participant.updatedAt = now;
  event.updatedAt = now;

  return submission;
}

export function calculateEvent(db, slug, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  const activeParticipants = db.eventParticipants
    .filter((participant) => participant.eventId === event.id && participant.isActive)
    .sort(compareParticipantSeat);
  const activeParticipantIds = new Set(activeParticipants.map((participant) => participant.id));
  const latestSubmissions = db.surveySubmissions
    .filter((submission) => (
      submission.eventId === event.id &&
      submission.isLatest &&
      activeParticipantIds.has(submission.eventParticipantId)
    ));
  const submittedParticipantIds = new Set(latestSubmissions.map((submission) => submission.eventParticipantId));
  const calculationParticipants = activeParticipants
    .filter((participant) => submittedParticipantIds.has(participant.id));
  const calculationSubmissions = latestSubmissions.map((submission) => ({
    ...submission,
    participantId: submission.eventParticipantId,
  }));
  const participantGenders = Object.fromEntries(
    calculationParticipants.map((participant) => [participant.id, participant.gender]),
  );

  const runNo = db.calculationRuns.filter((run) => run.eventId === event.id).length + 1;
  const run = {
    id: `RUN-${event.id}-${runNo}`,
    eventId: event.id,
    runNo,
    status: "draft",
    createdAt: now,
    releasedAt: null,
    warnings: buildCalculationWarnings(db, event, activeParticipants),
    calculationSummary: buildCalculationSummary(event, activeParticipants, calculationParticipants, db),
  };
  db.calculationRuns.push(run);

  const matches = buildMatchResults(calculationSubmissions, participantGenders);
  matches.forEach((match, index) => {
    db.matchResults.push({
      id: `MR-${run.id}-${index + 1}`,
      eventId: event.id,
      calculationRunId: run.id,
      status: "draft",
      maleParticipantId: match.maleParticipantId,
      femaleParticipantId: match.femaleParticipantId,
      maleChoiceRank: match.maleChoiceRank,
      femaleChoiceRank: match.femaleChoiceRank,
      matchCode: match.matchCode,
      createdAt: now,
    });
  });

  const stats = calculateVoteStats(
    calculationParticipants.map((participant) => ({
      id: participant.id,
      gender: participant.gender,
    })),
    calculationSubmissions,
  );
  stats.forEach((stat) => {
    const participant = calculationParticipants.find((item) => item.id === stat.participantId);
    const latestSubmission = participant?.latestSubmissionId
      ? db.surveySubmissions.find((submission) => submission.id === participant.latestSubmissionId)
      : null;
    db.voteStats.push({
      id: `VS-${run.id}-${stat.participantId}`,
      eventId: event.id,
      calculationRunId: run.id,
      participantId: stat.participantId,
      gender: stat.gender,
      seatNo: participant?.seatNo ?? null,
      name: latestSubmission?.name ?? "",
      nickname: latestSubmission?.nickname ?? "",
      receivedFirstCount: stat.receivedFirstCount,
      receivedSecondCount: stat.receivedSecondCount,
      score: stat.score,
      genderRank: stat.genderRank,
      createdAt: now,
    });
  });

  event.voteClosedAt = event.voteClosedAt ?? now;
  event.status = event.status === "released" ? "released" : "closed";
  event.updatedAt = now;

  return {
    ...run,
    matches: db.matchResults.filter((match) => match.calculationRunId === run.id),
    voteStats: db.voteStats.filter((stat) => stat.calculationRunId === run.id),
  };
}

export function releaseCalculationRun(db, slug, runId, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  const run = db.calculationRuns.find((item) => item.eventId === event.id && item.id === runId);
  if (!run) throw new AppError("calculation_run_not_found", 404);
  if (run.status !== "draft") throw new AppError("calculation_run_not_draft", 409);

  const latestRun = findLatestRun(db, event.id);
  if (latestRun?.id !== run.id) throw new AppError("calculation_run_not_latest", 409);

  run.status = "released";
  run.releasedAt = now;
  for (const match of db.matchResults.filter((item) => item.calculationRunId === run.id)) {
    match.status = "released";
  }
  event.status = "released";
  event.releasedCalculationRunId = run.id;
  event.resultReleasedAt = now;
  event.updatedAt = now;
  return run;
}

export function getParticipantResult(db, slug, auth, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  if (event.status !== "released" || !event.releasedCalculationRunId) {
    return { status: "pending", event: publicEvent(event) };
  }
  if (resultExpired(event, now)) {
    return { status: "expired", event: publicEvent(event) };
  }

  const viewer = authenticateParticipant(db, event.id, auth);
  const matches = db.matchResults
    .filter((match) => (
      match.calculationRunId === event.releasedCalculationRunId &&
      match.status === "released" &&
      (match.maleParticipantId === viewer.id || match.femaleParticipantId === viewer.id)
    ))
    .map((match) => {
      const targetParticipantId = match.maleParticipantId === viewer.id
        ? match.femaleParticipantId
        : match.maleParticipantId;
      return {
        id: match.id,
        target: publicParticipantProfile(db, targetParticipantId),
      };
    });

  return {
    status: "released",
    event: publicEvent(event),
    viewer: publicParticipantProfile(db, viewer.id),
    matches,
  };
}

export function viewContact(db, slug, {
  name,
  phone,
  matchResultId,
  targetParticipantId,
  ipAddress = "",
  userAgent = "",
}, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  if (resultExpired(event, now)) throw new AppError("result_expired", 403);

  const viewer = authenticateParticipant(db, event.id, { name, phone });
  const match = db.matchResults.find(
    (item) => item.id === matchResultId && item.eventId === event.id,
  );
  if (!match) throw new AppError("match_not_found", 404);

  const access = canViewContact({
    eventStatus: event.status,
    eventReleasedCalculationRunId: event.releasedCalculationRunId,
    matchCalculationRunId: match.calculationRunId,
    matchStatus: match.status,
    viewerParticipantId: viewer.id,
    targetParticipantId,
    maleParticipantId: match.maleParticipantId,
    femaleParticipantId: match.femaleParticipantId,
  });
  if (!access.ok) throw new AppError(access.reason, 403);

  db.contactViewLogs.push({
    id: `CVL-${db.contactViewLogs.length + 1}`,
    eventId: event.id,
    matchResultId: match.id,
    viewerParticipantId: viewer.id,
    targetParticipantId,
    viewedAt: now,
    ipAddress,
    userAgent,
  });

  const target = privateParticipantProfile(db, targetParticipantId);
  return { target };
}

export function getAdminDashboard(db, slug) {
  const event = findEventBySlug(db, slug);
  const participants = db.eventParticipants
    .filter((participant) => participant.eventId === event.id && participant.isActive)
    .sort(compareParticipantSeat)
    .map((participant) => ({
      ...participant,
      latestSubmission: participant.latestSubmissionId
        ? db.surveySubmissions.find((submission) => submission.id === participant.latestSubmissionId)
        : null,
      submissionVersions: db.surveySubmissions
        .filter((submission) => submission.eventParticipantId === participant.id)
        .sort((a, b) => a.version - b.version),
    }));
  const latestRun = findLatestRun(db, event.id);
  return {
    event,
    participants,
    submissions: db.surveySubmissions.filter((submission) => submission.eventId === event.id),
    calculationRuns: db.calculationRuns.filter((run) => run.eventId === event.id),
    latestRun,
    matchResults: db.matchResults.filter((match) => match.eventId === event.id),
    voteStats: db.voteStats.filter((stat) => stat.eventId === event.id),
    contactViewLogs: db.contactViewLogs.filter((log) => log.eventId === event.id),
    members: db.members,
    memberSummaries: db.members.map((member) => buildMemberSummary(db, event, member)),
  };
}

export function getPublicEvent(db, slug) {
  const event = findEventBySlug(db, slug);
  return {
    ...publicEvent(event),
    maleCapacity: event.maleCapacity,
    femaleCapacity: event.femaleCapacity,
    voteOpensAt: event.voteOpensAt,
    voteClosesAt: event.voteClosesAt,
    resultReleasedAt: event.resultReleasedAt,
  };
}

export function createEvent(db, payload, { now = new Date().toISOString() } = {}) {
  const fallbackEventDate = koreaDateOnly(now);
  const eventDate = String(payload.eventDate ?? fallbackEventDate).trim() || fallbackEventDate;
  const maleCapacity = parseSeatNo(payload.maleCapacity ?? 5);
  const femaleCapacity = parseSeatNo(payload.femaleCapacity ?? 5);
  const slug = nextEventSlug(db, eventDate);
  const event = {
    id: `EVT-${slug}`,
    title: String(payload.title ?? defaultEventTitleForDate(eventDate)).trim() || defaultEventTitleForDate(eventDate),
    eventDate,
    location: "",
    maleCapacity,
    femaleCapacity,
    voteOpensAt: null,
    voteClosesAt: null,
    voteClosedAt: null,
    resultReleasedAt: null,
    releasedCalculationRunId: null,
    status: "voting",
    publicSlug: slug,
    createdAt: now,
    updatedAt: now,
  };

  db.events.push(event);
  db.eventParticipants.push(...createParticipantsForEvent(event, "male", maleCapacity, now));
  db.eventParticipants.push(...createParticipantsForEvent(event, "female", femaleCapacity, now));
  return event;
}

export function updateEventSettings(db, slug, payload, { now = new Date().toISOString() } = {}) {
  const event = findEventBySlug(db, slug);
  const hasSubmissions = db.surveySubmissions.some((submission) => submission.eventId === event.id);
  const nextMaleCapacity = payload.maleCapacity === undefined
    ? event.maleCapacity
    : parseSeatNo(payload.maleCapacity);
  const nextFemaleCapacity = payload.femaleCapacity === undefined
    ? event.femaleCapacity
    : parseSeatNo(payload.femaleCapacity);

  if (hasSubmissions && (
    nextMaleCapacity !== event.maleCapacity ||
    nextFemaleCapacity !== event.femaleCapacity
  )) {
    throw new AppError("capacity_change_after_submission_blocked", 409);
  }

  event.title = String(payload.title ?? event.title).trim() || event.title;
  event.eventDate = String(payload.eventDate ?? event.eventDate).trim() || event.eventDate;
  event.maleCapacity = nextMaleCapacity;
  event.femaleCapacity = nextFemaleCapacity;
  event.updatedAt = now;

  if (!hasSubmissions) {
    db.eventParticipants = db.eventParticipants.filter((participant) => participant.eventId !== event.id);
    db.eventParticipants.push(...createParticipantsForEvent(event, "male", nextMaleCapacity, now));
    db.eventParticipants.push(...createParticipantsForEvent(event, "female", nextFemaleCapacity, now));
  }

  return event;
}

export function updateMember(db, memberId, payload, { now = new Date().toISOString() } = {}) {
  const member = db.members.find((item) => item.id === memberId);
  if (!member) throw new AppError("member_not_found", 404);
  normalizeMemberIdentityShape(member);

  if (payload.status !== undefined) member.status = normalizeMemberStatus(payload.status);
  if (payload.memo !== undefined) member.memo = String(payload.memo);
  if (payload.nickname !== undefined) {
    const nickname = String(payload.nickname).trim();
    member.nickname = nickname;
    member.canonicalNickname = nickname;
    addAlias(member.nicknameAliases, nickname);
  }
  if (payload.birthYear !== undefined) member.birthYear = String(payload.birthYear).trim();
  if (payload.job !== undefined) member.job = String(payload.job).trim();
  if (payload.height !== undefined) member.height = String(payload.height).trim();
  if (payload.strengths !== undefined) member.strengths = String(payload.strengths).trim();
  if (payload.mbti !== undefined) member.mbti = String(payload.mbti).trim().toUpperCase();
  if (payload.desiredPartner !== undefined) member.desiredPartner = String(payload.desiredPartner).trim();
  member.updatedAt = now;
  return member;
}

function findEventBySlug(db, slug) {
  const event = db.events.find((item) => item.publicSlug === slug);
  if (!event) throw new AppError("event_not_found", 404);
  return event;
}

function findParticipantBySeat(db, eventId, gender, seatNo) {
  return db.eventParticipants.find((participant) => (
    participant.eventId === eventId &&
    participant.gender === gender &&
    participant.seatNo === seatNo
  ));
}

function choiceSeatToParticipantId(db, event, sourceGender, seatValue) {
  if (seatValue === undefined || seatValue === null || seatValue === "") {
    throw new AppError("choice_required", 400);
  }

  if (seatValue === "none") {
    return "none";
  }
  const targetGender = sourceGender === "male" ? "female" : "male";
  const seatNo = parseSeatNo(seatValue);
  const target = findParticipantBySeat(db, event.id, targetGender, seatNo);
  if (!target || !target.isActive) throw new AppError("choice_target_not_active", 400);
  return target.id;
}

function upsertMember(db, { name, phone, nickname, gender, now }) {
  let member = db.members.find((item) => item.phone === phone);
  if (!member) {
    member = {
      id: `MEM-${db.members.length + 1}`,
      name,
      phone,
      phoneLast4: phone.slice(-4),
      nickname,
      canonicalName: name,
      canonicalNickname: nickname,
      latestName: name,
      latestNickname: nickname,
      nameAliases: [name],
      nicknameAliases: [nickname],
      gender,
      birthYear: "",
      job: "",
      height: "",
      strengths: "",
      mbti: "",
      desiredPartner: "",
      status: "normal",
      memo: "",
      firstJoinedAt: now,
      lastJoinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.members.push(member);
    return member;
  }

  normalizeMemberIdentityShape(member);
  addAlias(member.nameAliases, name);
  addAlias(member.nicknameAliases, nickname);
  member.latestName = name;
  member.latestNickname = nickname;
  member.gender = gender;
  member.lastJoinedAt = now;
  member.updatedAt = now;
  return member;
}

function authenticateParticipant(db, eventId, { name, phone }) {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) throw new AppError("phone_required", 400);

  const candidateSubmissions = db.surveySubmissions
    .filter((submission) => submission.eventId === eventId && submission.isLatest);

  const submissions = candidateSubmissions
    .filter((submission) => normalizedPhone.length === 4
      ? submission.phoneLast4 === normalizedPhone && submissionMatchesName(db, submission, normalizedName)
      : submission.phone === normalizedPhone)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  if (submissions.length === 0) throw new AppError("participant_auth_failed", 401);
  if (
    normalizedPhone.length === 4 &&
    new Set(submissions.map((submission) => submission.eventParticipantId)).size > 1
  ) {
    throw new AppError("participant_auth_ambiguous", 409);
  }

  const participant = db.eventParticipants.find(
    (item) => item.id === submissions[0].eventParticipantId,
  );
  if (!participant) throw new AppError("participant_not_found", 404);
  return participant;
}

function publicParticipantProfile(db, participantId) {
  const participant = db.eventParticipants.find((item) => item.id === participantId);
  const submission = participant?.latestSubmissionId
    ? db.surveySubmissions.find((item) => item.id === participant.latestSubmissionId)
    : null;
  return {
    participantId,
    gender: participant?.gender ?? "",
    seatNo: participant?.seatNo ?? null,
    name: submission?.name ?? "",
    nickname: submission?.nickname ?? "",
  };
}

function privateParticipantProfile(db, participantId) {
  const profile = publicParticipantProfile(db, participantId);
  const participant = db.eventParticipants.find((item) => item.id === participantId);
  const submission = participant?.latestSubmissionId
    ? db.surveySubmissions.find((item) => item.id === participant.latestSubmissionId)
    : null;
  return {
    ...profile,
    phone: submission?.phone ?? "",
  };
}

function publicEvent(event) {
  return {
    title: event.title,
    displayTitle: displayEventTitle(event.title),
    eventDate: event.eventDate,
    status: event.status,
    publicSlug: event.publicSlug,
  };
}

function displayEventTitle(title) {
  return String(title ?? "").replace(/\s*\(\d{6}\)\s*$/, "").trim();
}

function findLatestRun(db, eventId) {
  return db.calculationRuns
    .filter((run) => run.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function buildCalculationWarnings(db, event, activeParticipants) {
  const warnings = [];
  for (const participant of activeParticipants) {
    const label = `${genderText(participant.gender)} ${participant.seatNo}`;
    const submissions = db.surveySubmissions.filter(
      (submission) => submission.eventParticipantId === participant.id,
    );
    if (submissions.length === 0) {
      warnings.push(`${label} 응답이 없습니다. 계산 기준에서 제외됩니다.`);
    }
    if (submissions.length > 1) {
      warnings.push(`${label} 응답이 ${submissions.length}회 제출되었습니다. 최신 응답을 사용합니다.`);
    }
  }
  return warnings;
}

function buildCalculationSummary(event, activeParticipants, calculationParticipants, db) {
  const summary = {
    configuredMaleCount: event.maleCapacity,
    configuredFemaleCount: event.femaleCapacity,
    submittedMaleCount: 0,
    submittedFemaleCount: 0,
    includedMaleCount: 0,
    includedFemaleCount: 0,
    excludedAbsentCount: 0,
    flaggedBlacklistCount: 0,
    unsubmittedCount: activeParticipants.length - calculationParticipants.length,
  };

  for (const participant of calculationParticipants) {
    if (participant.gender === "male") {
      summary.submittedMaleCount += 1;
      summary.includedMaleCount += 1;
    }
    if (participant.gender === "female") {
      summary.submittedFemaleCount += 1;
      summary.includedFemaleCount += 1;
    }

    const member = db.members.find((item) => item.id === participant.memberId);
    if (member?.status === "blacklist") summary.flaggedBlacklistCount += 1;
  }

  return summary;
}

function buildMemberSummary(db, event, member) {
  normalizeMemberIdentityShape(member);
  const participantIds = db.eventParticipants
    .filter((participant) => participant.memberId === member.id)
    .map((participant) => participant.id);
  const participantIdSet = new Set(participantIds);
  const releasedRunIds = new Set(
    db.events
      .map((item) => item.releasedCalculationRunId)
      .filter(Boolean),
  );
  const stats = db.voteStats
    .filter((stat) => participantIdSet.has(stat.participantId) && releasedRunIds.has(stat.calculationRunId))
    .sort((a, b) => runNo(db, a.calculationRunId) - runNo(db, b.calculationRunId));
  const matches = db.matchResults.filter((match) => (
    releasedRunIds.has(match.calculationRunId) &&
    match.status === "released" &&
    (
      participantIdSet.has(match.maleParticipantId) ||
      participantIdSet.has(match.femaleParticipantId)
    )
  ));
  const history = stats.map((stat) => {
    const run = db.calculationRuns.find((item) => item.id === stat.calculationRunId);
    const statEvent = db.events.find((item) => item.id === stat.eventId) ?? event;
    const participant = db.eventParticipants.find((item) => item.id === stat.participantId);
    const submission = latestSubmissionForParticipant(db, stat.participantId);
    const runMatches = matches.filter((match) => match.calculationRunId === stat.calculationRunId);
    const rankDenominator = rankDenominatorForRun(db, stat);
    const popularityRate = popularityRateForStat(db, stat);
    const matchRate = matchRateForStat(db, stat, run, runMatches.length);
    return {
      eventId: statEvent.id,
      eventDate: dateOnly(run?.createdAt ?? statEvent.eventDate),
      eventTitle: statEvent.title,
      calculationRunId: stat.calculationRunId,
      runNo: run?.runNo ?? null,
      participantId: stat.participantId,
      participantLabel: participant ? `${genderText(participant.gender)} ${participant.seatNo}` : "",
      submittedName: submission?.name ?? stat.name ?? "",
      submittedNickname: submission?.nickname ?? stat.nickname ?? "",
      genderRank: stat.genderRank,
      rankDenominator,
      score: stat.score,
      popularityRate,
      matchRate,
      receivedFirstCount: stat.receivedFirstCount,
      receivedSecondCount: stat.receivedSecondCount,
      matchCount: runMatches.length,
    };
  });
  const rankedStats = stats.filter((stat) => stat.genderRank !== null);
  const bestRankStat = rankedStats
    .map((stat) => ({ ...stat, rankDenominator: rankDenominatorForRun(db, stat) }))
    .sort(compareBestRankStats)[0] ?? null;
  const scoreSum = stats.reduce((sum, stat) => sum + stat.score, 0);
  const popularityRateSum = history.reduce((sum, item) => sum + item.popularityRate, 0);
  const matchRateSum = history.reduce((sum, item) => sum + item.matchRate, 0);
  const confirmedParticipationCount = history.length;
  const averageMatchRate = confirmedParticipationCount
    ? Number((matchRateSum / confirmedParticipationCount).toFixed(1))
    : null;

  return {
    ...member,
    participationCount: confirmedParticipationCount,
    confirmedParticipationCount,
    totalMatchCount: matches.length,
    bestRank: bestRankStat?.genderRank ?? null,
    bestRankDenominator: bestRankStat?.rankDenominator ?? null,
    averageScore: stats.length
      ? Number((scoreSum / stats.length).toFixed(1))
      : null,
    averagePopularityRate: confirmedParticipationCount
      ? Number((popularityRateSum / confirmedParticipationCount).toFixed(1))
      : null,
    averageMatchRate,
    matchedEventRate: averageMatchRate,
    averageMatchesPerEvent: confirmedParticipationCount
      ? Number((matches.length / confirmedParticipationCount).toFixed(1))
      : null,
    history,
  };
}

function latestSubmissionForParticipant(db, participantId) {
  return [...(db.surveySubmissions ?? [])]
    .filter((submission) => submission.eventParticipantId === participantId)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null;
}

function compareBestRankStats(a, b) {
  const rankDiff = a.genderRank - b.genderRank;
  if (rankDiff !== 0) return rankDiff;
  return (b.rankDenominator ?? 0) - (a.rankDenominator ?? 0);
}

function normalizeMemberIdentityShape(member) {
  const canonicalName = String(member.canonicalName ?? member.name ?? "").trim();
  const canonicalNickname = String(member.canonicalNickname ?? member.nickname ?? "").trim();
  const latestName = String(member.latestName ?? member.name ?? canonicalName).trim();
  const latestNickname = String(member.latestNickname ?? member.nickname ?? canonicalNickname).trim();

  member.name = canonicalName;
  member.nickname = canonicalNickname;
  member.canonicalName = canonicalName;
  member.canonicalNickname = canonicalNickname;
  member.latestName = latestName;
  member.latestNickname = latestNickname;
  member.nameAliases = uniqueAliases([
    ...(Array.isArray(member.nameAliases) ? member.nameAliases : []),
    canonicalName,
    latestName,
  ]);
  member.nicknameAliases = uniqueAliases([
    ...(Array.isArray(member.nicknameAliases) ? member.nicknameAliases : []),
    canonicalNickname,
    latestNickname,
  ]);
}

function uniqueAliases(values) {
  const aliases = [];
  for (const value of values) {
    addAlias(aliases, value);
  }
  return aliases;
}

function addAlias(aliases, value) {
  const alias = String(value ?? "").trim();
  if (!alias) return;
  const normalizedAlias = normalizeName(alias);
  if (!aliases.some((existing) => normalizeName(existing) === normalizedAlias)) {
    aliases.push(alias);
  }
}

function submissionMatchesName(db, submission, normalizedName) {
  if (normalizeName(submission.name) === normalizedName) return true;
  const member = db.members.find((item) => item.id === submission.memberId);
  if (!member) return false;
  normalizeMemberIdentityShape(member);
  return [
    member.name,
    member.nickname,
    member.canonicalName,
    member.canonicalNickname,
    member.latestName,
    member.latestNickname,
    ...(member.nameAliases ?? []),
    ...(member.nicknameAliases ?? []),
  ].some((value) => normalizeName(value) === normalizedName);
}

function rankDenominatorForRun(db, stat) {
  return db.voteStats.filter((item) => (
    item.calculationRunId === stat.calculationRunId &&
    item.gender === stat.gender
  )).length;
}

function popularityRateForStat(db, stat) {
  if (stat.score <= 0 || stat.genderRank === null || stat.genderRank === undefined) return 0;
  const denominator = rankDenominatorForRun(db, stat);
  if (denominator <= 1) return 100;
  return Number((((denominator - stat.genderRank) / (denominator - 1)) * 100).toFixed(1));
}

function matchRateForStat(db, stat, run, matchCount) {
  const maxMatchSlots = maxMatchSlotsForStat(db, stat, run);
  if (maxMatchSlots <= 0) return 0;
  return Number(((matchCount / maxMatchSlots) * 100).toFixed(1));
}

function maxMatchSlotsForStat(db, stat, run) {
  const summary = run?.calculationSummary;
  const oppositeCount = stat.gender === "male"
    ? summary?.includedFemaleCount
    : summary?.includedMaleCount;
  const fallbackOppositeCount = db.voteStats.filter((item) => (
    item.calculationRunId === stat.calculationRunId &&
    item.gender !== stat.gender
  )).length;
  return Math.min(2, oppositeCount ?? fallbackOppositeCount);
}

function dateOnly(value) {
  return String(value ?? "").slice(0, 10);
}

function koreaDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateOnly(value);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function resultExpired(event, now) {
  if (!event.resultReleasedAt) return false;
  return koreaDateOnly(now) > event.eventDate;
}

function nextEventSlug(db, eventDate) {
  const baseSlug = `buboo-${compactEventDate(eventDate)}`;
  for (let index = 1; index < 10_000; index += 1) {
    const slug = `${baseSlug}-${index}`;
    const id = `EVT-${slug}`;
    if (!db.events.some((event) => event.publicSlug === slug || event.id === id)) {
      return slug;
    }
  }
  throw new AppError("event_slug_exhausted", 500);
}

function defaultEventTitleForDate(eventDate) {
  return `부부, 호기심에서 결혼까지 (${compactEventDate(eventDate)})`;
}

function compactEventDate(eventDate) {
  const date = dateOnly(eventDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError("invalid_event_date", 400);
  return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
}

function runNo(db, runId) {
  return db.calculationRuns.find((run) => run.id === runId)?.runNo ?? 0;
}

function normalizeGender(value) {
  if (value === "male" || value === "남자") return "male";
  if (value === "female" || value === "여자") return "female";
  throw new AppError("invalid_gender", 400);
}

function normalizeMemberStatus(value) {
  const status = String(value ?? "normal");
  if (status === "inactive") return "normal";
  if (status === "do_not_invite") return "blacklist";
  if (["normal", "poor_quality", "blacklist"].includes(status)) return status;
  throw new AppError("invalid_member_status", 400);
}

function normalizeName(value) {
  return requiredText(value, "name_required").toLowerCase().replace(/\s+/g, "");
}

function parseSeatNo(value) {
  const seatNo = Number.parseInt(String(value), 10);
  if (!Number.isInteger(seatNo) || seatNo < 1) throw new AppError("invalid_seat_no", 400);
  return seatNo;
}

function requiredText(value, reason) {
  const text = String(value ?? "").trim();
  if (!text) throw new AppError(reason, 400);
  return text;
}

export function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function compareParticipantSeat(a, b) {
  if (a.gender !== b.gender) return a.gender === "male" ? -1 : 1;
  return a.seatNo - b.seatNo;
}

function genderText(gender) {
  return gender === "male" ? "남자" : "여자";
}

function createParticipantsForEvent(event, gender, capacity, now) {
  const genderCode = gender === "male" ? "M" : "F";
  return Array.from({ length: capacity }, (_, index) => {
    const seatNo = index + 1;
    return {
      id: `EP-${event.id}-${genderCode}${seatNo}`,
      eventId: event.id,
      gender,
      seatNo,
      memberId: null,
      latestSubmissionId: null,
      attendanceStatus: "present",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  });
}
