import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Icon } from "../components/Icon";
import { Avatar, Spinner } from "../components/ui";
import { ThemeToggle } from "../components/ThemeToggle";
import { homeFor, useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import type { Role } from "../lib/types";

const demoAccounts: { name: string; email: string; role: Role }[] = [
  { name: "Dr. Priya Sharma", email: "teacher@edumark.com", role: "TEACHER" },
  { name: "Arjun Patel", email: "student@edumark.com", role: "STUDENT" },
  { name: "Prof. Rajesh Kumar", email: "teacher2@edumark.com", role: "TEACHER" },
  { name: "Meera Singh", email: "student2@edumark.com", role: "STUDENT" },
];

function RolePicker({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="field">
      <span className="label">I am a</span>
      <div className="segmented" role="group" aria-label="Account type">
        <button type="button" aria-pressed={role === "TEACHER"} onClick={() => onChange("TEACHER")}>
          <Icon name="teacher" /> Teacher
        </button>
        <button type="button" aria-pressed={role === "STUDENT"} onClick={() => onChange("STUDENT")}>
          <Icon name="student" /> Student
        </button>
      </div>
    </div>
  );
}

function AuthLayout({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-main">
        <div className="auth-top">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="auth-form-wrap">{children}</div>
      </div>
      <aside className="auth-aside">{aside}</aside>
    </div>
  );
}

function Aside() {
  return (
    <div className="auth-aside-inner">
      <h2>Attendance, without the roll call.</h2>
      <ul className="auth-aside-list">
        <li>
          <Icon name="refresh" /> Codes refresh every 20 seconds, so they can't be shared.
        </li>
        <li>
          <Icon name="pin" /> Optional geofence keeps check-ins inside the classroom.
        </li>
        <li>
          <Icon name="pulse" /> Names appear on the teacher's screen as students scan.
        </li>
      </ul>
      <div className="auth-aside-grid" aria-hidden="true">
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} className={[3, 8, 12, 19, 22, 27, 31].includes(i) ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<Role>("TEACHER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password, role);
      navigate(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout aside={<Aside />}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div>
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to take or check attendance.</p>
        </div>
        <RolePicker role={role} onChange={setRole} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>
          {busy ? <Spinner label="Signing in" /> : "Sign in"}
        </button>
        <p className="auth-switch">
          New to EduMark? <Link to="/register">Create an account</Link>
        </p>

        <div className="demo">
          <div className="demo-head">
            <span>Demo accounts</span>
            <span className="hint">password: password123</span>
          </div>
          <div className="demo-grid">
            {demoAccounts.map((a) => (
              <button
                type="button"
                key={a.email}
                className="demo-account"
                onClick={() => {
                  setRole(a.role);
                  setEmail(a.email);
                  setPassword("password123");
                  setError(null);
                }}
              >
                <Avatar name={a.name} size={30} />
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.role === "TEACHER" ? "Teacher" : "Student"}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("STUDENT");
  const [form, setForm] = useState({ name: "", email: "", password: "", rollNumber: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError(null);
    try {
      const u = await register({ ...form, role, rollNumber: role === "STUDENT" ? form.rollNumber : undefined });
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout aside={<Aside />}>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div>
          <h1>Create your account</h1>
          <p className="auth-sub">{role === "TEACHER" ? "Set up courses and run attendance in minutes." : "Join your courses and check in with one scan."}</p>
        </div>
        <RolePicker role={role} onChange={setRole} />
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={set("name")} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </div>
        {role === "STUDENT" && (
          <div className="field">
            <label htmlFor="roll">
              Roll number <span className="hint">(optional)</span>
            </label>
            <input id="roll" className="input" value={form.rollNumber} onChange={set("rollNumber")} />
          </div>
        )}
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
          <span className="hint">At least 8 characters.</span>
        </div>
        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !form.name || !form.email || !form.password}>
          {busy ? <Spinner label="Creating account" /> : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
