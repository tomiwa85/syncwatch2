import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuthError, verifyAccessToken } from "./auth.service.js";

export default fp(async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      return reply.code(401).send({ message: "Missing access token" });
    }
    try {
      const { userId } = verifyAccessToken(token);
      request.userId = userId;
    } catch (err) {
      if (err instanceof AuthError || err) {
        return reply.code(401).send({ message: "Invalid or expired access token" });
      }
    }
  });
});
