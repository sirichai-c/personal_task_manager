import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { DueDateFilter, Task, TaskStatus } from "../domain/task.js";

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ListQuery {
  search?: string;
  status?: TaskStatus;
  dueDate?: DueDateFilter;
  referenceDate: string;
  weekStart: string;
  weekEnd: string;
  page: number;
  pageSize: number;
}

interface CreateTaskRecord {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  now: string;
}

interface UpdateTaskRecord {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  now: string;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export class TaskRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(input: CreateTaskRecord): Task {
    const result = this.database
      .prepare(
        `INSERT INTO tasks (title, description, status, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(input.title, input.description, input.status, input.dueDate, input.now, input.now);

    return this.findById(Number(result.lastInsertRowid)) as Task;
  }

  findById(id: number): Task | null {
    const row = this.database
      .prepare(
        `SELECT id, title, description, status, due_date, created_at, updated_at
         FROM tasks
         WHERE id = ?`,
      )
      .get(id) as TaskRow | undefined;

    return row ? toTask(row) : null;
  }

  list(query: ListQuery): { items: Task[]; totalItems: number } {
    const clauses: string[] = [];
    const parameters: SQLInputValue[] = [];

    if (query.search) {
      clauses.push("title LIKE ? ESCAPE '\\' COLLATE NOCASE");
      parameters.push(`%${escapeLike(query.search)}%`);
    }
    if (query.status) {
      clauses.push("status = ?");
      parameters.push(query.status);
    }
    if (query.dueDate === "TODAY") {
      clauses.push("due_date = ?");
      parameters.push(query.referenceDate);
    } else if (query.dueDate === "THIS_WEEK") {
      clauses.push("due_date BETWEEN ? AND ?");
      parameters.push(query.weekStart, query.weekEnd);
    } else if (query.dueDate === "OVERDUE") {
      clauses.push("due_date < ? AND status != 'DONE'");
      parameters.push(query.referenceDate);
    } else if (query.dueDate === "NO_DATE") {
      clauses.push("due_date IS NULL");
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS count FROM tasks ${where}`)
      .get(...parameters) as { count: number };

    const offset = (query.page - 1) * query.pageSize;
    const rows = this.database
      .prepare(
        `SELECT id, title, description, status, due_date, created_at, updated_at
         FROM tasks
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...parameters, query.pageSize, offset) as unknown as TaskRow[];

    return {
      items: rows.map(toTask),
      totalItems: countRow.count,
    };
  }

  update(id: number, input: UpdateTaskRecord): Task | null {
    const result = this.database
      .prepare(
        `UPDATE tasks
         SET title = ?, description = ?, status = ?, due_date = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(input.title, input.description, input.status, input.dueDate, input.now, id);

    return result.changes === 0 ? null : this.findById(id);
  }

  delete(id: number): boolean {
    const result = this.database.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
