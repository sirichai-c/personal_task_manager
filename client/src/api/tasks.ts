import type {
  DueDateFilter,
  PriorityFilter,
  StatusFilter,
  Subtask,
  SubtaskUpdateInput,
  Task,
  TaskInput,
  TaskListResponse,
  TaskSort,
} from "../types";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจว่าเซิร์ฟเวอร์กำลังทำงาน");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? "ระบบไม่สามารถทำรายการได้",
      response.status,
      payload.error?.fields,
    );
  }
  return payload;
}

export function getTasks(
  input: {
    search: string;
    status: StatusFilter;
    dueDate: DueDateFilter;
    priority: PriorityFilter;
    tag: string;
    sort: TaskSort;
    referenceDate: string;
    page: number;
  },
  signal: AbortSignal,
): Promise<TaskListResponse> {
  const parameters = new URLSearchParams({ page: String(input.page) });
  if (input.search) {
    parameters.set("search", input.search);
  }
  if (input.status) {
    parameters.set("status", input.status);
  }
  if (input.dueDate) {
    parameters.set("dueDate", input.dueDate);
    parameters.set("referenceDate", input.referenceDate);
  }
  if (input.priority) {
    parameters.set("priority", input.priority);
  }
  if (input.tag) {
    parameters.set("tag", input.tag);
  }
  parameters.set("sort", input.sort);
  return request<TaskListResponse>(`/api/tasks?${parameters.toString()}`, { signal });
}

export async function createTask(input: TaskInput): Promise<Task> {
  const response = await request<{ item: Task }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      dueDate: input.dueDate || null,
      priority: input.priority,
      tags: input.tags,
    }),
  });
  return response.item;
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  const response = await request<{ item: Task }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...input, dueDate: input.dueDate || null }),
  });
  return response.item;
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/api/tasks/${id}`, { method: "DELETE" });
}

export async function createSubtask(taskId: number, title: string): Promise<Subtask> {
  const response = await request<{ item: Subtask }>(`/api/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return response.item;
}

export async function updateSubtask(
  taskId: number,
  subtaskId: number,
  input: SubtaskUpdateInput,
): Promise<Subtask> {
  const response = await request<{ item: Subtask }>(
    `/api/tasks/${taskId}/subtasks/${subtaskId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return response.item;
}

export function deleteSubtask(taskId: number, subtaskId: number): Promise<void> {
  return request<void>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "DELETE",
  });
}
