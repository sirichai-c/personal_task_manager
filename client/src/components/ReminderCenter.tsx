import { useState } from "react";
import type { Task } from "../types";

interface ReminderCenterProps {
  tasks: Task[];
  error: string;
  referenceDate: string;
  onRetry: () => void;
  onOpen: (task: Task) => void;
  onDismiss: (id: number) => Promise<void>;
}

const dueDateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function getDaysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toTime - fromTime) / 86_400_000);
}

function getTimingLabel(task: Task, referenceDate: string): string {
  if (!task.dueDate) {
    return "";
  }
  const days = getDaysBetween(referenceDate, task.dueDate);
  if (days < 0) {
    return `เกินกำหนด ${Math.abs(days).toLocaleString("th-TH")} วัน`;
  }
  if (days === 0) {
    return "ครบกำหนดวันนี้";
  }
  return `ครบกำหนดใน ${days.toLocaleString("th-TH")} วัน`;
}

export function ReminderCenter({
  tasks,
  error,
  referenceDate,
  onRetry,
  onOpen,
  onDismiss,
}: ReminderCenterProps) {
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [dismissError, setDismissError] = useState("");

  async function handleDismiss(id: number) {
    if (dismissingId !== null) {
      return;
    }
    setDismissingId(id);
    setDismissError("");
    try {
      await onDismiss(id);
    } catch (dismissalError) {
      void dismissalError;
      setDismissError("ซ่อนการเตือนไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setDismissingId(null);
    }
  }

  if (tasks.length === 0 && !error) {
    return null;
  }

  return (
    <section className="reminder-center" aria-labelledby="reminder-heading">
      <div className="reminder-heading-row">
        <span className="reminder-mark" aria-hidden="true">
          ◷
        </span>
        <div>
          <h2 id="reminder-heading">เตือนกำหนดส่ง</h2>
          <p>{tasks.length.toLocaleString("th-TH")} งานที่ควรดูตอนนี้</p>
        </div>
      </div>

      {error ? (
        <div className="reminder-error" role="alert">
          <span>{error}</span>
          <button type="button" className="text-button" onClick={onRetry}>
            ลองอีกครั้ง
          </button>
        </div>
      ) : null}
      {dismissError ? (
        <p className="reminder-dismiss-error" role="alert">
          {dismissError}
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <ul className="reminder-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <div className="reminder-copy">
                <strong>{task.title}</strong>
                <span className={task.dueDate && task.dueDate < referenceDate ? "is-overdue" : ""}>
                  {getTimingLabel(task, referenceDate)}
                  {task.dueDate
                    ? ` · ${dueDateFormatter.format(new Date(`${task.dueDate}T00:00:00.000Z`))}`
                    : ""}
                </span>
              </div>
              <div className="reminder-actions">
                <button type="button" className="text-button" onClick={() => onOpen(task)}>
                  เปิดงาน
                </button>
                <button
                  type="button"
                  className="text-button reminder-dismiss-button"
                  disabled={dismissingId !== null}
                  onClick={() => void handleDismiss(task.id)}
                >
                  {dismissingId === task.id ? "กำลังซ่อน…" : "ซ่อนเตือนนี้"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
