import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/db.js";
import { clearSessionCookie, requireAuth, setSessionCookie, signSession } from "../lib/auth.js";
import { conflict, handle, unauthorized } from "../lib/errors.js";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });

const publicUser = { id: true, name: true, email: true, role: true, rollNumber: true } as const;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  role: z.enum(["TEACHER", "STUDENT"]),
  rollNumber: z.string().trim().max(32).optional().or(z.literal("").transform(() => undefined)),
});

authRouter.post(
  "/register",
  limiter,
  handle(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw conflict("An account with this email already exists.", "EMAIL_TAKEN");
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        rollNumber: input.role === "STUDENT" ? input.rollNumber : null,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: publicUser,
    });
    setSessionCookie(res, signSession(user));
    res.status(201).json({ user });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  role: z.enum(["TEACHER", "STUDENT"]).optional(),
});

authRouter.post(
  "/login",
  limiter,
  handle(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Same message for unknown email and wrong password, so accounts can't be probed.
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw unauthorized("That email and password don't match.");
    }
    if (input.role && input.role !== user.role) {
      throw unauthorized(`This is a ${user.role.toLowerCase()} account. Switch the role above and try again.`);
    }
    setSessionCookie(res, signSession(user));
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber } });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  handle(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: publicUser });
    if (!user) throw unauthorized();
    res.json({ user });
  }),
);
