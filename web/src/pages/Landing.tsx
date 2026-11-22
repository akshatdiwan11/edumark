import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Icon, type IconName } from "../components/Icon";
import { QrCode } from "../components/QrCode";
import { Avatar } from "../components/ui";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth, homeFor } from "../lib/auth";

const demoNames = ["Ananya Iyer", "Kabir Mehta", "Sara Khan", "Rohan Das", "Tara Bose", "Ishita Rao", "Vikram Nair"];

/** A small, self-running preview of the live classroom screen. */
function LivePreview() {
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(6);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setTick((t) => t + 1);
          return 6;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const shown = Math.min(demoNames.length, 2 + (tick % (demoNames.length - 1)));
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-bar">
        <span className="badge badge-live">Live</span>
        <span className="preview-title">CS301 · Data Structures</span>
        <span className="preview-count">
          <strong>{shown}</strong>/12
        </span>
      </div>
      <div className="preview-body">
        <div className="preview-qr">
          <QrCode value={`EDM1.preview.${tick}.edumark-demo-code`} size={190} />
          <div className="preview-timer">
            <span style={{ width: `${(seconds / 6) * 100}%` }} />
          </div>
          <span className="hint">New code in {seconds}s</span>
        </div>
        <ul className="preview-feed">
          {demoNames.slice(0, shown).reverse().map((n, i) => (
            <li key={n} className={i === 0 ? "fresh" : ""}>
              <Avatar name={n} size={28} />
              <span>{n}</span>
              <Icon name="check" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const features: { icon: IconName; title: string; body: string }[] = [
  { icon: "refresh", title: "Codes that won't travel", body: "The code on screen changes every 20 seconds and is signed by the server, so a photo sent to a friend is already useless." },
  { icon: "pin", title: "Classroom geofence", body: "Optionally pin the session to where you're standing. Students more than your chosen distance away can't check in." },
  { icon: "pulse", title: "Live roll call", body: "Names appear on your screen the moment students scan. Mark anyone in by hand if their phone gives up." },
  { icon: "chart", title: "Attendance you can read", body: "Per-session and per-student rates, trends over time, and a list of students falling under 75%." },
  { icon: "download", title: "One-click export", body: "Download a full register as a spreadsheet, with every session, every student and their rate." },
  { icon: "shield", title: "Private by design", body: "Passwords are hashed, sessions live in secure cookies, and students only ever see their own records." },
];

export function Landing() {
  const { user } = useAuth();
  const cta = user ? { to: homeFor(user.role), label: "Open your dashboard" } : { to: "/register", label: "Create a free account" };

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <div className="landing-nav-right">
          <ThemeToggle />
          {user ? (
            <Link className="btn btn-ink btn-sm" to={homeFor(user.role)}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-ink btn-sm" to="/register">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow-pill">
            <Icon name="qr" /> QR attendance for real classrooms
          </span>
          <h1>
            Take the register in the time it takes to say <em>“present.”</em>
          </h1>
          <p className="lede">
            Put a code on the projector. Students scan it with their phone. Your register fills itself in, and nobody can mark a friend from the canteen.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to={cta.to}>
              {cta.label} <Icon name="arrowRight" />
            </Link>
            {!user && (
              <Link className="btn btn-lg" to="/login">
                Try the demo
              </Link>
            )}
          </div>
          <ul className="hero-proof">
            <li>
              <Icon name="check" /> No app to install
            </li>
            <li>
              <Icon name="check" /> Works on any phone camera
            </li>
            <li>
              <Icon name="check" /> Free to use
            </li>
          </ul>
        </div>
        <LivePreview />
      </section>

      <section className="how" id="how">
        <h2>Three steps, about thirty seconds.</h2>
        <ol className="steps">
          <li>
            <span className="step-num">1</span>
            <h3>Start a session</h3>
            <p>Pick your course and press start. Turn on the geofence if you want students to be in the room.</p>
          </li>
          <li>
            <span className="step-num">2</span>
            <h3>Show the code</h3>
            <p>Put the rotating code on the projector. It refreshes on its own while you teach.</p>
          </li>
          <li>
            <span className="step-num">3</span>
            <h3>Watch names arrive</h3>
            <p>Every scan lands on your screen instantly and goes straight into the course register.</p>
          </li>
        </ol>
      </section>

      <section className="features" id="features">
        <div className="features-head">
          <h2>Built for the people at the front of the room.</h2>
          <p>Everything a teacher needs to stop calling names, and nothing they don't.</p>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="feature">
              <div className="feature-icon">
                <Icon name={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>Your next class could take attendance by itself.</h2>
          <p>Set up a course, share its join code, and you're ready before the bell.</p>
        </div>
        <Link className="btn btn-primary btn-lg" to={cta.to}>
          {cta.label} <Icon name="arrowRight" />
        </Link>
      </section>

      <footer className="landing-foot">
        <Logo />
        <p>© {new Date().getFullYear()} EduMark. Smart attendance for classrooms.</p>
      </footer>
    </div>
  );
}
