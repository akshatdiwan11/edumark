const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export const fmtDate = (d: string | Date) => dateFmt.format(new Date(d));
export const fmtTime = (d: string | Date) => timeFmt.format(new Date(d));
export const fmtShort = (d: string | Date) => shortFmt.format(new Date(d));
export const fmtDateTime = (d: string | Date) => `${fmtDate(d)}, ${fmtTime(d)}`;

export function fmtRate(rate: number | null | undefined) {
  return rate == null ? "–" : `${Math.round(rate)}%`;
}

export function rateTone(rate: number | null | undefined): "good" | "warn" | "bad" | "none" {
  if (rate == null) return "none";
  if (rate >= 85) return "good";
  if (rate >= 75) return "warn";
  return "bad";
}

export function relative(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return fmtShort(d);
}

export function duration(from: string | Date, to: string | Date = new Date()) {
  const s = Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function initials(name: string) {
  return name
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_HUES = [18, 160, 210, 280, 40, 330, 120, 190];
export function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return `hsl(${hue} 60% 82%)`;
}
