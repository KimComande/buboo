import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import pg from "pg";
import { AppError } from "../appLogic.js";
import { loadLocalEnv } from "../config/env.js";
import { validateChoicePair } from "../domain/choices.js";
import { createSeedData } from "../seedData.js";
import * as schema from "./schema.js";
import { setupPostgresSchemaSql, tableNames } from "./schemaSql.js";

const { Pool } = pg;
const advisoryLockId = 260506;

let pool = null;

export function getDatabaseUrl() {
  loadLocalEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for postgres store");
  return databaseUrl;
}

export function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function closePostgresPool() {
  if (!pool) return;
  const currentPool = pool;
  pool = null;
  await currentPool.end();
}

export async function ensurePostgresSchema(clientOrPool = getPostgresPool()) {
  await clientOrPool.query(setupPostgresSchemaSql);
}

export async function getTableCounts() {
  const currentPool = getPostgresPool();
  await ensurePostgresSchema(currentPool);
  const counts = {};
  for (const tableName of tableNames) {
    const result = await currentPool.query(`select count(*)::int as count from ${tableName}`);
    counts[tableName] = result.rows[0].count;
  }
  return counts;
}

export async function readDb() {
  const currentPool = getPostgresPool();
  await ensurePostgresSchema(currentPool);
  const orm = drizzle(currentPool, { schema });
  return snapshotFromDb(orm);
}

export async function readPublicEvent(slug) {
  const currentPool = getPostgresPool();
  const orm = drizzle(currentPool, { schema });
  const [event] = await orm
    .select()
    .from(schema.events)
    .where(eq(schema.events.publicSlug, slug))
    .limit(1);

  if (!event) throw new AppError("event_not_found", 404);
  return publicEventPayload(event);
}

