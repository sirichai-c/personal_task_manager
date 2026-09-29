import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { TaskController } from "./controllers/task-controller.js";
import { openDatabase } from "./db/database.js";
import { TaskRepository } from "./db/task-repository.js";
import { AppError } from "./errors.js";
import { createTaskRouter } from "./routes/task-routes.js";
import { TaskService } from "./services/task-service.js";

export interface ApplicationOptions {
  databasePath: string;
  clientDistPath?: string;
  now?: () => Date;
}

export interface ApplicationHandle {
  app: express.Express;
  database: DatabaseSync;
  close: () => void;
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

export function createApplication(options: ApplicationOptions): ApplicationHandle {
  const database = openDatabase(options.databasePath);
  const repository = new TaskRepository(database);
  const service = new TaskService(repository, options.now);
  const controller = new TaskController(service);
  const app = express();

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/tasks", createTaskRouter(controller));

  if (options.clientDistPath) {
    const clientDistPath = resolve(options.clientDistPath);
    const indexPath = resolve(clientDistPath, "index.html");
    if (existsSync(indexPath)) {
      app.use(express.static(clientDistPath));
      app.use((request, response, next) => {
        if (request.method === "GET" && !request.path.startsWith("/api/")) {
          response.sendFile(indexPath);
          return;
        }
        next();
      });
    }
  }

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบเส้นทางที่ต้องการ" },
    });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    void _next;
    if (error instanceof AppError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
      return;
    }

    if (isJsonParseError(error)) {
      response.status(400).json({
        error: { code: "INVALID_JSON", message: "รูปแบบ JSON ไม่ถูกต้อง" },
      });
      return;
    }

    console.error("Unhandled request error", error);
    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "ระบบไม่สามารถทำรายการได้" },
    });
  });

  return {
    app,
    database,
    close: () => database.close(),
  };
}
