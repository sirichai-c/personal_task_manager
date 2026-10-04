import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../errors.js";
import { TaskService } from "../services/task-service.js";

function parseId(value: string | string[], message = "รหัสงานไม่ถูกต้อง"): number {
  if (Array.isArray(value) || !/^\d+$/.test(value)) {
    throw new ValidationError(message);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ValidationError(message);
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
          priority: request.query.priority,
          tag: request.query.tag,
          sort: request.query.sort,
          referenceDate: request.query.referenceDate,
          page: request.query.page,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  listReminders = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json(this.service.listReminders(request.query.referenceDate));
    } catch (error) {
      next(error);
    }
  };

  dismissReminder = (request: Request, response: Response, next: NextFunction): void => {
    try {
      this.service.dismissReminder(parseId(request.params.id ?? ""));
      response.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };

  listCalendar = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json(this.service.listCalendar(request.query.month));
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
      const result = this.service.update(parseId(request.params.id ?? ""), request.body);
      response.json({
        item: result.task,
        ...(result.nextTask ? { nextItem: result.nextTask } : {}),
      });
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

  createSubtask = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.status(201).json({
        item: this.service.createSubtask(parseId(request.params.id ?? ""), request.body),
      });
    } catch (error) {
      next(error);
    }
  };

  updateSubtask = (request: Request, response: Response, next: NextFunction): void => {
    try {
      response.json({
        item: this.service.updateSubtask(
          parseId(request.params.id ?? ""),
          parseId(request.params.subtaskId ?? "", "รหัสรายการย่อยไม่ถูกต้อง"),
          request.body,
        ),
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSubtask = (request: Request, response: Response, next: NextFunction): void => {
    try {
      this.service.deleteSubtask(
        parseId(request.params.id ?? ""),
        parseId(request.params.subtaskId ?? "", "รหัสรายการย่อยไม่ถูกต้อง"),
      );
      response.sendStatus(204);
    } catch (error) {
      next(error);
    }
  };
}
