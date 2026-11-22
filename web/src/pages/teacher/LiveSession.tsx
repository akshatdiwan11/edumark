import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { QrCode } from "../../components/QrCode";
import { Avatar, ErrorBox, Modal, PageLoading, Ring, Spinner, useToast } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { api, errorMessage } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { duration, fmtDateTime, fmtTime, relative } from "../../lib/format";
import type { AttendanceEntry, LiveSession as LiveSessionData } from "../../lib/types";

interface QrState {
  token: string;
  expiresAt: number;
  rotateSeconds: number;
  offset: number; // server clock minus local clock
}

/** Keeps the current QR token fresh, fetching a new one just as each expires. */
function useRotatingToken(sessionId: string, active: boolean) {
  const [qr, setQr] = useState<QrState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let timer: number;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await api<{ token: string; expiresAt: number; rotateSeconds: number; serverTime: number }>(`/teacher/sessions/${sessionId}/qr`);
        if (cancelled) return;
        const offset = r.serverTime - Date.now();
        setQr({ token: r.token, expiresAt: r.expiresAt, rotateSeconds: r.rotateSeconds, offset });
        setError(null);
        timer = window.setTimeout(load, Math.max(500, r.expiresAt - (Date.now() + offset) + 150));
      } catch (e) {
        if (cancelled) return;
        setError(errorMessage(e));
        timer = window.setTimeout(load, 3000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionId, active]);

  return { qr, error };
}

