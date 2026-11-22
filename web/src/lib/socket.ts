import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;

/** One shared, lazily-opened realtime connection. Auth rides on the session cookie. */
export function getSocket() {
  if (!socket) {
    socket = io(API_BASE || undefined, { path: "/api/socket.io", withCredentials: true, transports: ["websocket", "polling"] });
  }
  return socket;
}
