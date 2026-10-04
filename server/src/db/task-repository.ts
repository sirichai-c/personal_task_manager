import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  DueDateFilter,
  Subtask,
  Task,
  TaskPriority,
  TaskSort,
  TaskStatus,
} from "../domain/task.js";

interface TaskRow {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  due_date: string | null;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
}

interface ListQuery {
  search?: string;
  status?: TaskStatus;
  dueDate?: DueDateFilter;
  priority?: TaskPriority;
  tag?: string;
  sort: TaskSort;
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
  priority: TaskPriority;
  tags: string[];
  now: string;
}

interface UpdateTaskRecord {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: TaskPriority;
  tags: string[];
  now: string;
}

interface TagRow {
  task_id: number;
  name: string;
}

interface SubtaskRow {
  id: number;
  task_id: number;
  title: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

interface CreateSubtaskRecord {
  taskId: number;
  title: string;
  now: string;
}

interface UpdateSubtaskRecord {
  title: string;
  completed: boolean;
  now: string;
}

function toSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTask(row: TaskRow, tags: string[], subtasks: Subtask[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    priority: row.priority,
    tags,
    subtasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getOrderBy(sort: TaskSort): string {
  switch (sort) {
    case "UPDATED_DESC":
      return "updated_at DESC, id DESC";
    case "DUE_ASC":
      return `due_date IS NULL ASC, due_date ASC,
        CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC,
        created_at DESC, id DESC`;
    case "PRIORITY_DESC":
      return `CASE priority WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC,
        due_date IS NULL ASC, due_date ASC, created_at DESC, id DESC`;
    case "CREATED_DESC":
      return "created_at DESC, id DESC";
  }
}

export class TaskRepository {
  constructor(private readonly database: DatabaseSync) {}

  private withSavepoint<T>(name: string, action: () => T): T {
    this.database.exec(`SAVEPOINT ${name}`);
    try {
      const result = action();
      this.database.exec(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      this.database.exec(`ROLLBACK TO SAVEPOINT ${name}`);
      this.database.exec(`RELEASE SAVEPOINT ${name}`);
      throw error;
    }
  }

  private loadTags(taskIds: number[]): Map<number, string[]> {
    const tagsByTask = new Map<number, string[]>(taskIds.map((id) => [id, []]));
    if (taskIds.length === 0) {
      return tagsByTask;
    }

    const placeholders = taskIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(
        `SELECT task_tags.task_id, tags.name
         FROM task_tags
         JOIN tags ON tags.id = task_tags.tag_id
         WHERE task_tags.task_id IN (${placeholders})
         ORDER BY tags.name COLLATE NOCASE ASC`,
      )
      .all(...taskIds) as unknown as TagRow[];

    for (const row of rows) {
      tagsByTask.get(row.task_id)?.push(row.name);
    }
    return tagsByTask;
  }

  private loadSubtasks(taskIds: number[]): Map<number, Subtask[]> {
    const subtasksByTask = new Map<number, Subtask[]>(taskIds.map((id) => [id, []]));
    if (taskIds.length === 0) {
      return subtasksByTask;
    }

    const placeholders = taskIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(
        `SELECT id, task_id, title, completed, created_at, updated_at
         FROM subtasks
         WHERE task_id IN (${placeholders})
         ORDER BY task_id ASC, created_at ASC, id ASC`,
      )
      .all(...taskIds) as unknown as SubtaskRow[];

    for (const row of rows) {
      subtasksByTask.get(row.task_id)?.push(toSubtask(row));
    }
    return subtasksByTask;
  }

  private replaceTags(taskId: number, tags: string[]): void {
    this.database.prepare("DELETE FROM task_tags WHERE task_id = ?").run(taskId);
    const insertTag = this.database.prepare(
      "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING",
    );
    const findTag = this.database.prepare(
      "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
    );
    const linkTag = this.database.prepare(
      "INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)",
    );

    for (const tag of tags) {
      insertTag.run(tag);
      const row = findTag.get(tag) as { id: number };
      linkTag.run(taskId, row.id);
    }

    this.database.exec(`
      DELETE FROM tags
      WHERE NOT EXISTS (
        SELECT 1 FROM task_tags WHERE task_tags.tag_id = tags.id
      );
    `);
  }

  create(input: CreateTaskRecord): Task {
    return this.withSavepoint("create_task", () => {
      const result = this.database
        .prepare(
          `INSERT INTO tasks (
             title, description, status, due_date, priority, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.title,
          input.description,
          input.status,
          input.dueDate,
          input.priority,
          input.now,
          input.now,
        );
      const id = Number(result.lastInsertRowid);
      this.replaceTags(id, input.tags);
      return this.findById(id) as Task;
    });
  }

  findById(id: number): Task | null {
    const row = this.database
      .prepare(
        `SELECT id, title, description, status, due_date, priority, created_at, updated_at
         FROM tasks
         WHERE id = ?`,
      )
      .get(id) as TaskRow | undefined;

    if (!row) {
      return null;
    }
    return toTask(
      row,
      this.loadTags([id]).get(id) ?? [],
      this.loadSubtasks([id]).get(id) ?? [],
    );
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
    if (query.priority) {
      clauses.push("priority = ?");
      parameters.push(query.priority);
    }
    if (query.tag) {
      clauses.push(`EXISTS (
        SELECT 1
        FROM task_tags
        JOIN tags AS filter_tags ON filter_tags.id = task_tags.tag_id
        WHERE task_tags.task_id = tasks.id
          AND filter_tags.name = ? COLLATE NOCASE
      )`);
      parameters.push(query.tag);
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
        `SELECT id, title, description, status, due_date, priority, created_at, updated_at
         FROM tasks
         ${where}
         ORDER BY ${getOrderBy(query.sort)}
         LIMIT ? OFFSET ?`,
      )
      .all(...parameters, query.pageSize, offset) as unknown as TaskRow[];

    const tagsByTask = this.loadTags(rows.map((row) => row.id));
    const subtasksByTask = this.loadSubtasks(rows.map((row) => row.id));
    return {
      items: rows.map((row) =>
        toTask(row, tagsByTask.get(row.id) ?? [], subtasksByTask.get(row.id) ?? []),
      ),
      totalItems: countRow.count,
    };
  }

  update(id: number, input: UpdateTaskRecord): Task | null {
    return this.withSavepoint("update_task", () => {
      const result = this.database
        .prepare(
          `UPDATE tasks
           SET title = ?, description = ?, status = ?, due_date = ?, priority = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          input.title,
          input.description,
          input.status,
          input.dueDate,
          input.priority,
          input.now,
          id,
        );
      if (result.changes === 0) {
        return null;
      }
      this.replaceTags(id, input.tags);
      return this.findById(id);
    });
  }

  delete(id: number): boolean {
    return this.withSavepoint("delete_task", () => {
      const result = this.database.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      if (result.changes > 0) {
        this.database.exec(`
          DELETE FROM tags
          WHERE NOT EXISTS (
            SELECT 1 FROM task_tags WHERE task_tags.tag_id = tags.id
          );
        `);
      }
      return result.changes > 0;
    });
  }

  countSubtasks(taskId: number): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM subtasks WHERE task_id = ?")
      .get(taskId) as { count: number };
    return row.count;
  }

  findSubtaskById(taskId: number, id: number): Subtask | null {
    const row = this.database
      .prepare(
        `SELECT id, task_id, title, completed, created_at, updated_at
         FROM subtasks
         WHERE task_id = ? AND id = ?`,
      )
      .get(taskId, id) as SubtaskRow | undefined;
    return row ? toSubtask(row) : null;
  }

  createSubtask(input: CreateSubtaskRecord): Subtask {
    return this.withSavepoint("create_subtask", () => {
      const result = this.database
        .prepare(
          `INSERT INTO subtasks (task_id, title, completed, created_at, updated_at)
           VALUES (?, ?, 0, ?, ?)`,
        )
        .run(input.taskId, input.title, input.now, input.now);
      this.database
        .prepare("UPDATE tasks SET updated_at = ? WHERE id = ?")
        .run(input.now, input.taskId);
      return this.findSubtaskById(input.taskId, Number(result.lastInsertRowid)) as Subtask;
    });
  }

  updateSubtask(taskId: number, id: number, input: UpdateSubtaskRecord): Subtask | null {
    return this.withSavepoint("update_subtask", () => {
      const result = this.database
        .prepare(
          `UPDATE subtasks
           SET title = ?, completed = ?, updated_at = ?
           WHERE task_id = ? AND id = ?`,
        )
        .run(input.title, input.completed ? 1 : 0, input.now, taskId, id);
      if (result.changes === 0) {
        return null;
      }
      this.database
        .prepare("UPDATE tasks SET updated_at = ? WHERE id = ?")
        .run(input.now, taskId);
      return this.findSubtaskById(taskId, id);
    });
  }

  deleteSubtask(taskId: number, id: number, now: string): boolean {
    return this.withSavepoint("delete_subtask", () => {
      const result = this.database
        .prepare("DELETE FROM subtasks WHERE task_id = ? AND id = ?")
        .run(taskId, id);
      if (result.changes > 0) {
        this.database
          .prepare("UPDATE tasks SET updated_at = ? WHERE id = ?")
          .run(now, taskId);
      }
      return result.changes > 0;
    });
  }
}
