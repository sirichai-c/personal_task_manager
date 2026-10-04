import type { SubtaskUpdateInput, Task, TaskPriority, TaskStatus } from "../types";
import { SubtaskChecklist } from "./SubtaskChecklist";

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  hasFilters: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onCreateSubtask: (taskId: number, title: string) => Promise<void>;
  onUpdateSubtask: (
    taskId: number,
    subtaskId: number,
    input: SubtaskUpdateInput,
  ) => Promise<void>;
  onDeleteSubtask: (taskId: number, subtaskId: number) => Promise<void>;
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dueDateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "ต้องทำ",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "สำคัญต่ำ",
  NORMAL: "สำคัญปกติ",
  HIGH: "สำคัญสูง",
};

function getLocalDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DueDate({ task, today }: { task: Task; today: string }) {
  if (!task.dueDate) {
    return <span className="due-date due-date-empty">ไม่กำหนดวัน</span>;
  }

  const formattedDate = dueDateFormatter.format(new Date(`${task.dueDate}T00:00:00.000Z`));
  const isOverdue = task.status !== "DONE" && task.dueDate < today;
  const isToday = task.dueDate === today;
  const label = isOverdue
    ? `เกินกำหนด ${formattedDate}`
    : isToday
      ? "ครบกำหนดวันนี้"
      : `ครบกำหนด ${formattedDate}`;

  return (
    <time
      className={`due-date ${isOverdue ? "due-date-overdue" : isToday ? "due-date-today" : ""}`}
      dateTime={task.dueDate}
    >
      {label}
    </time>
  );
}

function LoadingRows() {
  return (
    <div className="loading-list" aria-label="กำลังโหลดรายการงาน" role="status">
      {[0, 1, 2, 3].map((item) => (
        <div className="loading-row" key={item}>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-text" />
        </div>
      ))}
    </div>
  );
}

export function TaskList({
  tasks,
  isLoading,
  hasFilters,
  onAdd,
  onClearFilters,
  onEdit,
  onDelete,
  onCreateSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
}: TaskListProps) {
  if (isLoading) {
    return <LoadingRows />;
  }

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-check" aria-hidden="true" />
        <h2>{hasFilters ? "ไม่พบงานที่ตรงกัน" : "ยังไม่มีงานในรายการ"}</h2>
        <p>
          {hasFilters
            ? "ลองเปลี่ยนคำค้นหา แท็ก สถานะ หรือระดับความสำคัญเพื่อดูงานอื่น"
            : "เพิ่มงานแรก แล้วค่อย ๆ จัดการทีละเรื่อง"}
        </p>
        <button
          type="button"
          className="button button-secondary"
          onClick={hasFilters ? onClearFilters : onAdd}
        >
          {hasFilters ? "ล้างตัวกรอง" : "เพิ่มงานแรก"}
        </button>
      </div>
    );
  }

  const today = getLocalDateValue();

  return (
    <ul className="task-list" aria-label="รายการงาน">
      {tasks.map((task) => (
        <li className="task-row" key={task.id}>
          <span className={`status-line status-line-${task.status.toLowerCase()}`} aria-hidden="true" />
          <div className="task-copy">
            <div className="task-badges">
              <span className={`status-badge status-${task.status.toLowerCase()}`}>
                {STATUS_LABELS[task.status]}
              </span>
              <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            </div>
            <h2>{task.title}</h2>
            {task.description ? <p>{task.description}</p> : <p className="no-description">ไม่มีรายละเอียด</p>}
            {task.tags.length > 0 ? (
              <ul className="tag-list" aria-label="แท็ก">
                {task.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="task-dates">
            <time className="task-date" dateTime={task.createdAt}>
              สร้าง {dateFormatter.format(new Date(task.createdAt))}
            </time>
            <DueDate task={task} today={today} />
          </div>
          <div className="task-actions" aria-label={`การทำงานสำหรับ ${task.title}`}>
            <button type="button" className="text-button" onClick={() => onEdit(task)}>
              แก้ไข
            </button>
            <button type="button" className="text-button text-button-danger" onClick={() => onDelete(task)}>
              ลบ
            </button>
          </div>
          <SubtaskChecklist
            task={task}
            onCreate={onCreateSubtask}
            onUpdate={onUpdateSubtask}
            onDelete={onDeleteSubtask}
          />
        </li>
      ))}
    </ul>
  );
}
