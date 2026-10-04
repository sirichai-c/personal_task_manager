export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, "VALIDATION_ERROR", message, fields);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "ไม่พบงานที่ต้องการ") {
    super(404, "TASK_NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class SubtaskNotFoundError extends AppError {
  constructor() {
    super(404, "SUBTASK_NOT_FOUND", "ไม่พบรายการย่อยที่ต้องการ");
    this.name = "SubtaskNotFoundError";
  }
}
