import {
  PAGE_SIZE,
  TASK_STATUSES,
  type Task,
  type TaskList,
  type TaskStatus,
} from "../domain/task.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { TaskRepository } from "../db/task-repository.js";

type InputRecord = Record<string, unknown>;

function textLength(value: string): number {
  return Array.from(value).length;
}

function asRecord(value: unknown): InputRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("ข้อมูลที่ส่งมาต้องเป็น object");
  }
  return value as InputRecord;
}

function validateTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("กรุณากรอกชื่องาน", { title: "กรุณากรอกชื่องาน" });
  }

  const title = value.trim();
  const length = textLength(title);
  if (length < 1) {
    throw new ValidationError("กรุณากรอกชื่องาน", { title: "กรุณากรอกชื่องาน" });
  }
  if (length > 120) {
    throw new ValidationError("ชื่องานต้องไม่เกิน 120 ตัวอักษร", {
      title: "ชื่องานต้องไม่เกิน 120 ตัวอักษร",
    });
  }
  return title;
}

function validateDescription(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string") {
    throw new ValidationError("รายละเอียดต้องเป็นข้อความ", {
      description: "รายละเอียดต้องเป็นข้อความ",
    });
  }
  if (textLength(value) > 2_000) {
    throw new ValidationError("รายละเอียดต้องไม่เกิน 2,000 ตัวอักษร", {
      description: "รายละเอียดต้องไม่เกิน 2,000 ตัวอักษร",
    });
  }
  return value;
}

function validateStatus(value: unknown): TaskStatus {
  if (typeof value !== "string" || !TASK_STATUSES.includes(value as TaskStatus)) {
    throw new ValidationError("สถานะงานไม่ถูกต้อง", { status: "สถานะงานไม่ถูกต้อง" });
  }
  return value as TaskStatus;
}

function validatePage(value: unknown): number {
  const page = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof page !== "number" || !Number.isSafeInteger(page) || page < 1) {
    throw new ValidationError("เลขหน้าต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป", {
      page: "เลขหน้าต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป",
    });
  }
  return page;
}

export class TaskService {
  constructor(
    private readonly repository: TaskRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(input: unknown): Task {
    const record = asRecord(input);
    return this.repository.create({
      title: validateTitle(record.title),
      description: validateDescription(record.description),
      status: "TODO",
      now: this.now().toISOString(),
    });
  }

  list(input: { search?: unknown; status?: unknown; page?: unknown }): TaskList {
    let search: string | undefined;
    if (input.search !== undefined) {
      if (typeof input.search !== "string") {
        throw new ValidationError("คำค้นหาต้องเป็นข้อความ");
      }
      const normalizedSearch = input.search.trim();
      if (textLength(normalizedSearch) > 120) {
        throw new ValidationError("คำค้นหาต้องไม่เกิน 120 ตัวอักษร");
      }
      search = normalizedSearch || undefined;
    }

    const status = input.status === undefined ? undefined : validateStatus(input.status);
    const page = input.page === undefined ? 1 : validatePage(input.page);
    const result = this.repository.list({
      page,
      pageSize: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

    return {
      items: result.items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalItems: result.totalItems,
        totalPages: Math.ceil(result.totalItems / PAGE_SIZE),
      },
    };
  }

  update(id: number, input: unknown): Task {
    const record = asRecord(input);
    const current = this.repository.findById(id);
    if (!current) {
      throw new NotFoundError();
    }

    const hasEditableField = ["title", "description", "status"].some((field) =>
      Object.hasOwn(record, field),
    );
    if (!hasEditableField) {
      throw new ValidationError("กรุณาระบุข้อมูลที่ต้องการแก้ไข");
    }

    const task = this.repository.update(id, {
      title: Object.hasOwn(record, "title") ? validateTitle(record.title) : current.title,
      description: Object.hasOwn(record, "description")
        ? validateDescription(record.description)
        : current.description,
      status: Object.hasOwn(record, "status")
        ? validateStatus(record.status)
        : current.status,
      now: this.now().toISOString(),
    });

    if (!task) {
      throw new NotFoundError();
    }
    return task;
  }

  delete(id: number): void {
    if (!this.repository.delete(id)) {
      throw new NotFoundError();
    }
  }
}

