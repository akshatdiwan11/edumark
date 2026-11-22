import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { badRequest, conflict, handle, notFound } from "../lib/errors.js";
import { joinCode } from "../lib/codes.js";
import { issueToken, newSessionSecret } from "../lib/qr.js";
import { emitToSession } from "../lib/realtime.js";
import { expectedAt, rate } from "../lib/stats.js";

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole("TEACHER"));

async function ownedCourse(teacherId: string, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, teacherId } });
  if (!course) throw notFound("Course not found.");
  return course;
}

async function ownedSession(teacherId: string, sessionId: string) {
  const session = await prisma.classSession.findFirst({
    where: { id: sessionId, course: { teacherId } },
    include: { course: true },
  });
  if (!session) throw notFound("Session not found.");
  return session;
}

async function uniqueJoinCode() {
  for (let i = 0; i < 10; i++) {
    const code = joinCode();
    if (!(await prisma.course.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique join code");
}

/** Loads a course with everything needed to compute its attendance figures. */
async function courseWithStats(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      enrollments: { include: { student: { select: { id: true, name: true, email: true, rollNumber: true } } } },
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { records: { select: { studentId: true } } },
      },
    },
  });

  const sessions = course.sessions.map((s) => {
    const expected = course.enrollments.filter((e) => expectedAt(s, e)).length;
    return {
      id: s.id,
      title: s.title,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      geofenced: s.radiusMeters != null,
      present: s.records.length,
      expected,
      rate: rate(s.records.length, expected),
    };
  });

  const students = course.enrollments
    .map((e) => {
      const expectedSessions = course.sessions.filter((s) => expectedAt(s, e));
      const attended = expectedSessions.filter((s) => s.records.some((r) => r.studentId === e.studentId)).length;
      return { ...e.student, joinedAt: e.joinedAt, attended, total: expectedSessions.length, rate: rate(attended, expectedSessions.length) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totals = sessions.reduce((acc, s) => ({ p: acc.p + s.present, e: acc.e + s.expected }), { p: 0, e: 0 });

  return {
    id: course.id,
    code: course.code,
    name: course.name,
    joinCode: course.joinCode,
    createdAt: course.createdAt,
    activeSessionId: course.sessions.find((s) => !s.endedAt)?.id ?? null,
    rate: rate(totals.p, totals.e),
    sessions,
    students,
  };
}

teacherRouter.get(
  "/overview",
  handle(async (req, res) => {
    const courses = await prisma.course.findMany({ where: { teacherId: req.user!.id }, select: { id: true }, orderBy: { createdAt: "asc" } });
    const detailed = await Promise.all(courses.map((c) => courseWithStats(c.id)));

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const allSessions = detailed
      .flatMap((c) => c.sessions.map((s) => ({ ...s, courseId: c.id, courseCode: c.code, courseName: c.name })))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const totals = allSessions.reduce((acc, s) => ({ p: acc.p + s.present, e: acc.e + s.expected }), { p: 0, e: 0 });
    const uniqueStudents = new Set(detailed.flatMap((c) => c.students.map((s) => s.id)));
    const atRisk = detailed
      .flatMap((c) => c.students.filter((s) => s.total >= 3 && (s.rate ?? 100) < 75).map((s) => ({ ...s, courseId: c.id, courseCode: c.code })))
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
      .slice(0, 6);

    res.json({
      stats: {
        courses: detailed.length,
        students: uniqueStudents.size,
        sessionsThisWeek: allSessions.filter((s) => s.startedAt.getTime() >= weekAgo).length,
        rate: rate(totals.p, totals.e),
      },
      courses: detailed.map(({ sessions, students, ...c }) => ({
        ...c,
        studentCount: students.length,
        sessionCount: sessions.length,
        lastSessionAt: sessions[0]?.startedAt ?? null,
      })),
      trend: allSessions.slice(0, 14).reverse(),
      recentSessions: allSessions.slice(0, 6),
      atRisk,
    });
  }),
);

const courseSchema = z.object({
  code: z.string().trim().min(2, "Add a short course code").max(16).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2, "Add a course name").max(80),
});

teacherRouter.post(
  "/courses",
  handle(async (req, res) => {
    const input = courseSchema.parse(req.body);
    const course = await prisma.course.create({
      data: { ...input, teacherId: req.user!.id, joinCode: await uniqueJoinCode() },
    });
    res.status(201).json({ course });
  }),
);

teacherRouter.get(
  "/courses/:id",
  handle(async (req, res) => {
    await ownedCourse(req.user!.id, req.params.id!);
    res.json({ course: await courseWithStats(req.params.id!) });
  }),
);

teacherRouter.patch(
  "/courses/:id",
  handle(async (req, res) => {
    await ownedCourse(req.user!.id, req.params.id!);
    const input = courseSchema.partial().parse(req.body);
    const course = await prisma.course.update({ where: { id: req.params.id }, data: input });
    res.json({ course });
  }),
);

teacherRouter.delete(
  "/courses/:id",
  handle(async (req, res) => {
    await ownedCourse(req.user!.id, req.params.id!);
    await prisma.course.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

teacherRouter.post(
  "/courses/:id/join-code",
  handle(async (req, res) => {
    await ownedCourse(req.user!.id, req.params.id!);
    const course = await prisma.course.update({ where: { id: req.params.id }, data: { joinCode: await uniqueJoinCode() } });
    res.json({ joinCode: course.joinCode });
  }),
);

teacherRouter.delete(
  "/courses/:id/students/:studentId",
  handle(async (req, res) => {
    await ownedCourse(req.user!.id, req.params.id!);
    await prisma.enrollment.deleteMany({ where: { courseId: req.params.id, studentId: req.params.studentId } });
    res.status(204).end();
  }),
);

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Quote everything and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

teacherRouter.get(
  "/courses/:id/export.csv",
  handle(async (req, res) => {
    const course = await ownedCourse(req.user!.id, req.params.id!);
    const [enrollments, sessions] = await Promise.all([
      prisma.enrollment.findMany({ where: { courseId: course.id }, include: { student: true }, orderBy: { student: { name: "asc" } } }),
      prisma.classSession.findMany({ where: { courseId: course.id }, orderBy: { startedAt: "asc" }, include: { records: true } }),
    ]);
    const fmt = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
    const header = ["Name", "Email", "Roll number", ...sessions.map((s) => `${fmt(s.startedAt)}${s.title ? ` ${s.title}` : ""}`), "Attended", "Expected", "Rate %"];
    const rows = enrollments.map((e) => {
      let attended = 0;
      let expected = 0;
      const cells = sessions.map((s) => {
        const rec = s.records.find((r) => r.studentId === e.studentId);
        if (!expectedAt(s, e)) return rec ? "P" : "";
        expected++;
        if (rec) attended++;
        return rec ? "P" : "A";
      });
      return [e.student.name, e.student.email, e.student.rollNumber ?? "", ...cells, attended, expected, rate(attended, expected) ?? ""];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const filename = `${course.code}-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("﻿" + csv);
  }),
);

const startSchema = z.object({
  title: z.string().trim().max(80).optional(),
  rotateSeconds: z.number().int().min(10).max(60).default(20),
  geofence: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusMeters: z.number().int().min(20).max(2000),
    })
    .nullish(),
});

teacherRouter.post(
  "/courses/:id/sessions",
  handle(async (req, res) => {
    const course = await ownedCourse(req.user!.id, req.params.id!);
    const input = startSchema.parse(req.body ?? {});
    const active = await prisma.classSession.findFirst({ where: { courseId: course.id, endedAt: null } });
    if (active) throw conflict("This course already has a live session. End it before starting another.", "SESSION_ACTIVE");
    const session = await prisma.classSession.create({
      data: {
        courseId: course.id,
        title: input.title || null,
        rotateSeconds: input.rotateSeconds,
        secret: newSessionSecret(),
        latitude: input.geofence?.latitude,
        longitude: input.geofence?.longitude,
        radiusMeters: input.geofence?.radiusMeters,
      },
    });
    res.status(201).json({ session: { id: session.id } });
  }),
);

teacherRouter.get(
  "/sessions/:id",
  handle(async (req, res) => {
    const s = await ownedSession(req.user!.id, req.params.id!);
    const [records, enrollments] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { sessionId: s.id },
        orderBy: { markedAt: "desc" },
        include: { student: { select: { id: true, name: true, rollNumber: true } } },
      }),
      prisma.enrollment.findMany({ where: { courseId: s.courseId }, include: { student: { select: { id: true, name: true, rollNumber: true } } } }),
    ]);
    const expected = enrollments.filter((e) => expectedAt(s, e));
    res.json({
      session: {
        id: s.id,
        title: s.title,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        rotateSeconds: s.rotateSeconds,
        geofence: s.radiusMeters != null ? { latitude: s.latitude, longitude: s.longitude, radiusMeters: s.radiusMeters } : null,
        course: { id: s.course.id, code: s.course.code, name: s.course.name },
      },
      records: records.map((r) => ({ id: r.id, markedAt: r.markedAt, method: r.method, distanceMeters: r.distanceMeters, student: r.student })),
      roster: expected.map((e) => e.student).sort((a, b) => a.name.localeCompare(b.name)),
    });
  }),
);

teacherRouter.get(
  "/sessions/:id/qr",
  handle(async (req, res) => {
    const s = await ownedSession(req.user!.id, req.params.id!);
    if (s.endedAt) throw badRequest("This session has ended.", "SESSION_ENDED");
    res.setHeader("Cache-Control", "no-store");
    res.json({ ...issueToken(s.id, s.secret, s.rotateSeconds), rotateSeconds: s.rotateSeconds, serverTime: Date.now() });
  }),
);

teacherRouter.post(
  "/sessions/:id/end",
  handle(async (req, res) => {
    const s = await ownedSession(req.user!.id, req.params.id!);
    if (!s.endedAt) {
      await prisma.classSession.update({ where: { id: s.id }, data: { endedAt: new Date() } });
      emitToSession(s.id, "session:ended", { sessionId: s.id });
    }
    res.status(204).end();
  }),
);

const manualSchema = z.object({ studentId: z.string().min(1), present: z.boolean() });

teacherRouter.post(
  "/sessions/:id/manual",
  handle(async (req, res) => {
    const s = await ownedSession(req.user!.id, req.params.id!);
    const input = manualSchema.parse(req.body);
    const enrolled = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: s.courseId, studentId: input.studentId } } });
    if (!enrolled) throw badRequest("That student isn't in this course.");
    if (input.present) {
      const record = await prisma.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: s.id, studentId: input.studentId } },
        create: { sessionId: s.id, studentId: input.studentId, method: "MANUAL" },
        update: {},
        include: { student: { select: { id: true, name: true, rollNumber: true } } },
      });
      emitToSession(s.id, "attendance:marked", {
        id: record.id, markedAt: record.markedAt, method: record.method, distanceMeters: record.distanceMeters, student: record.student,
      });
    } else {
      await prisma.attendanceRecord.deleteMany({ where: { sessionId: s.id, studentId: input.studentId } });
      emitToSession(s.id, "attendance:removed", { studentId: input.studentId });
    }
    res.status(204).end();
  }),
);

teacherRouter.delete(
  "/sessions/:id",
  handle(async (req, res) => {
    const s = await ownedSession(req.user!.id, req.params.id!);
    await prisma.classSession.delete({ where: { id: s.id } });
    emitToSession(s.id, "session:ended", { sessionId: s.id });
    res.status(204).end();
  }),
);
