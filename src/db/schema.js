import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const timestampOptions = { withTimezone: true, mode: "string" };

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  eventDate: text("event_date").notNull(),
  location: text("location").notNull().default(""),
  maleCapacity: integer("male_capacity").notNull(),
  femaleCapacity: integer("female_capacity").notNull(),
  voteOpensAt: timestamp("vote_opens_at", timestampOptions),
  voteClosesAt: timestamp("vote_closes_at", timestampOptions),
  voteClosedAt: timestamp("vote_closed_at", timestampOptions),
  resultReleasedAt: timestamp("result_released_at", timestampOptions),
  releasedCalculationRunId: text("released_calculation_run_id"),
  status: text("status").notNull(),
  publicSlug: text("public_slug").notNull(),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
  updatedAt: timestamp("updated_at", timestampOptions).notNull(),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  phoneLast4: text("phone_last4").notNull().default(""),
  nickname: text("nickname").notNull().default(""),
  canonicalName: text("canonical_name").notNull().default(""),
  canonicalNickname: text("canonical_nickname").notNull().default(""),
  latestName: text("latest_name").notNull().default(""),
  latestNickname: text("latest_nickname").notNull().default(""),
  nameAliases: jsonb("name_aliases").notNull().default([]),
  nicknameAliases: jsonb("nickname_aliases").notNull().default([]),
  gender: text("gender").notNull().default(""),
  birthYear: text("birth_year").notNull().default(""),
  job: text("job").notNull().default(""),
  height: text("height").notNull().default(""),
  strengths: text("strengths").notNull().default(""),
  mbti: text("mbti").notNull().default(""),
  desiredPartner: text("desired_partner").notNull().default(""),
  status: text("status").notNull().default("normal"),
  memo: text("memo").notNull().default(""),
  firstJoinedAt: timestamp("first_joined_at", timestampOptions),
  lastJoinedAt: timestamp("last_joined_at", timestampOptions),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
  updatedAt: timestamp("updated_at", timestampOptions).notNull(),
});

export const eventParticipants = pgTable("event_participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  gender: text("gender").notNull(),
  seatNo: integer("seat_no").notNull(),
  memberId: text("member_id"),
  latestSubmissionId: text("latest_submission_id"),
  attendanceStatus: text("attendance_status").notNull().default("present"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
  updatedAt: timestamp("updated_at", timestampOptions).notNull(),
});

export const surveySubmissions = pgTable("survey_submissions", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  eventParticipantId: text("event_participant_id").notNull(),
  memberId: text("member_id").notNull(),
  version: integer("version").notNull(),
  submittedAt: timestamp("submitted_at", timestampOptions).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  phoneLast4: text("phone_last4").notNull(),
  nickname: text("nickname").notNull(),
  gender: text("gender").notNull(),
  seatNo: integer("seat_no").notNull(),
  firstChoiceId: text("first_choice_id"),
  secondChoiceId: text("second_choice_id"),
  reviewNote: text("review_note").notNull().default(""),
  comment: text("comment").notNull().default(""),
  isLatest: boolean("is_latest").notNull().default(true),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
});

export const calculationRuns = pgTable("calculation_runs", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  runNo: integer("run_no").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
  releasedAt: timestamp("released_at", timestampOptions),
  warnings: jsonb("warnings").notNull().default([]),
  calculationSummary: jsonb("calculation_summary").notNull().default({}),
});

export const matchResults = pgTable("match_results", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  calculationRunId: text("calculation_run_id").notNull(),
  status: text("status").notNull(),
  maleParticipantId: text("male_participant_id").notNull(),
  femaleParticipantId: text("female_participant_id").notNull(),
  maleChoiceRank: integer("male_choice_rank").notNull(),
  femaleChoiceRank: integer("female_choice_rank").notNull(),
  matchCode: text("match_code").notNull(),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
});

export const voteStats = pgTable("vote_stats", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  calculationRunId: text("calculation_run_id").notNull(),
  participantId: text("participant_id").notNull(),
  gender: text("gender").notNull(),
  seatNo: integer("seat_no"),
  name: text("name").notNull().default(""),
  nickname: text("nickname").notNull().default(""),
  receivedFirstCount: integer("received_first_count").notNull().default(0),
  receivedSecondCount: integer("received_second_count").notNull().default(0),
  score: integer("score").notNull().default(0),
  genderRank: integer("gender_rank"),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
});

export const contactViewLogs = pgTable("contact_view_logs", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  matchResultId: text("match_result_id").notNull(),
  viewerParticipantId: text("viewer_participant_id").notNull(),
  targetParticipantId: text("target_participant_id").notNull(),
  viewedAt: timestamp("viewed_at", timestampOptions).notNull(),
  ipAddress: text("ip_address").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
});

export const systemHeartbeats = pgTable("system_heartbeats", {
  id: text("id").primaryKey(),
  checkedAt: timestamp("checked_at", timestampOptions).notNull(),
  createdAt: timestamp("created_at", timestampOptions).notNull(),
  updatedAt: timestamp("updated_at", timestampOptions).notNull(),
});
