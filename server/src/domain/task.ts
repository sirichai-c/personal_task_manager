export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const DUE_DATE_FILTERS = ["TODAY", "THIS_WEEK", "OVERDUE", "NO_DATE"] as const;
export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"] as const;
export const TASK_RECURRENCES = ["NONE", "DAILY", "WEEKLY", "MONTHLY"] as const;
export const TASK_REMINDERS = [
  "NONE",
  "ON_DUE_DATE",
  "ONE_DAY_BEFORE",
  "THREE_DAYS_BEFORE",
  "SEVEN_DAYS_BEFORE",
] as const;
export const TASK_SORTS = [
  "CREATED_DESC",
  "UPDATED_DESC",
  "DUE_ASC",
  "PRIORITY_DESC",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DueDateFilter = (typeof DUE_DATE_FILTERS)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];
export type TaskReminder = (typeof TASK_REMINDERS)[number];
export type TaskSort = (typeof TASK_SORTS)[number];

export interface Subtask {
  id: number;
  taskId: number;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string | null;
  priority: TaskPriority;
  recurrence: TaskRecurrence;
  reminder: TaskReminder;
  tags: string[];
  subtasks: Subtask[];
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
export const MAX_SUBTASKS_PER_TASK = 30;
export const MAX_ACTIVE_REMINDERS = 50;
