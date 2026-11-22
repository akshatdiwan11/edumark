/** Shared attendance maths, kept in one place so every screen agrees. */

export interface SessionLike {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface EnrollmentLike {
  studentId: string;
  joinedAt: Date;
}

/** A student is expected at a session if they had joined the course before it ended. */
export function expectedAt(session: SessionLike, enrollment: EnrollmentLike) {
  const cutoff = session.endedAt ?? new Date();
  return enrollment.joinedAt <= cutoff;
}

export function rate(present: number, expected: number) {
  return expected === 0 ? null : Math.round((present / expected) * 1000) / 10;
}
