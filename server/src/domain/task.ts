export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const DUE_DATE_FILTERS = ["TODAY", "THIS_WEEK", "OVERDUE", "NO_DATE"] as const;
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export const TASK_SORTS = [
  "CREATED_DESC",
  "UPDATED_DESC",
  "DUE_ASC",
  "PRIORITY_DESC",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DueDateFilter = (typeof DUE_DATE_FILTERS)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskSort = (typeof TASK_SORTS)[number];

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: TaskPriority;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  items: Task[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export const PAGE_SIZE = 20;
