export const tableNames = [
  "events",
  "members",
  "event_participants",
  "survey_submissions",
  "calculation_runs",
  "match_results",
  "vote_stats",
  "contact_view_logs",
  "system_heartbeats",
];

export const setupPostgresSchemaSql = `
create table if not exists events (
  id text primary key,
  title text not null,
  event_date text not null,
  location text not null default '',
  male_capacity integer not null,
  female_capacity integer not null,
  vote_opens_at timestamptz,
  vote_closes_at timestamptz,
  vote_closed_at timestamptz,
  result_released_at timestamptz,
  released_calculation_run_id text,
  status text not null,
  public_slug text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists events_public_slug_idx on events (public_slug);

create table if not exists members (
  id text primary key,
  name text not null,
  phone text not null default '',
  phone_last4 text not null default '',
  nickname text not null default '',
  canonical_name text not null default '',
  canonical_nickname text not null default '',
  latest_name text not null default '',
  latest_nickname text not null default '',
  name_aliases jsonb not null default '[]'::jsonb,
  nickname_aliases jsonb not null default '[]'::jsonb,
  gender text not null default '',
  birth_year text not null default '',
  job text not null default '',
  height text not null default '',
  strengths text not null default '',
  mbti text not null default '',
  desired_partner text not null default '',
  status text not null default 'normal',
  memo text not null default '',
  first_joined_at timestamptz,
  last_joined_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists members_phone_idx on members (phone);
create index if not exists members_status_idx on members (status);

create table if not exists event_participants (
  id text primary key,
  event_id text not null,
  gender text not null,
  seat_no integer not null,
  member_id text,
  latest_submission_id text,
  attendance_status text not null default 'present',
  is_active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists event_participants_event_idx on event_participants (event_id);
create unique index if not exists event_participants_event_gender_seat_idx on event_participants (event_id, gender, seat_no);

create table if not exists survey_submissions (
  id text primary key,
  event_id text not null,
  event_participant_id text not null,
  member_id text not null,
  version integer not null,
  submitted_at timestamptz not null,
  name text not null,
  phone text not null,
  phone_last4 text not null,
  nickname text not null,
  gender text not null,
  seat_no integer not null,
  first_choice_id text,
  second_choice_id text,
  review_note text not null default '',
  comment text not null default '',
  is_latest boolean not null default true,
  created_at timestamptz not null
);

create index if not exists survey_submissions_event_idx on survey_submissions (event_id);
create index if not exists survey_submissions_participant_idx on survey_submissions (event_participant_id);
create index if not exists survey_submissions_member_idx on survey_submissions (member_id);

create table if not exists calculation_runs (
  id text primary key,
  event_id text not null,
  run_no integer not null,
  status text not null,
  created_at timestamptz not null,
  released_at timestamptz,
  warnings jsonb not null default '[]'::jsonb,
  calculation_summary jsonb not null default '{}'::jsonb
);

create index if not exists calculation_runs_event_idx on calculation_runs (event_id);

create table if not exists match_results (
  id text primary key,
  event_id text not null,
  calculation_run_id text not null,
  status text not null,
  male_participant_id text not null,
  female_participant_id text not null,
  male_choice_rank integer not null,
  female_choice_rank integer not null,
  match_code text not null,
  created_at timestamptz not null
);

create index if not exists match_results_event_idx on match_results (event_id);
create index if not exists match_results_run_idx on match_results (calculation_run_id);

create table if not exists vote_stats (
  id text primary key,
  event_id text not null,
  calculation_run_id text not null,
  participant_id text not null,
  gender text not null,
  seat_no integer,
  name text not null default '',
  nickname text not null default '',
  received_first_count integer not null default 0,
  received_second_count integer not null default 0,
  score integer not null default 0,
  gender_rank integer,
  created_at timestamptz not null
);

create index if not exists vote_stats_event_idx on vote_stats (event_id);
create index if not exists vote_stats_run_idx on vote_stats (calculation_run_id);
create index if not exists vote_stats_participant_idx on vote_stats (participant_id);

create table if not exists contact_view_logs (
  id text primary key,
  event_id text not null,
  match_result_id text not null,
  viewer_participant_id text not null,
  target_participant_id text not null,
  viewed_at timestamptz not null,
  ip_address text not null default '',
  user_agent text not null default ''
);

create index if not exists contact_view_logs_event_idx on contact_view_logs (event_id);
create index if not exists contact_view_logs_match_idx on contact_view_logs (match_result_id);

create table if not exists system_heartbeats (
  id text primary key,
  checked_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
`;
