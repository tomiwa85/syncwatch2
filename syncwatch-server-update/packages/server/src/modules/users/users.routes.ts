import type { FastifyInstance } from "fastify";
import { deleteUserAccount, getUserHistory, hideHistoryEntry, listHostedRooms } from "../rooms/rooms.service.js";

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

  // Rooms the user is currently hosting.
  app.get("/api/users/me/rooms", async (request) => {
    const rooms = await listHostedRooms(request.userId!);
    return { rooms };
  });

  // Delete the account and scrub all of the user's data. Irreversible.
  app.delete("/api/users/me", async (request, reply) => {
    await deleteUserAccount(request.userId!);
    return reply.code(204).send();
  });
}
