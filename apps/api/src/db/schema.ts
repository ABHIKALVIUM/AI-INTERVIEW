import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel, sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const experienceLevelEnum = pgEnum('experience_level', ['junior', 'mid', 'senior']);
export const interviewTypeEnum = pgEnum('interview_type', ['behavioral', 'technical', 'system_design', 'hr']);
export const sessionStatusEnum = pgEnum('session_status', ['pending', 'active', 'completed', 'failed', 'abandoned']);
export const speakerEnum = pgEnum('speaker', ['ai', 'candidate']);

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// ─── profiles ─────────────────────────────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  job_role: text('job_role').default(''),
  experience_level: experienceLevelEnum('experience_level').default('junior'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;

// ─── sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  interview_type: interviewTypeEnum('interview_type').notNull(),
  status: sessionStatusEnum('status').notNull().default('pending'),
  livekit_room_name: text('livekit_room_name').notNull(),
  started_at: timestamp('started_at', { withTimezone: true }),
  ended_at: timestamp('ended_at', { withTimezone: true }),
  duration_seconds: integer('duration_seconds'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

// ─── transcripts ──────────────────────────────────────────────────────────────

export const transcripts = pgTable('transcripts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  speaker: speakerEnum('speaker').notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  sequence_number: integer('sequence_number').notNull(),
});

export type Transcript = InferSelectModel<typeof transcripts>;
export type NewTranscript = InferInsertModel<typeof transcripts>;

// ─── reports ──────────────────────────────────────────────────────────────────

export const reports = pgTable('reports', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' })
    .unique(),
  overall_score: real('overall_score'),
  communication_score: real('communication_score'),
  depth_score: real('depth_score'),
  structure_score: real('structure_score'),
  confidence_score: real('confidence_score'),
  strengths: jsonb('strengths').$type<string[]>(),
  improvements: jsonb('improvements').$type<string[]>(),
  detailed_feedback: text('detailed_feedback'),
  question_breakdown: jsonb('question_breakdown').$type<
    Array<{
      question: string;
      answer_summary: string;
      score: number;
      notes: string;
    }>
  >(),
  generated_at: timestamp('generated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Report = InferSelectModel<typeof reports>;
export type NewReport = InferInsertModel<typeof reports>;
