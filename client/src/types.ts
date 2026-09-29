export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type StatusFilter = TaskStatus | "";

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListResponse {
  items: Task[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TaskInput {
  title: string;
  description: string;
  status?: TaskStatus;
}

