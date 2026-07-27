import type { FastifyInstance } from "fastify";
import { createRoomRequestSchema } from "@syncwatch/shared";
import { RoomError, createRoom, getRoomByCode, joinRoom, listPublicRooms } from "./rooms.service.js";

export async function roomRoutes(app: FastifyInstance) {
  // All room routes require a valid access token.
  app.addHook("preHandler", app.authenticate);

  app.post("/api/rooms", async (request, reply) => {
    const body = createRoomRequestSchema.parse(request.body);
    const room = await createRoom(request.userId!, body.visibility);
    return reply.code(201).send({ room });
  });

  app.get("/api/rooms", async (request, reply) => {
    const query = request.query as { visibility?: string };
    if (query.visibility !== "public") {
      return reply.code(400).send({ message: "Only visibility=public is supported" });
    }
    const rooms = await listPublicRooms();
    return reply.send({ rooms });
  });

  app.get<{ Params: { code: string } }>("/api/rooms/:code", async (request, reply) => {
    try {
      const room = await getRoomByCode(request.params.code.toUpperCase());
      return reply.send({ room });
    } catch (err) {
      if (err instanceof RoomError) return reply.code(err.status).send({ message: err.message });
      throw err;
    }
  });

  app.post<{ Params: { code: string } }>("/api/rooms/:code/join", async (request, reply) => {
    try {
      const room = await joinRoom(request.userId!, request.params.code.toUpperCase());
      return reply.send({ room });
    } catch (err) {
      if (err instanceof RoomError) return reply.code(err.status).send({ message: err.message });
      throw err;
    }
  });
}
