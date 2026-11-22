import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Spinner, useToast } from "./ui";
import { Icon } from "./Icon";
import { api, errorMessage } from "../lib/api";

export function NewCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ course: { id: string; code: string } }>("/teacher/courses", { body: { code, name } });
      toast(`${r.course.code} created. Share its join code with your students.`);
      onCreated(r.course.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="New course" description="Students join with a code you'll get on the next screen." onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div className="field">
          <label htmlFor="c-code">Course code</label>
          <input id="c-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS301" maxLength={16} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="c-name">Course name</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures & Algorithms" maxLength={80} />
        </div>
        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || code.trim().length < 2 || name.trim().length < 2}>
            {busy ? <Spinner /> : "Create course"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type GeoState = { status: "off" } | { status: "locating" } | { status: "ready"; latitude: number; longitude: number; accuracy: number } | { status: "error"; message: string };

export function StartSessionModal({ course, onClose }: { course: { id: string; code: string; name: string }; onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [rotateSeconds, setRotate] = useState(20);
  const [geo, setGeo] = useState<GeoState>({ status: "off" });
  const [radius, setRadius] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGeo = (on: boolean) => {
    if (!on) return setGeo({ status: "off" });
    if (!("geolocation" in navigator)) return setGeo({ status: "error", message: "This browser can't share your location." });
    setGeo({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo({ status: "ready", latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        setGeo({
          status: "error",
          message: e.code === e.PERMISSION_DENIED ? "Location permission was denied. Allow it in your browser to use a geofence." : "Couldn't get your location. Try again.",
        }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ session: { id: string } }>(`/teacher/courses/${course.id}/sessions`, {
        body: {
          title: title.trim() || undefined,
          rotateSeconds,
          geofence: geo.status === "ready" ? { latitude: geo.latitude, longitude: geo.longitude, radiusMeters: radius } : null,
        },
      });
      navigate(`/teacher/sessions/${r.session.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Start ${course.code}`}
      description={course.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={start} disabled={busy || geo.status === "locating"}>
            {busy ? <Spinner /> : (
              <>
                <Icon name="qr" /> Start session
              </>
            )}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="s-title">
          Topic <span className="hint">(optional)</span>
        </label>
        <input id="s-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 14: Heaps" maxLength={80} />
      </div>
      <div className="field">
        <span className="label">Code refreshes every</span>
        <div className="segmented" role="group" aria-label="Code refresh interval">
          {[15, 20, 30].map((s) => (
            <button type="button" key={s} aria-pressed={rotateSeconds === s} onClick={() => setRotate(s)}>
              {s} seconds
            </button>
          ))}
        </div>
      </div>
      <div className="geo-box">
        <label className="switch">
          <input type="checkbox" checked={geo.status !== "off" && geo.status !== "error"} onChange={(e) => toggleGeo(e.target.checked)} />
          Only accept students near me
        </label>
        {geo.status === "locating" && (
          <p className="hint geo-line">
            <Spinner /> Finding your location…
          </p>
        )}
        {geo.status === "ready" && (
          <>
            <p className="hint geo-line">
              <Icon name="pin" /> Location set (accurate to about {Math.round(geo.accuracy)} m)
            </p>
            <div className="segmented" role="group" aria-label="Geofence radius">
              {[50, 100, 200, 500].map((r) => (
                <button type="button" key={r} aria-pressed={radius === r} onClick={() => setRadius(r)}>
                  {r} m
                </button>
              ))}
            </div>
          </>
        )}
        {geo.status === "error" && <p className="field-error">{geo.message}</p>}
      </div>
      {error && (
        <div className="alert" role="alert">
          <Icon name="alert" /> {error}
        </div>
      )}
    </Modal>
  );
}
