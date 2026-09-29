import type { Task, TaskStatus } from "../types";

interface TaskListProps {
  tasks: Task[];
  isLoading: boolean;
  hasFilters: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "ต้องทำ",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
};

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
            ? "ลองเปลี่ยนคำค้นหาหรือสถานะเพื่อดูงานอื่น"
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

  return (
    <ul className="task-list" aria-label="รายการงาน">
      {tasks.map((task) => (
        <li className="task-row" key={task.id}>
          <span className={`status-line status-line-${task.status.toLowerCase()}`} aria-hidden="true" />
          <div className="task-copy">
            <span className={`status-badge status-${task.status.toLowerCase()}`}>
              {STATUS_LABELS[task.status]}
            </span>
            <h2>{task.title}</h2>
            {task.description ? <p>{task.description}</p> : <p className="no-description">ไม่มีรายละเอียด</p>}
          </div>
          <time className="task-date" dateTime={task.createdAt}>
            สร้าง {dateFormatter.format(new Date(task.createdAt))}
          </time>
          <div className="task-actions" aria-label={`การทำงานสำหรับ ${task.title}`}>
            <button type="button" className="text-button" onClick={() => onEdit(task)}>
              แก้ไข
            </button>
            <button type="button" className="text-button text-button-danger" onClick={() => onDelete(task)}>
              ลบ
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

