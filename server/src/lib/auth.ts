import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { env, isProd } from "./env.js";
import { forbidden, unauthorized } from "./errors.js";

export const COOKIE_NAME = "edumark_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signSession(user: AuthUser) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifySession(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || (payload.role !== "TEACHER" && payload.role !== "STUDENT")) return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd || env.COOKIE_SAMESITE === "none",
    sameSite: env.COOKIE_SAMESITE,
    maxAge: MAX_AGE_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd || env.COOKIE_SAMESITE === "none",
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
  });
}

export function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = verifySession(req.cookies?.[COOKIE_NAME]);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
}

export const requireRole =
  (role: Role) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) return next(forbidden());
    next();
  };
