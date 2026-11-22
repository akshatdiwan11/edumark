import http from "node:http";
import { env } from "./lib/env.js";
import { createApp } from "./app.js";
import { attachRealtime } from "./lib/realtime.js";
import { prisma } from "./lib/db.js";

const server = http.createServer(createApp());
attachRealtime(server);

server.listen(env.PORT, () => {
  console.log(`EduMark API listening on :${env.PORT}`);
});

const shutdown = () => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
