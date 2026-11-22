import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { HttpError, badRequest, conflict, handle, notFound } from "../lib/errors.js";
import { checkToken, parseToken } from "../lib/qr.js";
import { distanceMeters } from "../lib/geo.js";
import { emitToSession } from "../lib/realtime.js";
import { expectedAt, rate } from "../lib/stats.js";

export const studentRouter = Router();
studentRouter.use(requireAuth, requireRole("STUDENT"));

async function studentCourses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    orderBy: { joinedAt: "asc" },
    include: {
      course: {
        include: {
          teacher: { select: { name: true } },
          sessions: { orderBy: { startedAt: "desc" }, include: { records: { where: { studentId } } } },
        },
      },
    },
  });

  return enrollments.map((e) => {
    const sessions = e.course.sessions
      .filter((s) => expectedAt(s, e) || s.records.length > 0)
      .map((s) => ({
        id: s.id,
        title: s.title,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        present: s.records.length > 0,
        markedAt: s.records[0]?.markedAt ?? null,
        method: s.records[0]?.method ?? null,
      }));
    const attended = sessions.filter((s) => s.present).length;
    const live = e.course.sessions.find((s) => !s.endedAt);
    return {
      id: e.course.id,
      code: e.course.code,
      name: e.course.name,
      teacher: e.course.teacher.name,
      joinedAt: e.joinedAt,
      attended,
      total: sessions.length,
      rate: rate(attended, sessions.length),
      live: live ? { id: live.id, marked: live.records.length > 0 } : null,
      sessions,
    };
  });
}

studentRouter.get(
  "/overview",
  handle(async (req, res) => {
    const courses = await studentCourses(req.user!.id);
    const attended = courses.reduce((n, c) => n + c.attended, 0);
    const total = courses.reduce((n, c) => n + c.total, 0);
    const recent = courses
      .flatMap((c) => c.sessions.map((s) => ({ ...s, courseId: c.id, courseCode: c.code, courseName: c.name })))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 8);
    // Longest run of consecutive attended sessions, newest first.
    let streak = 0;
    for (const s of courses.flatMap((c) => c.sessions).filter((s) => s.endedAt || s.present).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())) {
      if (!s.present) break;
      streak++;
    }
    res.json({
      stats: { courses: courses.length, attended, total, rate: rate(attended, total), streak },
      courses: courses.map(({ sessions, ...c }) => c),
      recent,
    });
  }),
);

studentRouter.get(
  "/courses/:id",
  handle(async (req, res) => {
    const course = (await studentCourses(req.user!.id)).find((c) => c.id === req.params.id);
    if (!course) throw notFound("Course not found.");
    res.json({ course });
  }),
);

const joinSchema = z.object({
  joinCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "Join codes are 6 letters and numbers"),
});

studentRouter.post(
  "/courses/join",
  handle(async (req, res) => {
    const { joinCode } = joinSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { joinCode } });
    if (!course) throw notFound("No course uses that join code. Check it with your teacher.");
    const existing = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: req.user!.id } } });
    if (existing) throw conflict(`You're already in ${course.code}.`, "ALREADY_ENROLLED");
    await prisma.enrollment.create({ data: { courseId: course.id, studentId: req.user!.id } });
    res.status(201).json({ course: { id: course.id, code: course.code, name: course.name } });
  }),
);

studentRouter.delete(
  "/courses/:id",
  handle(async (req, res) => {
    await prisma.enrollment.deleteMany({ where: { courseId: req.params.id, studentId: req.user!.id } });
    res.status(204).end();
  }),
);

const scanLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

const scanSchema = z.object({
  token: z.string().min(10).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100_000).optional(),
});

// GPS readings indoors are noisy, so we allow some of the reported accuracy as slack, capped.
const MAX_ACCURACY_SLACK_M = 50;

studentRouter.post(
  "/attendance/scan",
  scanLimiter,
  handle(async (req, res) => {
    const input = scanSchema.parse(req.body);
    const parsed = parseToken(input.token);
    if (!parsed) throw badRequest("That isn't an EduMark attendance code.", "BAD_TOKEN");

    const session = await prisma.classSession.findUnique({ where: { id: parsed.sessionId }, include: { course: true } });
    if (!session) throw badRequest("That isn't an EduMark attendance code.", "BAD_TOKEN");
    if (session.endedAt) throw badRequest("This class session has already ended.", "SESSION_ENDED");

    const check = checkToken(parsed, session.secret, session.rotateSeconds);
    if (check === "invalid") throw badRequest("That isn't an EduMark attendance code.", "BAD_TOKEN");
    if (check === "expired") throw badRequest("That code has expired. Scan the code on screen now.", "EXPIRED");

    const enrolled = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: session.courseId, studentId: req.user!.id } },
    });
    if (!enrolled) throw new HttpError(403, `You're not enrolled in ${session.course.code}. Join it with the course code first.`, "NOT_ENROLLED");

    let distance: number | null = null;
    if (session.radiusMeters != null && session.latitude != null && session.longitude != null) {
      if (input.latitude == null || input.longitude == null) {
        throw badRequest("This class checks your location. Allow location access and scan again.", "LOCATION_REQUIRED");
      }
      distance = distanceMeters(session.latitude, session.longitude, input.latitude, input.longitude);
      const slack = Math.min(input.accuracy ?? 0, MAX_ACCURACY_SLACK_M);
      if (distance > session.radiusMeters + slack) {
        throw new HttpError(403, `You seem to be about ${Math.round(distance)} m from class. Move closer and try again.`, "OUT_OF_RANGE");
      }
    }

    const existing = await prisma.attendanceRecord.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.id } } });
    if (existing) {
      return res.json({ status: "already", course: { code: session.course.code, name: session.course.name }, markedAt: existing.markedAt });
    }

    const record = await prisma.attendanceRecord.create({
      data: { sessionId: session.id, studentId: req.user!.id, method: "QR", distanceMeters: distance },
      include: { student: { select: { id: true, name: true, rollNumber: true } } },
    });
    emitToSession(session.id, "attendance:marked", {
      id: record.id, markedAt: record.markedAt, method: record.method, distanceMeters: record.distanceMeters, student: record.student,
    });
    res.status(201).json({ status: "marked", course: { code: session.course.code, name: session.course.name }, markedAt: record.markedAt });
  }),
);

