import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/AppShell";
import { Icon } from "../../components/Icon";
import { Empty, ErrorBox, Meter, Modal, RateBadge, Ring, Spinner, useToast } from "../../components/ui";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../lib/auth";
import { api, errorMessage } from "../../lib/api";
import { fmtDateTime } from "../../lib/format";
import type { StudentOverview } from "../../lib/types";

function JoinCourseModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ course: { code: string; name: string } }>("/student/courses/join", { body: { joinCode: code } });
      toast(`You've joined ${r.course.code} · ${r.course.name}.`);
      onJoined();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Join a course" description="Enter the 6-character code your teacher shared." onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <input
          className="input mono"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase())}
          placeholder="ABC123"
          aria-label="Join code"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || code.length !== 6}>
          {busy ? <Spinner /> : "Join course"}
        </button>
      </form>
    </Modal>
  );
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<StudentOverview>("/student/overview");
  const [joining, setJoining] = useState(false);

  const liveCourses = data?.courses.filter((c) => c.live && !c.live.marked) ?? [];

  return (
    <div className="page">
      <PageHeader
        eyebrow={user!.rollNumber ? `Roll no. ${user!.rollNumber}` : "Student"}
        title={`Hi, ${user!.name.split(" ")[0]}.`}
        actions={
          <>
            <button className="btn" onClick={() => setJoining(true)}>
              <Icon name="plus" /> Join course
            </button>
            <Link className="btn btn-primary" to="/student/scan">
              <Icon name="scan" /> Scan code
            </Link>
          </>
        }
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      {liveCourses.map((c) => (
        <Link key={c.id} to="/student/scan" className="live-banner">
          <span className="live-banner-icon">
            <Icon name="qr" />
          </span>
          <span>
            <strong>{c.code} is taking attendance now.</strong>
            <small>Scan the code on the screen to mark yourself present.</small>
          </span>
          <Icon name="arrowRight" />
        </Link>
      ))}

      {!data && loading ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 170 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      ) : data ? (
        <div className="stack">
          <div className="student-hero card">
            <Ring rate={data.stats.rate} size={128} stroke={12} />
            <div className="student-hero-stats">
              <div>
                <span className="stat-label">Classes attended</span>
                <span className="stat-value">
                  {data.stats.attended}
                  <small> / {data.stats.total}</small>
                </span>
              </div>
              <div>
                <span className="stat-label">Current streak</span>
                <span className="stat-value">
                  {data.stats.streak}
                  <small> {data.stats.streak === 1 ? "class" : "classes"}</small>
                </span>
              </div>
              <div>
                <span className="stat-label">Courses</span>
                <span className="stat-value">{data.stats.courses}</span>
              </div>
            </div>
            {data.stats.rate != null && (
              <p className={`student-hero-note tone-${data.stats.rate >= 75 ? "good" : "bad"}`}>
                {data.stats.rate >= 75 ? (
                  <>
                    <Icon name="check" /> You're above the 75% requirement.
                  </>
                ) : (
                  <>
                    <Icon name="alert" /> You're below 75%. Try not to miss the next few classes.
                  </>
                )}
              </p>
            )}
          </div>

          <section>
            <div className="section-head">
              <h2>My courses</h2>
            </div>
            {data.courses.length === 0 ? (
              <div className="card">
                <Empty
                  icon="book"
                  title="You haven't joined a course"
                  action={
                    <button className="btn btn-primary" onClick={() => setJoining(true)}>
                      <Icon name="plus" /> Join with a code
                    </button>
                  }
                >
                  Ask your teacher for the course join code, then add it here.
                </Empty>
              </div>
            ) : (
              <div className="course-grid">
                {data.courses.map((c) => (
                  <Link key={c.id} to={`/student/courses/${c.id}`} className={`card course-card ${c.live ? "is-live" : ""}`}>
                    <div className="course-card-top">
                      <div>
                        <span className="course-code">{c.code}</span>
                        <h3>{c.name}</h3>
                        <p className="hint">{c.teacher}</p>
                      </div>
                      {c.live && (c.live.marked ? <span className="badge badge-good">Marked</span> : <span className="badge badge-live">Live</span>)}
                    </div>
                    <div className="rate-cell">
                      <Meter rate={c.rate} />
                      <RateBadge rate={c.rate} />
                    </div>
                    <p className="hint">
                      {c.attended} of {c.total} classes attended
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {data.recent.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Recent classes</h2>
              </div>
              <ul className="list">
                {data.recent.map((s) => (
                  <li key={s.id}>
                    <div className="list-row">
                      <span className={`status-dot ${s.present ? "good" : s.endedAt ? "bad" : "live"}`} aria-hidden="true" />
                      <span className="course-code">{s.courseCode}</span>
                      <span className="list-main">
                        <strong>{s.title ?? s.courseName}</strong>
                        <small>{fmtDateTime(s.startedAt)}</small>
                      </span>
                      <span className={`badge ${s.present ? "badge-good" : s.endedAt ? "badge-bad" : "badge-live"}`}>
                        {s.present ? "Present" : s.endedAt ? "Absent" : "Live now"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}

      {joining && (
        <JoinCourseModal
          onClose={() => setJoining(false)}
          onJoined={() => {
            setJoining(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}

