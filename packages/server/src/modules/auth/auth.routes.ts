import type { FastifyInstance } from "fastify";
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  signupRequestSchema,
} from "@syncwatch/shared";
import { AuthError, login, logout, refresh, signup } from "./auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (request, reply) => {
    const body = signupRequestSchema.parse(request.body);
    try {
      const result = await signup(body);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(409).send({ message: err.message });
      throw err;
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    try {
      const result = await login(body);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ message: err.message });
      throw err;
    }
  });

  app.post("/api/auth/refresh", async (request, reply) => {
    const body = refreshRequestSchema.parse(request.body);
    try {
      const result = await refresh(body.refreshToken);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ message: err.message });
      throw err;
    }
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const body = logoutRequestSchema.parse(request.body);
    await logout(body.refreshToken);
    return reply.code(204).send();
  });
}
