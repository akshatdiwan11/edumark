import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "Please sign in to continue.") => new HttpError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "You don't have access to this.") => new HttpError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "NOT_FOUND");
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);

/** Wraps an async route so rejected promises reach the error handler. */
export const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: { message: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.", code: "VALIDATION" },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: "Something went wrong on our side.", code: "INTERNAL" } });
}
