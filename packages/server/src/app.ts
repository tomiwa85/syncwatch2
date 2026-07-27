import Fastify from "fastify";
import cors from "@fastify/cors";
import { isAllowedOrigin } from "./config/cors.js";
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

  app.get("/api/health", async () => ({ ok: true }));

  return app;
}
