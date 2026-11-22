import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./ui";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const nav: Record<"TEACHER" | "STUDENT", { to: string; label: string; icon: IconName; end?: boolean }[]> = {
  TEACHER: [{ to: "/teacher", label: "Overview", icon: "home", end: true }],
  STUDENT: [
    { to: "/student", label: "My attendance", icon: "home", end: true },
    { to: "/student/scan", label: "Scan", icon: "scan" },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  if (!user) return null;
  const home = user.role === "TEACHER" ? "/teacher" : "/student";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Logo to={home} />
          <nav className="topnav" aria-label="Main">
            {nav[user.role].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="topnav-link">
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="topbar-right">
            <ThemeToggle />
            <div className="usermenu">
              <button
                className="usermenu-btn"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu((m) => !m);
                }}
              >
                <Avatar name={user.name} size={32} />
                <span className="usermenu-name">{user.name}</span>
              </button>
              {menu && (
                <div className="usermenu-pop" role="menu">
                  <div className="usermenu-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <span className="badge" style={{ marginTop: 6, justifySelf: "start" }}>
                      {user.role === "TEACHER" ? "Teacher" : `Student${user.rollNumber ? ` · ${user.rollNumber}` : ""}`}
                    </span>
                  </div>
                  <button
                    role="menuitem"
                    className="usermenu-item"
                    onClick={async () => {
                      await logout();
                      navigate("/login");
                    }}
                  >
                    <Icon name="logout" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions, children }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <div className="page-header-sub">{children}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
