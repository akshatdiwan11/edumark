import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/AppShell";
import { Icon } from "../../components/Icon";
import { Avatar, BarChart, Empty, ErrorBox, RateBadge, Ring } from "../../components/ui";
import { NewCourseModal, StartSessionModal } from "../../components/teacher";
import { useApi } from "../../lib/useApi";
import { useAuth } from "../../lib/auth";
import { fmtDateTime, fmtRate, fmtShort, relative } from "../../lib/format";
import type { CourseSummary, TeacherOverview } from "../../lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const firstName = (name: string) => name.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").split(" ")[0];

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<TeacherOverview>("/teacher/overview");
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState<CourseSummary | null>(null);

  return (
    <div className="page">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        title={`${greeting()}, ${firstName(user!.name)}.`}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New course
          </button>
        }
      />

      {error && <ErrorBox message={error} onRetry={reload} />}

      {!data && loading ? (
        <div className="stack">
          <div className="stats">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 112 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 260 }} />
        </div>
      ) : data ? (
        <div className="stack">
          <div className="stats">
            <div className="card stat">
              <span className="stat-label">Overall attendance</span>
              <span className="stat-value">{fmtRate(data.stats.rate)}</span>
              <span className="stat-foot">across all sessions</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Students</span>
              <span className="stat-value">{data.stats.students}</span>
              <span className="stat-foot">enrolled in your courses</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Courses</span>
              <span className="stat-value">{data.stats.courses}</span>
              <span className="stat-foot">you're teaching</span>
            </div>
            <div className="card stat">
              <span className="stat-label">This week</span>
              <span className="stat-value">{data.stats.sessionsThisWeek}</span>
              <span className="stat-foot">sessions held</span>
            </div>
          </div>

          <section>
            <div className="section-head">
              <h2>Your courses</h2>
            </div>
            {data.courses.length === 0 ? (
              <div className="card">
                <Empty
                  icon="book"
                  title="No courses yet"
                  action={
                    <button className="btn btn-primary" onClick={() => setCreating(true)}>
                      <Icon name="plus" /> Create your first course
                    </button>
                  }
                >
                  Create a course, share its join code with your class, then start a session to take attendance.
                </Empty>
              </div>
            ) : (
              <div className="course-grid">
                {data.courses.map((c) => (
                  <article key={c.id} className={`card course-card ${c.activeSessionId ? "is-live" : ""}`}>
                    <Link to={`/teacher/courses/${c.id}`} className="course-card-link" aria-label={`Open ${c.code}`} />
                    <div className="course-card-top">
                      <div>
                        <span className="course-code">{c.code}</span>
                        <h3>{c.name}</h3>
                      </div>
                      <Ring rate={c.rate} size={58} stroke={6} />
                    </div>
                    <div className="course-card-meta">
                      <span>
                        <Icon name="users" /> {c.studentCount} students
                      </span>
                      <span>
                        <Icon name="calendar" /> {c.sessionCount} sessions
                      </span>
                      {c.lastSessionAt && (
                        <span>
                          <Icon name="clock" /> {relative(c.lastSessionAt)}
                        </span>
                      )}
                    </div>
                    <div className="course-card-foot">
                      <span className="hint">
                        Join code <span className="code-chip">{c.joinCode}</span>
                      </span>
                      {c.activeSessionId ? (
                        <button className="btn btn-sm btn-primary" onClick={() => navigate(`/teacher/sessions/${c.activeSessionId}`)}>
                          <span className="live-dot" /> Open live session
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-ink" onClick={() => setStarting(c)}>
                          <Icon name="qr" /> Start session
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {data.courses.length > 0 && (
            <div className="split">
              <section className="card">
                <div className="card-head">
                  <h2>Recent sessions</h2>
                  <span className="hint">attendance rate per session</span>
                </div>
                <div className="card-pad">
                  <BarChart
                    empty="Run your first session to see trends here."
                    data={data.trend.map((s) => ({
                      key: s.id,
                      label: fmtShort(s.startedAt),
                      value: s.rate,
                      tip: `${s.courseCode} · ${fmtShort(s.startedAt)} · ${s.present}/${s.expected} (${fmtRate(s.rate)})`,
                    }))}
                  />
                </div>
                {data.recentSessions.length > 0 && (
                  <ul className="list">
                    {data.recentSessions.map((s) => (
                      <li key={s.id}>
                        <Link to={`/teacher/sessions/${s.id}`} className="list-row">
                          <span className="course-code">{s.courseCode}</span>
                          <span className="list-main">
                            <strong>{s.title ?? s.courseName}</strong>
                            <small>{fmtDateTime(s.startedAt)}</small>
                          </span>
                          {!s.endedAt && <span className="badge badge-live">Live</span>}
                          <span className="num hint">
                            {s.present}/{s.expected}
                          </span>
                          <RateBadge rate={s.rate} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Needs attention</h2>
                  <span className="hint">below 75%</span>
                </div>
                {data.atRisk.length === 0 ? (
                  <Empty icon="check" title="Everyone's on track">
                    No student is below 75% attendance after three or more sessions.
                  </Empty>
                ) : (
                  <ul className="list">
                    {data.atRisk.map((s) => (
                      <li key={`${s.courseId}-${s.id}`}>
                        <Link to={`/teacher/courses/${s.courseId}`} className="list-row">
                          <Avatar name={s.name} size={32} />
                          <span className="list-main">
                            <strong>{s.name}</strong>
                            <small>
                              {s.courseCode} · {s.attended} of {s.total} sessions
                            </small>
                          </span>
                          <RateBadge rate={s.rate} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      ) : null}

      {creating && (
        <NewCourseModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/teacher/courses/${id}`);
          }}
        />
      )}
      {starting && <StartSessionModal course={starting} onClose={() => setStarting(null)} />}
    </div>
  );
}
