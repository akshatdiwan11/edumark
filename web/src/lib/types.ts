export type Role = "TEACHER" | "STUDENT";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rollNumber: string | null;
}

export interface SessionSummary {
  id: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  geofenced: boolean;
  present: number;
  expected: number;
  rate: number | null;
}

export interface CourseSummary {
  id: string;
  code: string;
  name: string;
  joinCode: string;
  activeSessionId: string | null;
  rate: number | null;
  studentCount: number;
  sessionCount: number;
  lastSessionAt: string | null;
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  joinedAt: string;
  attended: number;
  total: number;
  rate: number | null;
}

export interface CourseDetail {
  id: string;
  code: string;
  name: string;
  joinCode: string;
  activeSessionId: string | null;
  rate: number | null;
  sessions: SessionSummary[];
  students: RosterStudent[];
}

export interface TeacherOverview {
  stats: { courses: number; students: number; sessionsThisWeek: number; rate: number | null };
  courses: CourseSummary[];
  trend: (SessionSummary & { courseCode: string; courseId: string })[];
  recentSessions: (SessionSummary & { courseCode: string; courseName: string; courseId: string })[];
  atRisk: (RosterStudent & { courseId: string; courseCode: string })[];
}

export interface AttendanceEntry {
  id: string;
  markedAt: string;
  method: "QR" | "MANUAL";
  distanceMeters: number | null;
  student: { id: string; name: string; rollNumber: string | null };
}

export interface LiveSession {
  session: {
    id: string;
    title: string | null;
    startedAt: string;
    endedAt: string | null;
    rotateSeconds: number;
    geofence: { latitude: number; longitude: number; radiusMeters: number } | null;
    course: { id: string; code: string; name: string };
  };
  records: AttendanceEntry[];
  roster: { id: string; name: string; rollNumber: string | null }[];
}

export interface StudentSessionRow {
  id: string;
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  present: boolean;
  markedAt: string | null;
  method: "QR" | "MANUAL" | null;
}

export interface StudentCourse {
  id: string;
  code: string;
  name: string;
  teacher: string;
  joinedAt: string;
  attended: number;
  total: number;
  rate: number | null;
  live: { id: string; marked: boolean } | null;
}

export interface StudentOverview {
  stats: { courses: number; attended: number; total: number; rate: number | null; streak: number };
  courses: StudentCourse[];
  recent: (StudentSessionRow & { courseId: string; courseCode: string; courseName: string })[];
}
