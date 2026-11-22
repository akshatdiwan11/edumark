import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/AppShell";
import { Icon } from "../../components/Icon";
import { Avatar, BarChart, Empty, ErrorBox, Meter, Modal, PageLoading, RateBadge, Ring, Spinner, useToast } from "../../components/ui";
import { StartSessionModal } from "../../components/teacher";
import { useApi } from "../../lib/useApi";
import { API_BASE, api, errorMessage } from "../../lib/api";
import { duration, fmtDate, fmtRate, fmtShort, fmtTime } from "../../lib/format";
import type { CourseDetail, RosterStudent } from "../../lib/types";

type Tab = "students" | "sessions";

export function TeacherCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ course: CourseDetail }>(`/teacher/courses/${id}`);
  const [tab, setTab] = useState<Tab>("students");
  const [starting, setStarting] = useState(false);
  const [removing, setRemoving] = useState<RosterStudent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const course = data?.course;
  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!course) return [];
    return q ? course.students.filter((s) => `${s.name} ${s.email} ${s.rollNumber ?? ""}`.toLowerCase().includes(q)) : course.students;
  }, [course, query]);

  if (!course && loading) return <PageLoading />;
  if (!course) return <div className="page">{error && <ErrorBox message={error} onRetry={reload} />}</div>;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(course.joinCode);
      toast("Join code copied.");
    } catch {
      toast(`Join code: ${course.joinCode}`, "info");
    }
  };

  const regenerate = async () => {
    try {
      await api(`/teacher/courses/${course.id}/join-code`, { method: "POST" });
      await reload();
      toast("New join code created. The old one no longer works.");
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  const removeStudent = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/teacher/courses/${course.id}/students/${removing.id}`, { method: "DELETE" });
      toast(`${removing.name} removed from ${course.code}.`);
      setRemoving(null);
      await reload();
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  const deleteCourse = async () => {
    setBusy(true);
    try {
      await api(`/teacher/courses/${course.id}`, { method: "DELETE" });
      toast(`${course.code} deleted.`);
      navigate("/teacher", { replace: true });
    } catch (e) {
      toast(errorMessage(e), "bad");
      setBusy(false);
    }
  };

  const chronological = [...course.sessions].reverse().slice(-20);

  return (
    <div className="page">
      <Link to="/teacher" className="back-link">
        <Icon name="arrowLeft" /> Overview
      </Link>
      <PageHeader
        eyebrow={<span className="course-code">{course.code}</span>}
        title={course.name}
        actions={
          <>
            <a className="btn" href={`${API_BASE}/api/teacher/courses/${course.id}/export.csv`} download>
              <Icon name="download" /> Export
            </a>
            {course.activeSessionId ? (
              <Link className="btn btn-primary" to={`/teacher/sessions/${course.activeSessionId}`}>
                <span className="live-dot" /> Open live session
              </Link>
            ) : (
              <button className="btn btn-primary" onClick={() => setStarting(true)}>
                <Icon name="qr" /> Start session
              </button>
            )}
          </>
        }
      />

      <div className="course-summary">
        <div className="card card-pad course-summary-rate">
          <Ring rate={course.rate} size={96} stroke={9} />
          <div>
            <span className="stat-label">Course attendance</span>
            <p className="course-summary-line">
              {course.students.length} students · {course.sessions.length} sessions
            </p>
          </div>
        </div>
        <div className="card card-pad joincode-card">
          <span className="stat-label">Join code</span>
          <div className="joincode">
            <span>{course.joinCode}</span>
            <button className="icon-btn" onClick={copyCode} aria-label="Copy join code" title="Copy">
              <Icon name="copy" />
            </button>
            <button className="icon-btn" onClick={regenerate} aria-label="Make a new join code" title="New code">
              <Icon name="refresh" />
            </button>
          </div>
          <p className="hint">Students enter this on their dashboard to join.</p>
        </div>
        <div className="card card-pad course-summary-chart">
          <span className="stat-label">Last {chronological.length} sessions</span>
          <BarChart
            empty="No sessions yet."
            data={chronological.map((s) => ({ key: s.id, label: "", value: s.rate, tip: `${fmtShort(s.startedAt)} · ${fmtRate(s.rate)}` }))}
          />
        </div>
      </div>

      <section className="card">
        <div className="card-head tabs-head">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "students"} onClick={() => setTab("students")}>
              Students <span className="tab-count">{course.students.length}</span>
            </button>
            <button role="tab" aria-selected={tab === "sessions"} onClick={() => setTab("sessions")}>
              Sessions <span className="tab-count">{course.sessions.length}</span>
            </button>
          </div>
          {tab === "students" && course.students.length > 0 && (
            <input className="input input-search" placeholder="Search students" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search students" />
          )}
        </div>

        {tab === "students" &&
          (course.students.length === 0 ? (
            <Empty icon="users" title="No students yet">
              Share the join code <span className="code-chip">{course.joinCode}</span> with your class. Students appear here as soon as they join.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll no.</th>
                    <th>Attended</th>
                    <th style={{ width: "28%" }}>Rate</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <Avatar name={s.name} size={32} />
                          <div>
                            <div className="person-name">{s.name}</div>
                            <div className="person-sub">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="num">{s.rollNumber ?? "–"}</td>
                      <td className="num">
                        {s.attended} / {s.total}
                      </td>
                      <td>
                        <div className="rate-cell">
                          <Meter rate={s.rate} />
                          <RateBadge rate={s.rate} />
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="icon-btn" onClick={() => setRemoving(s)} aria-label={`Remove ${s.name}`} title="Remove from course">
                          <Icon name="trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="hint" style={{ textAlign: "center", padding: 28 }}>
                        No students match “{query}”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}

        {tab === "sessions" &&
          (course.sessions.length === 0 ? (
            <Empty
              icon="calendar"
              title="No sessions yet"
              action={
                <button className="btn btn-primary" onClick={() => setStarting(true)}>
                  <Icon name="qr" /> Start the first session
                </button>
              }
            >
              Each session gets its own rotating QR code and register.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Topic</th>
                    <th>Length</th>
                    <th>Present</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {course.sessions.map((s) => (
                    <tr key={s.id} className="row-link" onClick={() => navigate(`/teacher/sessions/${s.id}`)}>
                      <td>
                        <Link to={`/teacher/sessions/${s.id}`} className="person-name" onClick={(e) => e.stopPropagation()}>
                          {fmtDate(s.startedAt)}
                        </Link>
                        <div className="person-sub">{fmtTime(s.startedAt)}</div>
                      </td>
                      <td>
                        {s.title ?? <span className="hint">–</span>}
                        {s.geofenced && (
                          <span className="badge" style={{ marginLeft: 8 }} title="Geofenced">
                            <Icon name="pin" width={12} height={12} /> Geofenced
                          </span>
                        )}
                      </td>
                      <td className="num">{s.endedAt ? duration(s.startedAt, s.endedAt) : <span className="badge badge-live">Live</span>}</td>
                      <td className="num">
                        {s.present} / {s.expected}
                      </td>
                      <td>
                        <RateBadge rate={s.rate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <section className="danger-zone">
        <div>
          <strong>Delete this course</strong>
          <p className="hint">Removes the course, its sessions and every attendance record. This can't be undone.</p>
        </div>
        <button className="btn btn-danger" onClick={() => setDeleting(true)}>
          <Icon name="trash" /> Delete course
        </button>
      </section>

      {starting && <StartSessionModal course={course} onClose={() => setStarting(false)} />}
      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          description={`They'll lose access to ${course.code}. Their past attendance records stay in the register.`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={removeStudent} disabled={busy}>
                {busy ? <Spinner /> : "Remove student"}
              </button>
            </>
          }
        />
      )}
      {deleting && (
        <Modal
          title={`Delete ${course.code}?`}
          description="This permanently deletes the course, all of its sessions and every attendance record."
          onClose={() => setDeleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(false)}>
                Keep course
              </button>
              <button className="btn btn-danger" onClick={deleteCourse} disabled={busy}>
                {busy ? <Spinner /> : "Delete permanently"}
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
