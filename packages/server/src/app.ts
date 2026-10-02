import Fastify from "fastify";
import cors from "@fastify/cors";
import { isAllowedOrigin } from "./config/cors.js";
import { prisma } from "./db/prisma.js";
import authPlugin from "./modules/auth/auth.plugin.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { roomRoutes } from "./modules/rooms/rooms.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)) });
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(roomRoutes);
  await app.register(userRoutes);

  // Keep-alive target: proves the process is up WITHOUT touching the database.
  // Pinging the DB around the clock would keep Neon's compute running 24/7 and
  // burn its free monthly allowance; Neon wakes in under a second on its own.
  // logLevel "warn" keeps the every-10-minutes pings out of the request log.
  app.get("/api/ping", { logLevel: "warn" }, async () => ({ ok: true }));

  // Full health check (also wakes the DB). The app calls this once when it opens,
  // so the database is warm by the time the user signs in. Not for keep-alives.
  app.get("/api/health", async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      return { ok: true, db: false };
    }
  });

  return app;
}
