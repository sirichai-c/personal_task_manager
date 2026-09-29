import {
  DUE_DATE_FILTERS,
  PAGE_SIZE,
  TASK_PRIORITIES,
  TASK_SORTS,
  TASK_STATUSES,
  type DueDateFilter,
  type Task,
  type TaskList,
  type TaskPriority,
  type TaskSort,
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

function validatePriority(value: unknown): TaskPriority {
  if (typeof value !== "string" || !TASK_PRIORITIES.includes(value as TaskPriority)) {
    throw new ValidationError("ระดับความสำคัญไม่ถูกต้อง", {
      priority: "ระดับความสำคัญไม่ถูกต้อง",
    });
  }
  return value as TaskPriority;
}

function validateSort(value: unknown): TaskSort {
  if (typeof value !== "string" || !TASK_SORTS.includes(value as TaskSort)) {
    throw new ValidationError("ลำดับการแสดงผลไม่ถูกต้อง", {
      sort: "ลำดับการแสดงผลไม่ถูกต้อง",
    });
  }
  return value as TaskSort;
}

function validateTag(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("แท็กต้องเป็นข้อความ", { tags: "แท็กต้องเป็นข้อความ" });
  }
  const tag = value.trim();
  if (textLength(tag) < 1 || textLength(tag) > 30 || tag.includes(",")) {
    throw new ValidationError("แท็กต้องยาว 1–30 ตัวอักษรและไม่มีเครื่องหมายจุลภาค", {
      tags: "แท็กต้องยาว 1–30 ตัวอักษรและไม่มีเครื่องหมายจุลภาค",
    });
  }
  return tag;
}

function validateTags(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError("แท็กต้องเป็นรายการข้อความ", {
      tags: "แท็กต้องเป็นรายการข้อความ",
    });
  }
  if (value.length > 10) {
    throw new ValidationError("กำหนดแท็กได้ไม่เกิน 10 รายการ", {
      tags: "กำหนดแท็กได้ไม่เกิน 10 รายการ",
    });
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    const tag = validateTag(item);
    const normalized = tag.toLocaleLowerCase("th-TH");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }
  return tags;
}

function validateDate(value: unknown, field: "dueDate" | "referenceDate"): string {
  const message = field === "dueDate" ? "วันครบกำหนดไม่ถูกต้อง" : "วันที่อ้างอิงไม่ถูกต้อง";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(message, { [field]: message });
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(message, { [field]: message });
  }
  return value;
}

function validateDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return validateDate(value, "dueDate");
}

function validateDueDateFilter(value: unknown): DueDateFilter {
  if (typeof value !== "string" || !DUE_DATE_FILTERS.includes(value as DueDateFilter)) {
    throw new ValidationError("ตัวกรองวันครบกำหนดไม่ถูกต้อง", {
      dueDate: "ตัวกรองวันครบกำหนดไม่ถูกต้อง",
    });
  }
  return value as DueDateFilter;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekBounds(value: string): { start: string; end: string } {
  const date = new Date(`${value}T00:00:00.000Z`);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  const start = addDays(value, -dayFromMonday);
  return { start, end: addDays(start, 6) };
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
      dueDate: validateDueDate(record.dueDate),
      priority:
        record.priority === undefined ? "NORMAL" : validatePriority(record.priority),
      tags: validateTags(record.tags),
      now: this.now().toISOString(),
    });
  }

  list(input: {
    search?: unknown;
    status?: unknown;
    dueDate?: unknown;
    priority?: unknown;
    tag?: unknown;
    sort?: unknown;
    referenceDate?: unknown;
    page?: unknown;
  }): TaskList {
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
    const dueDate =
      input.dueDate === undefined ? undefined : validateDueDateFilter(input.dueDate);
    const priority =
      input.priority === undefined ? undefined : validatePriority(input.priority);
    const tag = input.tag === undefined ? undefined : validateTag(input.tag);
    const sort = input.sort === undefined ? "CREATED_DESC" : validateSort(input.sort);
    const referenceDate =
      input.referenceDate === undefined
        ? this.now().toISOString().slice(0, 10)
        : validateDate(input.referenceDate, "referenceDate");
    const week = getWeekBounds(referenceDate);
    const page = input.page === undefined ? 1 : validatePage(input.page);
    const result = this.repository.list({
      page,
      pageSize: PAGE_SIZE,
      referenceDate,
      weekStart: week.start,
      weekEnd: week.end,
      sort,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(priority ? { priority } : {}),
      ...(tag ? { tag } : {}),
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

    const hasEditableField = [
      "title",
      "description",
      "status",
      "dueDate",
      "priority",
      "tags",
    ].some((field) => Object.hasOwn(record, field));
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
      dueDate: Object.hasOwn(record, "dueDate")
        ? validateDueDate(record.dueDate)
        : current.dueDate,
      priority: Object.hasOwn(record, "priority")
        ? validatePriority(record.priority)
        : current.priority,
      tags: Object.hasOwn(record, "tags") ? validateTags(record.tags) : current.tags,
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