function useNow(interval = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

export function LiveSession() {
  const { id } = useParams();
  const sessionId = id!;
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<LiveSessionData>(`/teacher/sessions/${sessionId}`);
  const live = Boolean(data && !data.session.endedAt);
  const { qr, error: qrError } = useRotatingToken(sessionId, live);
  const now = useNow();
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Live feed over websockets.
  useEffect(() => {
    if (!live) return;
    const socket = getSocket();
    const watch = () => socket.emit("session:watch", sessionId);
    const onMarked = (rec: AttendanceEntry) => {
      setData((d) => (d && !d.records.some((r) => r.student.id === rec.student.id) ? { ...d, records: [rec, ...d.records] } : d));
      setFresh(rec.student.id);
    };
    const onRemoved = ({ studentId }: { studentId: string }) =>
      setData((d) => (d ? { ...d, records: d.records.filter((r) => r.student.id !== studentId) } : d));
    const onEnded = () => void reload();
    const onReconnect = () => {
      watch();
      void reload();
    };
    watch();
    socket.on("attendance:marked", onMarked);
    socket.on("attendance:removed", onRemoved);
    socket.on("session:ended", onEnded);
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.emit("session:unwatch", sessionId);
      socket.off("attendance:marked", onMarked);
      socket.off("attendance:removed", onRemoved);
      socket.off("session:ended", onEnded);
      socket.io.off("reconnect", onReconnect);
    };
  }, [live, sessionId, reload, setData]);

  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(null), 2500);
    return () => window.clearTimeout(t);
  }, [fresh]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const presentIds = useMemo(() => new Set(data?.records.map((r) => r.student.id)), [data]);
  const absent = useMemo(() => data?.roster.filter((s) => !presentIds.has(s.id)) ?? [], [data, presentIds]);

  const mark = useCallback(
    async (studentId: string, present: boolean) => {
      setPending(studentId);
      try {
        await api(`/teacher/sessions/${sessionId}/manual`, { body: { studentId, present } });
        await reload();
      } catch (e) {
        toast(errorMessage(e), "bad");
      } finally {
        setPending(null);
      }
    },
    [sessionId, reload, toast],
  );

  const endSession = async () => {
    setBusy(true);
    try {
      await api(`/teacher/sessions/${sessionId}/end`, { method: "POST" });
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setEnding(false);
      await reload();
      toast("Session ended. The register is saved.");
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  if (!data && loading) return <PageLoading />;
  if (!data) return <div className="page">{error && <ErrorBox message={error} onRetry={reload} />}</div>;

  const { session, records, roster } = data;
  const rate = roster.length ? (records.length / roster.length) * 100 : null;
  const scanUrl = qr ? `${window.location.origin}/student/scan?t=${encodeURIComponent(qr.token)}` : "";
  const remaining = qr ? Math.max(0, qr.expiresAt - (now + qr.offset)) : 0;

  return (
    <div className="page live-page">
      <Link to={`/teacher/courses/${session.course.id}`} className="back-link">
        <Icon name="arrowLeft" /> {session.course.code}
      </Link>

      <div className="live-head">
        <div>
          <div className="eyebrow">
            {live ? <span className="badge badge-live">Live · {duration(session.startedAt, new Date(now))}</span> : <span className="badge">Ended</span>}
            <span>{fmtDateTime(session.startedAt)}</span>
          </div>
          <h1>{session.title ?? session.course.name}</h1>
          <p className="page-header-sub">
            {session.course.code} · {session.course.name}
          </p>
        </div>
        {live && (
          <div className="page-header-actions">
            <button className="btn" onClick={toggleFullscreen}>
              <Icon name="expand" /> Present
            </button>
            <button className="btn btn-ink" onClick={() => setEnding(true)}>
              <Icon name="stop" /> End session
            </button>
          </div>
        )}
      </div>

      <div className={`live-grid ${live ? "" : "is-ended"}`}>
        {live && (
          <div ref={stageRef} className={`stage ${fullscreen ? "is-full" : ""}`}>
            <div className="stage-top">
              <span className="stage-code">{session.course.code}</span>
              {session.geofence && (
                <span className="stage-chip">
                  <Icon name="pin" /> Within {session.geofence.radiusMeters} m
                </span>
              )}
              <span className="stage-count">
                <strong>{records.length}</strong> / {roster.length} here
              </span>
            </div>
            <div className="stage-qr">
              {qr ? <QrCode key={qr.token} value={scanUrl} size={fullscreen ? 520 : 320} className="qr-swap" /> : <Spinner />}
            </div>
            <div className="stage-timer" aria-hidden="true">
              <span style={{ width: qr ? `${(remaining / (qr.rotateSeconds * 1000)) * 100}%` : "0%" }} />
            </div>
            <p className="stage-help">
              Scan with your phone camera, or open <strong>EduMark → Scan</strong>. New code in {Math.ceil(remaining / 1000)}s.
            </p>
            {qrError && <p className="stage-error">{qrError}</p>}
            {fullscreen && (
              <button className="btn btn-sm stage-exit" onClick={toggleFullscreen}>
                <Icon name="x" /> Exit
              </button>
            )}
          </div>
        )}

        {!live && (
          <div className="card card-pad ended-summary">
            <Ring rate={rate} size={120} stroke={11} />
            <div>
              <span className="stat-label">Final register</span>
              <p className="ended-big">
                {records.length} of {roster.length} present
              </p>
              <p className="hint">
                Ran from {fmtTime(session.startedAt)} to {fmtTime(session.endedAt!)} ({duration(session.startedAt, session.endedAt!)}). You can still correct the
                register below.
              </p>
            </div>
          </div>
        )}

        <div className="roll">
          <section className="card">
            <div className="card-head">
              <h2>
                Present <span className="tab-count">{records.length}</span>
              </h2>
              {live && <span className="hint">updates live</span>}
            </div>
            {records.length === 0 ? (
              <p className="roll-empty">{live ? "Waiting for the first scan…" : "Nobody was marked present."}</p>
            ) : (
              <ul className="roll-list">
                {records.map((r) => (
                  <li key={r.id} className={fresh === r.student.id ? "is-fresh" : ""}>
                    <Avatar name={r.student.name} size={32} />
                    <span className="list-main">
                      <strong>{r.student.name}</strong>
                      <small>
                        {r.method === "MANUAL" ? "Marked by you" : "Scanned"} · {live ? relative(r.markedAt) : fmtTime(r.markedAt)}
                        {r.distanceMeters != null && ` · ${Math.round(r.distanceMeters)} m away`}
                      </small>
                    </span>
                    <button className="icon-btn" title="Mark absent" aria-label={`Mark ${r.student.name} absent`} onClick={() => mark(r.student.id, false)} disabled={pending === r.student.id}>
                      {pending === r.student.id ? <Spinner /> : <Icon name="x" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                {live ? "Not here yet" : "Absent"} <span className="tab-count">{absent.length}</span>
              </h2>
            </div>
            {absent.length === 0 ? (
              <p className="roll-empty">{roster.length ? "Everyone's here. 🎉" : "No students are enrolled in this course yet."}</p>
            ) : (
              <ul className="roll-list">
                {absent.map((s) => (
                  <li key={s.id}>
                    <Avatar name={s.name} size={32} />
                    <span className="list-main">
                      <strong>{s.name}</strong>
                      <small>{s.rollNumber ?? "No roll number"}</small>
                    </span>
                    <button className="btn btn-sm" onClick={() => mark(s.id, true)} disabled={pending === s.id}>
                      {pending === s.id ? <Spinner /> : (
                        <>
                          <Icon name="check" /> Mark present
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {ending && (
        <Modal
          title="End this session?"
          description={`${records.length} of ${roster.length} students are marked present. The QR code stops working as soon as you end it.`}
          onClose={() => setEnding(false)}
          footer={
            <>
              <button className="btn" onClick={() => setEnding(false)}>
                Keep running
              </button>
              <button className="btn btn-ink" onClick={endSession} disabled={busy}>
                {busy ? <Spinner /> : "End session"}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
