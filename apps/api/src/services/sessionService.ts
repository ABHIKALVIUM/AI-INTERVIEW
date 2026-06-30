import { eq, desc, count } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { db } from '../db/index.js';
import { sessions, reports, transcripts, users, profiles } from '../db/schema.js';
import { env } from '../env.js';
import { AppError } from '../utils/AppError.js';
import type { Session } from '../db/schema.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type InterviewType = 'behavioral' | 'technical' | 'system_design' | 'hr';

export interface SessionWithScore extends Session {
  overall_score: number | null;
  transcript_count: number;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getUserSessions(
  userId: string,
): Promise<SessionWithScore[]> {
  const rows = await db
    .select({
      id: sessions.id,
      user_id: sessions.user_id,
      interview_type: sessions.interview_type,
      status: sessions.status,
      livekit_room_name: sessions.livekit_room_name,
      started_at: sessions.started_at,
      ended_at: sessions.ended_at,
      duration_seconds: sessions.duration_seconds,
      created_at: sessions.created_at,
      overall_score: reports.overall_score,
      transcript_count: count(transcripts.id),
    })
    .from(sessions)
    .leftJoin(reports, eq(reports.session_id, sessions.id))
    .leftJoin(transcripts, eq(transcripts.session_id, sessions.id))
    .where(eq(sessions.user_id, userId))
    .groupBy(sessions.id, reports.overall_score)
    .orderBy(desc(sessions.created_at));

  return rows.map(row => ({
    ...row,
    overall_score: row.overall_score ?? null,
    transcript_count: Number(row.transcript_count),
  }));
}

export async function getSessionById(
  id: string,
  userId: string,
): Promise<SessionWithScore> {
  const [row] = await db
    .select({
      id: sessions.id,
      user_id: sessions.user_id,
      interview_type: sessions.interview_type,
      status: sessions.status,
      livekit_room_name: sessions.livekit_room_name,
      started_at: sessions.started_at,
      ended_at: sessions.ended_at,
      duration_seconds: sessions.duration_seconds,
      created_at: sessions.created_at,
      overall_score: reports.overall_score,
    })
    .from(sessions)
    .leftJoin(reports, eq(reports.session_id, sessions.id))
    .where(eq(sessions.id, id));

  if (!row) {
    throw AppError.notFound('Session not found');
  }

  if (row.user_id !== userId) {
    throw AppError.forbidden('You do not have access to this session');
  }

  const [countRow] = await db
    .select({ value: count() })
    .from(transcripts)
    .where(eq(transcripts.session_id, id));

  return {
    ...row,
    overall_score: row.overall_score ?? null,
    transcript_count: Number(countRow?.value ?? 0),
  };
}

export interface CandidateProfile {
  name: string;
  jobRole: string;
  experienceLevel: 'junior' | 'mid' | 'senior';
}

export async function createSession(
  userId: string,
  interviewType: InterviewType,
  candidateProfile: CandidateProfile,
): Promise<Session> {
  const roomName = `interview-${randomUUID()}`;

  // ── Build the room metadata the agent needs ───────────────────────────────
  const roomMetadata = JSON.stringify({
    sessionId: '',          // filled in after DB insert below
    userId,
    interviewType,
    candidateProfile,
    targetQuestions: 5,
  });

  // ── Insert DB session first ───────────────────────────────────────────────
  const [session] = await db
    .insert(sessions)
    .values({
      user_id: userId,
      interview_type: interviewType,
      status: 'pending',
      livekit_room_name: roomName,
      started_at: new Date(),
    })
    .returning();

  if (!session) {
    throw AppError.internal('Failed to create session');
  }

  // ── Pre-create the LiveKit room with metadata so the agent can find it ───
  const roomService = new RoomServiceClient(
    env.LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );

  try {
    const metadata = JSON.stringify({
      sessionId: session.id,
      userId,
      interviewType,
      candidateProfile,
      targetQuestions: 5,
    });

    // createRoom creates the room on LiveKit with the metadata set
    await roomService.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 600,  // close after 10 min if empty
      maxParticipants: 5,
    });
  } catch (err) {
    // Non-fatal — room may already exist or LiveKit may auto-create it on join
    // The room metadata can also be set later via updateRoomMetadata
    console.warn('Could not pre-create LiveKit room, will try updateRoomMetadata on token generation:', err);

    // Try to update metadata on the room (works if room already exists)
    try {
      const metadata = JSON.stringify({
        sessionId: session.id,
        userId,
        interviewType,
        candidateProfile,
        targetQuestions: 5,
      });
      await roomService.updateRoomMetadata(roomName, metadata);
    } catch {
      // Truly non-fatal; the token generation step will set metadata
    }
  }

  // Suppress the unused-variable warning for the initial metadata draft
  void roomMetadata;

  return session;
}

export async function endSession(
  id: string,
  userId: string,
): Promise<Session> {
  // Ownership check
  const [existing] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));

  if (!existing) {
    throw AppError.notFound('Session not found');
  }

  if (existing.user_id !== userId) {
    throw AppError.forbidden('You do not have access to this session');
  }

  if (existing.status === 'completed') {
    throw AppError.badRequest('Session is already completed');
  }

  const endedAt = new Date();
  const startedAt = existing.started_at ?? endedAt;
  const durationSeconds = Math.floor(
    (endedAt.getTime() - startedAt.getTime()) / 1000,
  );

  const [updated] = await db
    .update(sessions)
    .set({
      status: 'completed',
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .where(eq(sessions.id, id))
    .returning();

  if (!updated) {
    throw AppError.internal('Failed to update session');
  }

  return updated;
}

export async function generateLiveKitToken(
  sessionId: string,
  userId: string,
): Promise<{ token: string; wsUrl: string }> {
  // Fetch session + user + profile in one query
  const [record] = await db
    .select({ session: sessions, user: users, profile: profiles })
    .from(sessions)
    .leftJoin(users, eq(sessions.user_id, users.id))
    .leftJoin(profiles, eq(sessions.user_id, profiles.user_id))
    .where(eq(sessions.id, sessionId));

  if (!record?.session) {
    throw AppError.notFound('Session not found');
  }

  const session = record.session;

  if (session.user_id !== userId) {
    throw AppError.forbidden('You do not have access to this session');
  }

  // ── Ensure LiveKit room has metadata (safety net) ─────────────────────────
  const roomService = new RoomServiceClient(
    env.LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );

  const candidateProfile = {
    name: record.user?.name ?? 'Candidate',
    jobRole: record.profile?.job_role ?? '',
    experienceLevel: (record.profile?.experience_level ?? 'junior') as 'junior' | 'mid' | 'senior',
  };

  const metadata = JSON.stringify({
    sessionId: session.id,
    userId,
    interviewType: session.interview_type,
    candidateProfile,
    targetQuestions: 5,
  });

  // Try to update room metadata (creates room if needed, or updates existing)
  try {
    await roomService.updateRoomMetadata(session.livekit_room_name, metadata);
  } catch {
    // If room doesn't exist yet, create it with metadata
    try {
      await roomService.createRoom({
        name: session.livekit_room_name,
        metadata,
        emptyTimeout: 600,
        maxParticipants: 5,
      });
    } catch {
      // Room will be created by LiveKit when user joins — metadata will be missing
      // but the polling agent will still pick it up eventually via webhook
    }
  }

  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: userId,
    name: record.user?.name ?? `participant-${userId.slice(0, 8)}`,
    ttl: '2h',
  });

  at.addGrant({
    roomJoin: true,
    room: session.livekit_room_name,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return { token, wsUrl: env.LIVEKIT_URL };
}

