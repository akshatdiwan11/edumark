import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./lib/env.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { teacherRouter } from "./routes/teacher.js";
import { studentRouter } from "./routes/student.js";
import { prisma } from "./lib/db.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()), credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  if (env.NODE_ENV !== "test") app.use(morgan(isProd ? "combined" : "dev"));

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/teacher", teacherRouter);
  app.use("/api/student", studentRouter);
  app.use("/api", (_req, _res, next) => next(notFound("No such endpoint.")));
  app.use(errorHandler);
  return app;
}