export async function submitSurvey(slug, payload, { now = new Date().toISOString() } = {}) {
  const currentPool = getPostgresPool();
  const client = await currentPool.connect();
  try {
    await client.query("begin");
    const orm = drizzle(client, { schema });
    await orm.execute(sql`select pg_advisory_xact_lock(${advisoryLockId})`);

    const [event] = await orm
      .select()
      .from(schema.events)
      .where(eq(schema.events.publicSlug, slug))
      .limit(1);
    if (!event) throw new AppError("event_not_found", 404);
    if (!["voting", "ready"].includes(event.status)) {
      throw new AppError("event_not_accepting_votes", 409);
    }

    const gender = normalizeGender(payload.gender);
    const seatNo = parseSeatNo(payload.seatNo);
    const participant = await findParticipantBySeat(orm, event.id, gender, seatNo);
    if (!participant || !participant.isActive) throw new AppError("participant_slot_not_active", 400);

    const firstChoiceId = await choiceSeatToParticipantId(orm, event, gender, payload.firstChoiceSeatNo);
    const secondChoiceId = await choiceSeatToParticipantId(orm, event, gender, payload.secondChoiceSeatNo);
    const validation = validateChoicePair(firstChoiceId, secondChoiceId);
    if (!validation.ok) throw new AppError(validation.reason, 400);

    const phone = normalizePhone(payload.phone);
    const name = requiredText(payload.name, "name_required");
    const nickname = requiredText(payload.nickname, "nickname_required");
    if (!phone) throw new AppError("phone_required", 400);

    const member = await upsertMember(orm, client, { name, phone, nickname, gender, now });
    const previousSubmissions = await orm
      .select()
      .from(schema.surveySubmissions)
      .where(eq(schema.surveySubmissions.eventParticipantId, participant.id));
    const version = previousSubmissions.length + 1;
    if (previousSubmissions.length) {
      await orm
        .update(schema.surveySubmissions)
        .set({ isLatest: false })
        .where(eq(schema.surveySubmissions.eventParticipantId, participant.id));
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

    await orm.insert(schema.surveySubmissions).values(submission);
    await orm
      .update(schema.eventParticipants)
      .set({
        memberId: member.id,
        latestSubmissionId: submission.id,
        attendanceStatus: !participant.attendanceStatus || participant.attendanceStatus === "empty"
          ? "present"
          : participant.attendanceStatus,
        updatedAt: now,
      })
      .where(eq(schema.eventParticipants.id, participant.id));

    await client.query("commit");
    return submission;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function writeDb(db) {
  const currentPool = getPostgresPool();
  await ensurePostgresSchema(currentPool);
  const client = await currentPool.connect();
  try {
    await client.query("begin");
    const orm = drizzle(client, { schema });
    await orm.execute(sql`select pg_advisory_xact_lock(${advisoryLockId})`);
    await writeSnapshot(orm, normalizeDbShape(db));
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function mutateDb(mutator) {
  const currentPool = getPostgresPool();
  await ensurePostgresSchema(currentPool);
  const client = await currentPool.connect();
  try {
    await client.query("begin");
    const orm = drizzle(client, { schema });
    await orm.execute(sql`select pg_advisory_xact_lock(${advisoryLockId})`);
    const db = await snapshotFromDb(orm);
    const result = await mutator(db);
    await writeSnapshot(orm, normalizeDbShape(db));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function keepAlive(now = new Date().toISOString()) {
  const currentPool = getPostgresPool();
  await ensurePostgresSchema(currentPool);
  await currentPool.query(
    `insert into system_heartbeats (id, checked_at, created_at, updated_at)
     values ($1, $2, $2, $2)
     on conflict (id)
     do update set checked_at = excluded.checked_at, updated_at = excluded.updated_at`,
    ["supabase-free-keepalive", now],
  );
  return { ok: true, checkedAt: now };
}

async function snapshotFromDb(orm) {
  const db = {
    members: await orm.select().from(schema.members),
    events: await orm.select().from(schema.events),
    eventParticipants: await orm.select().from(schema.eventParticipants),
    surveySubmissions: await orm.select().from(schema.surveySubmissions),
    calculationRuns: await orm.select().from(schema.calculationRuns),
    matchResults: await orm.select().from(schema.matchResults),
    voteStats: await orm.select().from(schema.voteStats),
    contactViewLogs: await orm.select().from(schema.contactViewLogs),
  };

  if (isEmptyDb(db)) return createSeedData();
  return normalizeDbShape(db);
}

async function writeSnapshot(orm, db) {
  await orm.delete(schema.contactViewLogs);
  await orm.delete(schema.voteStats);
  await orm.delete(schema.matchResults);
  await orm.delete(schema.calculationRuns);
  await orm.delete(schema.surveySubmissions);
  await orm.delete(schema.eventParticipants);
  await orm.delete(schema.members);
  await orm.delete(schema.events);

  await insertIfAny(orm, schema.events, db.events.map(eventRow));
  await insertIfAny(orm, schema.members, db.members.map(memberRow));
  await insertIfAny(orm, schema.eventParticipants, db.eventParticipants.map(participantRow));
  await insertIfAny(orm, schema.surveySubmissions, db.surveySubmissions.map(submissionRow));
  await insertIfAny(orm, schema.calculationRuns, db.calculationRuns.map(runRow));
  await insertIfAny(orm, schema.matchResults, db.matchResults.map(matchRow));
  await insertIfAny(orm, schema.voteStats, db.voteStats.map(voteStatRow));
  await insertIfAny(orm, schema.contactViewLogs, db.contactViewLogs.map(contactLogRow));
}

async function insertIfAny(orm, table, rows) {
  if (rows.length === 0) return;
  await orm.insert(table).values(rows);
}

function normalizeDbShape(db) {
  return {
    members: db.members ?? [],
    events: db.events ?? [],
    eventParticipants: db.eventParticipants ?? [],
    surveySubmissions: db.surveySubmissions ?? [],
    calculationRuns: db.calculationRuns ?? [],
    matchResults: db.matchResults ?? [],
    voteStats: db.voteStats ?? [],
    contactViewLogs: db.contactViewLogs ?? [],
  };
}

function isEmptyDb(db) {
  return Object.values(db).every((rows) => rows.length === 0);
}

async function findParticipantBySeat(orm, eventId, gender, seatNo) {
  const [participant] = await orm
    .select()
    .from(schema.eventParticipants)
    .where(and(
      eq(schema.eventParticipants.eventId, eventId),
      eq(schema.eventParticipants.gender, gender),
      eq(schema.eventParticipants.seatNo, seatNo),
    ))
    .limit(1);
  return participant ?? null;
}

async function choiceSeatToParticipantId(orm, event, sourceGender, seatValue) {
  if (seatValue === undefined || seatValue === null || seatValue === "") {
    throw new AppError("choice_required", 400);
  }
  if (seatValue === "none") return "none";

  const targetGender = sourceGender === "male" ? "female" : "male";
  const target = await findParticipantBySeat(orm, event.id, targetGender, parseSeatNo(seatValue));
  if (!target || !target.isActive) throw new AppError("choice_target_not_active", 400);
  return target.id;
}

async function upsertMember(orm, client, { name, phone, nickname, gender, now }) {
  const [existingMember] = await orm
    .select()
    .from(schema.members)
    .where(eq(schema.members.phone, phone))
    .limit(1);

  if (!existingMember) {
    const countResult = await client.query("select count(*)::int as count from members");
    const member = {
      id: `MEM-${countResult.rows[0].count + 1}`,
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
    await orm.insert(schema.members).values(member);
    return member;
  }

  const updates = {
    nameAliases: uniqueAliases([...(existingMember.nameAliases ?? []), name]),
    nicknameAliases: uniqueAliases([...(existingMember.nicknameAliases ?? []), nickname]),
    latestName: name,
    latestNickname: nickname,
    gender,
    lastJoinedAt: now,
    updatedAt: now,
  };
  await orm.update(schema.members).set(updates).where(eq(schema.members.id, existingMember.id));
  return { ...existingMember, ...updates };
}

function uniqueAliases(values) {
  const aliases = [];
  for (const value of values) {
    const alias = String(value ?? "").trim();
    if (!alias) continue;
    const normalized = normalizeName(alias);
    if (!aliases.some((existing) => normalizeName(existing) === normalized)) {
      aliases.push(alias);
    }
  }
  return aliases;
}

function normalizeGender(value) {
  if (value === "male" || value === "남자") return "male";
  if (value === "female" || value === "여자") return "female";
  throw new AppError("invalid_gender", 400);
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

function normalizeName(value) {
  return requiredText(value, "name_required").toLowerCase().replace(/\s+/g, "");
}

function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function publicEventPayload(event) {
  const dateLabel = String(event.eventDate ?? "").replace(/-/g, ".");
  return {
    title: event.title,
    displayTitle: dateLabel ? `${event.title} (${dateLabel})` : event.title,
    eventDate: event.eventDate,
    status: event.status,
    publicSlug: event.publicSlug,
    maleCapacity: event.maleCapacity,
    femaleCapacity: event.femaleCapacity,
    voteOpensAt: event.voteOpensAt,
    voteClosesAt: event.voteClosesAt,
    resultReleasedAt: event.resultReleasedAt,
  };
}

function eventRow(event) {
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    location: event.location ?? "",
    maleCapacity: event.maleCapacity,
    femaleCapacity: event.femaleCapacity,
    voteOpensAt: event.voteOpensAt ?? null,
    voteClosesAt: event.voteClosesAt ?? null,
    voteClosedAt: event.voteClosedAt ?? null,
    resultReleasedAt: event.resultReleasedAt ?? null,
    releasedCalculationRunId: event.releasedCalculationRunId ?? null,
    status: event.status,
    publicSlug: event.publicSlug,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function memberRow(member) {
  return {
    id: member.id,
    name: member.name ?? "",
    phone: member.phone ?? "",
    phoneLast4: member.phoneLast4 ?? "",
    nickname: member.nickname ?? "",
    canonicalName: member.canonicalName ?? member.name ?? "",
    canonicalNickname: member.canonicalNickname ?? member.nickname ?? "",
    latestName: member.latestName ?? member.name ?? "",
    latestNickname: member.latestNickname ?? member.nickname ?? "",
    nameAliases: member.nameAliases ?? [],
    nicknameAliases: member.nicknameAliases ?? [],
    gender: member.gender ?? "",
    birthYear: member.birthYear ?? "",
    job: member.job ?? "",
    height: member.height ?? "",
    strengths: member.strengths ?? "",
    mbti: member.mbti ?? "",
    desiredPartner: member.desiredPartner ?? "",
    status: member.status ?? "normal",
    memo: member.memo ?? "",
    firstJoinedAt: member.firstJoinedAt ?? null,
    lastJoinedAt: member.lastJoinedAt ?? null,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function participantRow(participant) {
  return {
    id: participant.id,
    eventId: participant.eventId,
    gender: participant.gender,
    seatNo: participant.seatNo,
    memberId: participant.memberId ?? null,
    latestSubmissionId: participant.latestSubmissionId ?? null,
    attendanceStatus: participant.attendanceStatus ?? "present",
    isActive: participant.isActive ?? true,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
}

function submissionRow(submission) {
  return {
    id: submission.id,
    eventId: submission.eventId,
    eventParticipantId: submission.eventParticipantId,
    memberId: submission.memberId,
    version: submission.version,
    submittedAt: submission.submittedAt,
    name: submission.name,
    phone: submission.phone,
    phoneLast4: submission.phoneLast4,
    nickname: submission.nickname,
    gender: submission.gender,
    seatNo: submission.seatNo,
    firstChoiceId: submission.firstChoiceId ?? null,
    secondChoiceId: submission.secondChoiceId ?? null,
    reviewNote: submission.reviewNote ?? "",
    comment: submission.comment ?? "",
    isLatest: submission.isLatest ?? true,
    createdAt: submission.createdAt,
  };
}

function runRow(run) {
  return {
    id: run.id,
    eventId: run.eventId,
    runNo: run.runNo,
    status: run.status,
    createdAt: run.createdAt,
    releasedAt: run.releasedAt ?? null,
    warnings: run.warnings ?? [],
    calculationSummary: run.calculationSummary ?? {},
  };
}

function matchRow(match) {
  return {
    id: match.id,
    eventId: match.eventId,
    calculationRunId: match.calculationRunId,
    status: match.status,
    maleParticipantId: match.maleParticipantId,
    femaleParticipantId: match.femaleParticipantId,
    maleChoiceRank: match.maleChoiceRank,
    femaleChoiceRank: match.femaleChoiceRank,
    matchCode: match.matchCode,
    createdAt: match.createdAt,
  };
}

function voteStatRow(stat) {
  return {
    id: stat.id,
    eventId: stat.eventId,
    calculationRunId: stat.calculationRunId,
    participantId: stat.participantId,
    gender: stat.gender,
    seatNo: stat.seatNo ?? null,
    name: stat.name ?? "",
    nickname: stat.nickname ?? "",
    receivedFirstCount: stat.receivedFirstCount ?? 0,
    receivedSecondCount: stat.receivedSecondCount ?? 0,
    score: stat.score ?? 0,
    genderRank: stat.genderRank ?? null,
    createdAt: stat.createdAt,
  };
}

function contactLogRow(log) {
  return {
    id: log.id,
    eventId: log.eventId,
    matchResultId: log.matchResultId,
    viewerParticipantId: log.viewerParticipantId,
    targetParticipantId: log.targetParticipantId,
    viewedAt: log.viewedAt,
    ipAddress: log.ipAddress ?? "",
    userAgent: log.userAgent ?? "",
  };
}
