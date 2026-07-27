import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { attachSocketServer } from "./realtime/socket-server.js";

async function main() {
  const app = await buildApp();
  await app.ready();
  attachSocketServer(app.server);
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
