# EduMark

Smart QR attendance for classrooms. Teachers put a rotating code on the projector, students scan it with their phone, and the register fills itself in live.

## Features

- **Rotating, signed QR codes.** Each code is an HMAC-signed token bound to one class session and a 15–30 second window, so screenshots shared outside the room stop working almost immediately.
- **Classroom geofence.** Optionally pin a session to the teacher's location with a 50–500 m radius. The server checks each student's distance before accepting a scan.
- **Live register.** Scans appear on the teacher's screen instantly over WebSockets. Teachers can mark students present or absent by hand, during or after class.
- **Courses and join codes.** Teachers create courses and share a 6-character join code. Students join from their dashboard.
- **Analytics.** Per-session and per-student attendance rates, trends, and a "needs attention" list of students under 75%.
- **CSV export.** A full register per course with every session, student and rate.
- **Teacher and student portals**, a presentation (fullscreen) mode for the projector, light and dark themes, and a mobile-first student experience.

## Stack

| Part | Tech |
| --- | --- |
| Web app (`web/`) | React 18, TypeScript, Vite, React Router, hand-written CSS design system, `qr-scanner` for the camera |
| API (`server/`) | Node.js, Express, TypeScript, Prisma, PostgreSQL, Socket.IO, Zod |
| Auth | bcrypt password hashes, JWT in an httpOnly cookie |
| Hosting | API + Postgres on Render, website on Cloudflare Workers (the Worker proxies `/api` so cookies stay first-party) |

## Run it locally

You need Node 20+ and a PostgreSQL database.

```bash
# 1. API
cd server
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev          # creates the tables
npm run db:seed                 # optional demo data
npm run dev                     # http://localhost:4000

# 2. Web app (new terminal)
cd web
npm install
npm run dev                     # http://localhost:5173, proxies /api to :4000
```

Demo accounts after seeding (password `password123`): `teacher@edumark.com`, `teacher2@edumark.com`, `student@edumark.com`, `student2@edumark.com`.

Camera and location need a secure context. `localhost` counts as secure; to test on a phone, use an HTTPS tunnel or deploy.

## Deploy

### 1. API and database on Render

1. In Render, choose **New → Blueprint** and pick this repository. It reads `render.yaml` and creates `edumark-api` and the `edumark-db` Postgres database. `JWT_SECRET` is generated for you.
2. When asked, set `CORS_ORIGINS` to your website URL (you can fill it in after step 2).
3. Once deployed, note the API URL, e.g. `https://edumark-api.onrender.com`. Check `https://…/api/health` returns `{"ok":true}`.
4. Optional: to load the demo accounts and sample data, set `SEED_DEMO` to `true` in the service's Environment settings and redeploy. It resets only the demo accounts.

### 2. Website on Cloudflare Workers

1. In Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick this repository.
2. Keep the defaults: build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`.
3. Deploy. `wrangler.jsonc` serves the built app from `web/dist` and runs `web/worker.ts`, which forwards `/api/*` and the WebSocket to Render. If your API URL differs, change `API_ORIGIN` in `wrangler.jsonc`.

Free Render services sleep after 15 minutes without traffic, so the first request after a pause can take up to a minute. A paid instance avoids this.

## Project layout

```
server/
  prisma/schema.prisma     data model (users, courses, enrollments, sessions, attendance)
  prisma/seed.ts           demo data
  src/routes/              auth, teacher and student endpoints
  src/lib/qr.ts            rotating token signing and checks
  src/lib/realtime.ts      Socket.IO, teacher-only session rooms
web/
  src/pages/               landing, auth, teacher and student screens
  src/components/          design-system components, QR renderer, app shell
  src/styles/              tokens, base, components, layout
  worker.ts                Cloudflare Worker: serves the app, proxies /api
render.yaml                Render blueprint
wrangler.jsonc             Cloudflare Worker config
```

## Tests

```bash
cd server && npm test
```
