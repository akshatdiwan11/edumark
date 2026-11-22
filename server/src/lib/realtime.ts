import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { prisma } from "./db.js";
import { COOKIE_NAME, readCookie, verifySession } from "./auth.js";
import { env } from "./env.js";

let io: Server | null = null;

export const sessionRoom = (id: string) => `session:${id}`;

export function attachRealtime(server: HttpServer) {
  io = new Server(server, {
    path: "/api/socket.io",
    cors: { origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()), credentials: true },
  });

  io.use((socket, next) => {
    const user = verifySession(readCookie(socket.handshake.headers.cookie, COOKIE_NAME));
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    // Only the teacher who owns a session may watch its live feed.
    socket.on("session:watch", async (sessionId: unknown, ack?: (ok: boolean) => void) => {
      const user = socket.data.user;
      if (typeof sessionId !== "string" || user.role !== "TEACHER") return ack?.(false);
      const session = await prisma.classSession.findFirst({
        where: { id: sessionId, course: { teacherId: user.id } },
        select: { id: true },
      });
      if (!session) return ack?.(false);
      await socket.join(sessionRoom(sessionId));
      ack?.(true);
    });
    socket.on("session:unwatch", (sessionId: unknown) => {
      if (typeof sessionId === "string") void socket.leave(sessionRoom(sessionId));
    });
  });

  return io;
}

export function emitToSession(sessionId: string, event: string, payload: unknown) {
  io?.to(sessionRoom(sessionId)).emit(event, payload);
}
