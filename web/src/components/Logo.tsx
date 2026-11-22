import { Link } from "react-router-dom";

/** The EduMark mark: a tick drawn inside a register square. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="var(--ink)" />
      <path d="M8 9.5h9M8 14h5" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
      <path d="M9.5 19.5l4.2 4L23.5 11" stroke="var(--accent)" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="EduMark home">
      <LogoMark />
      <span>EduMark</span>
    </Link>
  );
}
