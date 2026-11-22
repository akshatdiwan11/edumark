import { Navigate, Route, Routes, useLocation, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, homeFor } from "./lib/auth";
import type { Role } from "./lib/types";
import { AppShell } from "./components/AppShell";
import { PageLoading } from "./components/ui";
import { Logo } from "./components/Logo";
import { Landing } from "./pages/Landing";
import { Login, Register } from "./pages/Auth";
import { TeacherDashboard } from "./pages/teacher/Dashboard";
import { TeacherCourse } from "./pages/teacher/Course";
import { LiveSession } from "./pages/teacher/LiveSession";
import { StudentDashboard } from "./pages/student/Dashboard";
import { StudentScan } from "./pages/student/Scan";
import { StudentCourse } from "./pages/student/Course";

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="notfound">
      <Logo />
      <h1>404</h1>
      <p>This page isn't on the register.</p>
      <Link className="btn btn-primary" to="/">
        Back home
      </Link>
    </div>
  );
}

export function App() {
  const { loading } = useAuth();
  if (loading) return <PageLoading />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/teacher"
        element={
          <RequireRole role="TEACHER">
            <AppShell />
          </RequireRole>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="courses/:id" element={<TeacherCourse />} />
        <Route path="sessions/:id" element={<LiveSession />} />
      </Route>
      <Route
        path="/student"
        element={
          <RequireRole role="STUDENT">
            <AppShell />
          </RequireRole>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="scan" element={<StudentScan />} />
        <Route path="courses/:id" element={<StudentCourse />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
