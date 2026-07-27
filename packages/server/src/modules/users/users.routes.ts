import type { FastifyInstance } from "fastify";
import { getUserHistory } from "../rooms/rooms.service.js";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/api/users/me/history", async (request) => {
    const entries = await getUserHistory(request.userId!);
    return { entries };
  });
}
