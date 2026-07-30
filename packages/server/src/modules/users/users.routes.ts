import type { FastifyInstance } from "fastify";
import { getUserHistory, hideHistoryEntry } from "../rooms/rooms.service.js";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/api/users/me/history", async (request) => {
    const entries = await getUserHistory(request.userId!);
    return { entries };
  });

  // "Delete" a single history item — hidden from this user's view only.
  app.delete<{ Params: { code: string } }>("/api/users/me/history/:code", async (request, reply) => {
    await hideHistoryEntry(request.userId!, request.params.code.toUpperCase());
    return reply.code(204).send();
  });
}
