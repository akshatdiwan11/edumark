/**
 * Demo data: two teachers, a dozen students, three courses and four weeks of
 * past sessions with realistic attendance. Safe to re-run: it wipes demo data first.
 * All demo accounts use the password "password123".
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const PASSWORD = "password123";

const teachers = [
  { name: "Dr. Priya Sharma", email: "teacher@edumark.com" },
  { name: "Prof. Rajesh Kumar", email: "teacher2@edumark.com" },
];

const students = [
  ["Arjun Patel", "student@edumark.com", "CS21001"],
  ["Meera Singh", "student2@edumark.com", "CS21002"],
  ["Kabir Mehta", "kabir@edumark.com", "CS21003"],
  ["Ananya Iyer", "ananya@edumark.com", "CS21004"],
  ["Rohan Das", "rohan@edumark.com", "CS21005"],
  ["Ishita Rao", "ishita@edumark.com", "CS21006"],
  ["Vikram Nair", "vikram@edumark.com", "CS21007"],
  ["Sara Khan", "sara@edumark.com", "CS21008"],
  ["Dev Malhotra", "dev@edumark.com", "CS21009"],
  ["Nisha Verma", "nisha@edumark.com", "CS21010"],
  ["Aditya Joshi", "aditya@edumark.com", "CS21011"],
  ["Tara Bose", "tara@edumark.com", "CS21012"],
] as const;

// Each student's chance of showing up, so the analytics have some shape.
const reliability = [0.95, 0.9, 0.85, 0.97, 0.6, 0.88, 0.7, 0.92, 0.55, 0.9, 0.8, 0.98];

// Deterministic randomness so the demo looks the same every time.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

async function main() {
  const emails = [...teachers.map((t) => t.email), ...students.map((s) => s[1])];
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const [priya, rajesh] = await Promise.all(
    teachers.map((t) => prisma.user.create({ data: { ...t, role: "TEACHER", passwordHash } })),
  );
  const studentRows = await Promise.all(
    students.map(([name, email, rollNumber]) => prisma.user.create({ data: { name, email, rollNumber, role: "STUDENT", passwordHash } })),
  );

  const courses = [
    { code: "CS301", name: "Data Structures & Algorithms", joinCode: "DSA301", teacherId: priya!.id, days: [1, 3, 5], hour: 9 },
    { code: "CS342", name: "Database Systems", joinCode: "DBS342", teacherId: priya!.id, days: [2, 4], hour: 11 },
    { code: "MA201", name: "Probability & Statistics", joinCode: "PRB201", teacherId: rajesh!.id, days: [1, 4], hour: 14 },
  ];

  const start = new Date();
  start.setDate(start.getDate() - 28);
  start.setHours(0, 0, 0, 0);

  for (const c of courses) {
    const course = await prisma.course.create({ data: { code: c.code, name: c.name, joinCode: c.joinCode, teacherId: c.teacherId } });
    const roster = c.code === "MA201" ? studentRows.slice(0, 8) : studentRows;
    await prisma.enrollment.createMany({ data: roster.map((s) => ({ courseId: course.id, studentId: s.id, joinedAt: start })) });

    for (let d = 0; d < 28; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + d);
      if (!c.days.includes(day.getDay())) continue;
      const startedAt = new Date(day);
      startedAt.setHours(c.hour, 0, 0, 0);
      if (startedAt > new Date()) continue;
      const endedAt = new Date(startedAt.getTime() + 50 * 60 * 1000);
      const session = await prisma.classSession.create({
        data: { courseId: course.id, startedAt, endedAt, secret: crypto.randomBytes(32).toString("base64url"), rotateSeconds: 20 },
      });
      const records = roster.flatMap((s) => {
        const idx = studentRows.indexOf(s);
        if (rand() > reliability[idx]!) return [];
        const markedAt = new Date(startedAt.getTime() + Math.floor(rand() * 12 * 60 * 1000));
        return [{ sessionId: session.id, studentId: s.id, markedAt, method: rand() > 0.93 ? ("MANUAL" as const) : ("QR" as const) }];
      });
      await prisma.attendanceRecord.createMany({ data: records });
    }
  }

  console.log(`Seeded ${teachers.length} teachers, ${students.length} students, ${courses.length} courses. Password: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
