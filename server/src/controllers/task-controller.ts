import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../errors.js";
import { TaskService } from "../services/task-service.js";

function parseId(value: string | string[]): number {
  if (Array.isArray(value) || !/^\d+$/.test(value)) {
    throw new ValidationError("รหัสงานไม่ถูกต้อง");
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ValidationError("รหัสงานไม่ถูกต้อง");
  }
  return id;
}

export class TaskController {
  constructor(private readonly service: TaskService) {}

  list = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json(
        this.service.list({
          search: request.query.search,
          status: request.query.status,
          dueDate: request.query.dueDate,
          referenceDate: request.query.referenceDate,
          page: request.query.page,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  create = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.status(201).json({ item: this.service.create(request.body) });
    } catch (error) {
      next(error);
    }
  };

  update = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json({ item: this.service.update(parseId(request.params.id ?? ""), request.body) });
    } catch (error) {
      next(error);
    }
  };

  delete = (request: Request, response: Response, next: NextFunction): void => {
    try {
      this.service.delete(parseId(request.params.id ?? ""));
      response.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };
}
