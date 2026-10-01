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

  // Also touches the database so a ping wakes Neon (it suspends when idle), not
  // just this process — otherwise the first sign-in after a quiet spell still
  // pays the DB wake-up even when the server itself is warm.
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
