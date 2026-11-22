import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "../../components/AppShell";
import { Icon } from "../../components/Icon";
import { ErrorBox, Modal, PageLoading, Ring, Spinner, useToast, Empty } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { api, errorMessage } from "../../lib/api";
import { fmtDate, fmtTime } from "../../lib/format";
import type { StudentCourse, StudentSessionRow } from "../../lib/types";

export function StudentCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ course: StudentCourse & { sessions: StudentSessionRow[] } }>(`/student/courses/${id}`);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!data && loading) return <PageLoading />;
  if (!data) return <div className="page">{error && <ErrorBox message={error} onRetry={reload} />}</div>;
  const c = data.course;
  const needed = c.total > 0 ? Math.max(0, Math.ceil((0.75 * c.total - c.attended) / 0.25)) : 0;

  const leave = async () => {
    setBusy(true);
    try {
      await api(`/student/courses/${c.id}`, { method: "DELETE" });
      toast(`You left ${c.code}.`);
      navigate("/student", { replace: true });
    } catch (e) {
      toast(errorMessage(e), "bad");
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Link to="/student" className="back-link">
        <Icon name="arrowLeft" /> My attendance
      </Link>
      <PageHeader
        eyebrow={<span className="course-code">{c.code}</span>}
        title={c.name}
        actions={
          c.live && !c.live.marked ? (
            <Link className="btn btn-primary" to="/student/scan">
              <span className="live-dot" /> Scan now
            </Link>
          ) : undefined
        }
      >
        Taught by {c.teacher}
      </PageHeader>

      <div className="card card-pad student-course-summary">
        <Ring rate={c.rate} size={104} stroke={10} />
        <div>
          <p className="ended-big">
            {c.attended} of {c.total} classes
          </p>
          <p className="hint">
            {c.total === 0
              ? "No classes have been held since you joined."
              : needed > 0
                ? `Attend the next ${needed} ${needed === 1 ? "class" : "classes"} in a row to get back to 75%.`
                : "You're meeting the 75% attendance requirement."}
          </p>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Class history</h2>
        </div>
        {c.sessions.length === 0 ? (
          <Empty icon="calendar" title="No classes yet">
            Your attendance for each class will show up here.
          </Empty>
        ) : (
          <ul className="list">
            {c.sessions.map((s) => (
              <li key={s.id}>
                <div className="list-row">
                  <span className={`status-dot ${s.present ? "good" : s.endedAt ? "bad" : "live"}`} aria-hidden="true" />
                  <span className="list-main">
                    <strong>{fmtDate(s.startedAt)}</strong>
                    <small>
                      {fmtTime(s.startedAt)}
                      {s.title ? ` · ${s.title}` : ""}
                    </small>
                  </span>
                  {s.present && s.markedAt && (
                    <span className="hint num">
                      {s.method === "MANUAL" ? "by teacher" : "scanned"} {fmtTime(s.markedAt)}
                    </span>
                  )}
                  <span className={`badge ${s.present ? "badge-good" : s.endedAt ? "badge-bad" : "badge-live"}`}>{s.present ? "Present" : s.endedAt ? "Absent" : "Live now"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="leave-row">
        <button className="btn btn-ghost btn-sm" onClick={() => setLeaving(true)}>
          Leave this course
        </button>
      </div>

      {leaving && (
        <Modal
          title={`Leave ${c.code}?`}
          description="You'll stop seeing this course. Your teacher keeps your past attendance."
          onClose={() => setLeaving(false)}
          footer={
            <>
              <button className="btn" onClick={() => setLeaving(false)}>
                Stay
              </button>
              <button className="btn btn-danger" onClick={leave} disabled={busy}>
                {busy ? <Spinner /> : "Leave course"}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
