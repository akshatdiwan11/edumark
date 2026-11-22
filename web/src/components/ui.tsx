import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { avatarColor, fmtRate, initials, rateTone } from "../lib/format";

/* ---------- Toasts ---------- */
type Toast = { id: number; tone: "good" | "bad" | "info"; text: string };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string, tone: Toast["tone"] = "good") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const icon: Record<Toast["tone"], IconName> = { good: "check", bad: "alert", info: "info" };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={icon[t.tone]} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

/* ---------- Modal ---------- */
export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Small pieces ---------- */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.36, color: "#1c1f33" }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label} />;
}

export function PageLoading() {
  return (
    <div className="page-loading">
      <Spinner />
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert" role="alert">
      <Icon name="alert" />
      <div style={{ flex: 1 }}>{message}</div>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

const toneColor = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", none: "var(--line-strong)" };

export function RateBadge({ rate }: { rate: number | null }) {
  const tone = rateTone(rate);
  return <span className={`badge ${tone === "none" ? "" : `badge-${tone}`}`}>{fmtRate(rate)}</span>;
}

export function Meter({ rate }: { rate: number | null }) {
  return (
    <div className="meter" role="img" aria-label={`Attendance ${fmtRate(rate)}`}>
      <span style={{ width: `${rate ?? 0}%`, background: toneColor[rateTone(rate)] }} />
    </div>
  );
}

export function Ring({ rate, size = 120, stroke = 10, label }: { rate: number | null; size?: number; stroke?: number; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(rate ?? 0));
    return () => cancelAnimationFrame(id);
  }, [rate]);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={toneColor[rateTone(rate)]}
          strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 100}
        />
      </svg>
      <span className="ring-label" style={{ fontSize: size * 0.24 }}>
        {label ?? fmtRate(rate)}
      </span>
    </div>
  );
}

export function BarChart({ data, empty }: { data: { key: string; label: string; value: number | null; tip: string }[]; empty?: string }) {
  if (data.length === 0) return <p className="hint">{empty ?? "No data yet."}</p>;
  return (
    <div className="chart-bars" role="list">
      {data.map((d) => (
        <div className="chart-bar" key={d.key} role="listitem" tabIndex={0} aria-label={d.tip}>
          <div className="chart-bar-track">
            <div className={`chart-bar-fill ${(d.value ?? 0) < 75 ? "low" : ""}`} style={{ height: `${Math.max(d.value ?? 0, 2)}%` }}>
              <span className="chart-bar-tip">{d.tip}</span>
            </div>
          </div>
          <span className="chart-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
