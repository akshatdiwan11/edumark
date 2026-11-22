import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QrScanner from "qr-scanner";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/ui";
import { ApiError, api, errorMessage } from "../../lib/api";
import { fmtTime } from "../../lib/format";

type Fix = { latitude: number; longitude: number; accuracy: number };
type Phase =
  | { kind: "scanning" }
  | { kind: "submitting"; note?: string }
  | { kind: "done"; status: "marked" | "already"; course: { code: string; name: string }; markedAt: string }
  | { kind: "error"; message: string; code?: string };

/** Pulls the attendance token out of whatever the camera saw: a scan URL or a bare token. */
function extractToken(raw: string) {
  const text = raw.trim();
  try {
    const url = new URL(text);
    return url.searchParams.get("t");
  } catch {
    return text.startsWith("EDM1.") ? text : null;
  }
}

/** Starts fetching a location fix as soon as the page opens, so it's ready by the time a code is scanned. */
function useLocation() {
  const fix = useRef<Fix | null>(null);
  const waiters = useRef<((f: Fix | null) => void)[]>([]);
  const failed = useRef(false);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      failed.current = true;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        fix.current = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
        waiters.current.splice(0).forEach((w) => w(fix.current));
      },
      () => {
        failed.current = true;
        waiters.current.splice(0).forEach((w) => w(null));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  useEffect(request, [request]);

  const waitForFix = useCallback(
    (timeoutMs = 12000) =>
      new Promise<Fix | null>((resolve) => {
        if (fix.current) return resolve(fix.current);
        if (failed.current) {
          failed.current = false;
          request();
        }
        waiters.current.push(resolve);
        window.setTimeout(() => resolve(fix.current), timeoutMs);
      }),
    [request],
  );

  return { current: fix, waitForFix };
}

export function StudentScan() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [camError, setCamError] = useState<string | null>(null);
  const location = useLocation();

  const submit = useCallback(
    async (token: string) => {
      if (busy.current) return;
      busy.current = true;
      scannerRef.current?.stop();
      setPhase({ kind: "submitting" });
      const send = (fix: Fix | null) =>
        api<{ status: "marked" | "already"; course: { code: string; name: string }; markedAt: string }>("/student/attendance/scan", {
          body: { token, ...(fix ?? {}) },
        });
      try {
        let result;
        try {
          // Give a just-requested location fix a moment to arrive before the first attempt.
          result = await send(location.current.current ?? (await location.waitForFix(1500)));
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== "LOCATION_REQUIRED") throw e;
          setPhase({ kind: "submitting", note: "This class checks location. Getting your position…" });
          const fix = await location.waitForFix();
          if (!fix) throw new ApiError(400, "This class needs your location. Allow location access for this site and scan again.", "LOCATION_REQUIRED");
          result = await send(fix);
        }
        setPhase({ kind: "done", ...result });
        navigator.vibrate?.(60);
      } catch (e) {
        setPhase({ kind: "error", message: errorMessage(e), code: e instanceof ApiError ? e.code : undefined });
      } finally {
        busy.current = false;
      }
    },
    [location],
  );

  // A code opened straight from the phone camera arrives as ?t=…
  useEffect(() => {
    const t = params.get("t");
    if (t) {
      setParams({}, { replace: true });
      void submit(t);
    }
  }, [params, setParams, submit]);

  // Camera scanner while we're in the scanning phase.
  useEffect(() => {
    if (phase.kind !== "scanning" || !videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const token = extractToken(result.data);
        if (token) void submit(token);
      },
      { preferredCamera: "environment", highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 8, returnDetailedScanResult: true },
    );
    scannerRef.current = scanner;
    scanner.start().then(
      () => setCamError(null),
      (e) =>
        setCamError(
          String(e).toLowerCase().includes("not found") || String(e).toLowerCase().includes("no camera")
            ? "No camera was found on this device."
            : "Camera access is blocked. Allow the camera for this site in your browser settings, or scan the code with your phone's camera app.",
        ),
    );
    return () => {
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [phase.kind, submit]);

  return (
    <div className="page scan-page">
      <Link to="/student" className="back-link">
        <Icon name="arrowLeft" /> My attendance
      </Link>

      {phase.kind === "scanning" && (
        <div className="scan-wrap">
          <div className="scan-head">
            <h1>Scan the class code</h1>
            <p className="page-header-sub">Point your camera at the code on your teacher's screen.</p>
          </div>
          <div className="viewfinder">
            <video ref={videoRef} muted playsInline />
            <div className="viewfinder-frame" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            {camError && (
              <div className="viewfinder-error">
                <Icon name="camera" />
                <p>{camError}</p>
              </div>
            )}
          </div>
          <p className="hint scan-tip">
            <Icon name="info" width={14} height={14} /> Codes change every few seconds, so scan the one on screen right now, not a photo.
          </p>
        </div>
      )}

      {phase.kind === "submitting" && (
        <div className="result card">
          <Spinner />
          <h2>Marking you present…</h2>
          {phase.note && <p className="hint">{phase.note}</p>}
        </div>
      )}

      {phase.kind === "done" && (
        <div className="result card result-good">
          <div className="result-icon">
            <svg viewBox="0 0 52 52" aria-hidden="true">
              <circle cx="26" cy="26" r="24" />
              <path d="M15 27l7 7 15-16" />
            </svg>
          </div>
          <h2>{phase.status === "marked" ? "You're marked present" : "You're already marked"}</h2>
          <p>
            <strong>{phase.course.code}</strong> · {phase.course.name}
          </p>
          <p className="hint">Recorded at {fmtTime(phase.markedAt)}</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/student")}>
            Done
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div className="result card result-bad">
          <div className="result-icon">
            <Icon name={phase.code === "OUT_OF_RANGE" || phase.code === "LOCATION_REQUIRED" ? "pin" : "alert"} />
          </div>
          <h2>
            {phase.code === "EXPIRED"
              ? "That code expired"
              : phase.code === "OUT_OF_RANGE"
                ? "You're too far from class"
                : phase.code === "NOT_ENROLLED"
                  ? "Not in this course"
                  : "Couldn't mark you present"}
          </h2>
          <p>{phase.message}</p>
          <div className="result-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setPhase({ kind: "scanning" })}>
              <Icon name="scan" /> Scan again
            </button>
            {phase.code === "NOT_ENROLLED" && (
              <Link className="btn btn-lg" to="/student">
                Join the course
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
