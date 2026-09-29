import { resolve } from "node:path";
import { createApplication } from "./app.js";

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

const host = process.env.HOST?.trim() || "127.0.0.1";
const port = readPort(process.env.PORT);
const databasePath = resolve(process.env.TASK_DB_PATH ?? resolve(process.cwd(), "data/tasks.sqlite"));
const application = createApplication({
  databasePath,
  clientDistPath: resolve(process.cwd(), "dist/client"),
});

const server = application.app.listen(port, host, () => {
  console.log(`Task manager is running at http://${host}:${port}`);
});

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  server.close(() => {
    application.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

