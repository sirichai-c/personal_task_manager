import {
  DUE_DATE_FILTERS,
  MAX_SUBTASKS_PER_TASK,
  PAGE_SIZE,
  TASK_PRIORITIES,
  TASK_RECURRENCES,
  TASK_SORTS,
  TASK_STATUSES,
  type DueDateFilter,
  type Subtask,
  type Task,
  type TaskList,
  type TaskPriority,
  type TaskRecurrence,
  type TaskSort,
  type TaskStatus,
} from "../domain/task.js";
import { NotFoundError, SubtaskNotFoundError, ValidationError } from "../errors.js";
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

function validateSubtaskTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("กรุณากรอกชื่อรายการย่อย", {
      title: "กรุณากรอกชื่อรายการย่อย",
    });
  }
  const title = value.trim();
  if (textLength(title) < 1 || textLength(title) > 120) {
    throw new ValidationError("ชื่อรายการย่อยต้องยาว 1–120 ตัวอักษร", {
      title: "ชื่อรายการย่อยต้องยาว 1–120 ตัวอักษร",
    });
  }
  return title;
}

function validateCompleted(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError("สถานะรายการย่อยไม่ถูกต้อง", {
      completed: "สถานะรายการย่อยไม่ถูกต้อง",
    });
  }
  return value;
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

function validateRecurrence(value: unknown): TaskRecurrence {
  if (typeof value !== "string" || !TASK_RECURRENCES.includes(value as TaskRecurrence)) {
    throw new ValidationError("รอบการทำซ้ำไม่ถูกต้อง", {
      recurrence: "รอบการทำซ้ำไม่ถูกต้อง",
    });
  }
  return value as TaskRecurrence;
}

function validateRecurrenceDueDate(
  recurrence: TaskRecurrence,
  dueDate: string | null,
): void {
  if (recurrence !== "NONE" && !dueDate) {
    throw new ValidationError("งานที่ทำซ้ำต้องมีวันครบกำหนด", {
      dueDate: "กรุณากำหนดวันสำหรับงานที่ทำซ้ำ",
    });
  }
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

function getNextDueDate(
  dueDate: string,
  recurrence: Exclude<TaskRecurrence, "NONE">,
): string {
  if (recurrence === "DAILY") {
    return addDays(dueDate, 1);
  }
  if (recurrence === "WEEKLY") {
    return addDays(dueDate, 7);
  }

  const [year = 0, month = 0, day = 0] = dueDate.split("-").map(Number);
  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nextDate = new Date(Date.UTC(year, month, Math.min(day, lastDayOfNextMonth)));
  return nextDate.toISOString().slice(0, 10);
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
    const dueDate = validateDueDate(record.dueDate);
    const recurrence =
      record.recurrence === undefined ? "NONE" : validateRecurrence(record.recurrence);
    validateRecurrenceDueDate(recurrence, dueDate);
    return this.repository.create({
      title: validateTitle(record.title),
      description: validateDescription(record.description),
      status: "TODO",
      dueDate,
      priority:
        record.priority === undefined ? "NORMAL" : validatePriority(record.priority),
      tags: validateTags(record.tags),
      recurrence,
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

  update(id: number, input: unknown): { task: Task; nextTask: Task | null } {
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
      "recurrence",
    ].some((field) => Object.hasOwn(record, field));
    if (!hasEditableField) {
      throw new ValidationError("กรุณาระบุข้อมูลที่ต้องการแก้ไข");
    }

    const dueDate = Object.hasOwn(record, "dueDate")
      ? validateDueDate(record.dueDate)
      : current.dueDate;
    const recurrence = Object.hasOwn(record, "recurrence")
      ? validateRecurrence(record.recurrence)
      : current.recurrence;
    validateRecurrenceDueDate(recurrence, dueDate);
    const status = Object.hasOwn(record, "status")
      ? validateStatus(record.status)
      : current.status;
    const shouldCreateNext =
      current.status !== "DONE" && status === "DONE" && recurrence !== "NONE";

    const result = this.repository.update(id, {
      title: Object.hasOwn(record, "title") ? validateTitle(record.title) : current.title,
      description: Object.hasOwn(record, "description")
        ? validateDescription(record.description)
        : current.description,
      status,
      dueDate,
      priority: Object.hasOwn(record, "priority")
        ? validatePriority(record.priority)
        : current.priority,
      tags: Object.hasOwn(record, "tags") ? validateTags(record.tags) : current.tags,
      recurrence,
      nextDueDate:
        shouldCreateNext && dueDate
          ? getNextDueDate(dueDate, recurrence as Exclude<TaskRecurrence, "NONE">)
          : null,
      now: this.now().toISOString(),
    });

    if (!result) {
      throw new NotFoundError();
    }
    return result;
  }

  delete(id: number): void {
    if (!this.repository.delete(id)) {
      throw new NotFoundError();
    }
  }

  createSubtask(taskId: number, input: unknown): Subtask {
    const record = asRecord(input);
    if (!this.repository.findById(taskId)) {
      throw new NotFoundError();
    }
    if (this.repository.countSubtasks(taskId) >= MAX_SUBTASKS_PER_TASK) {
      throw new ValidationError(`เพิ่มรายการย่อยได้ไม่เกิน ${MAX_SUBTASKS_PER_TASK} รายการ`, {
        title: `เพิ่มรายการย่อยได้ไม่เกิน ${MAX_SUBTASKS_PER_TASK} รายการ`,
      });
    }
    return this.repository.createSubtask({
      taskId,
      title: validateSubtaskTitle(record.title),
      now: this.now().toISOString(),
    });
  }

  updateSubtask(taskId: number, subtaskId: number, input: unknown): Subtask {
    const record = asRecord(input);
    const current = this.repository.findSubtaskById(taskId, subtaskId);
    if (!current) {
      throw new SubtaskNotFoundError();
    }
    if (!Object.hasOwn(record, "title") && !Object.hasOwn(record, "completed")) {
      throw new ValidationError("กรุณาระบุข้อมูลรายการย่อยที่ต้องการแก้ไข");
    }
    const subtask = this.repository.updateSubtask(taskId, subtaskId, {
      title: Object.hasOwn(record, "title")
        ? validateSubtaskTitle(record.title)
        : current.title,
      completed: Object.hasOwn(record, "completed")
        ? validateCompleted(record.completed)
        : current.completed,
      now: this.now().toISOString(),
    });
    if (!subtask) {
      throw new SubtaskNotFoundError();
    }
    return subtask;
  }

  deleteSubtask(taskId: number, subtaskId: number): void {
    if (!this.repository.deleteSubtask(taskId, subtaskId, this.now().toISOString())) {
      throw new SubtaskNotFoundError();
    }
  }
}
