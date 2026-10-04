import type { CalendarResponse, Task } from "../types";

interface TaskCalendarProps {
  data: CalendarResponse | null;
  error: string;
  isLoading: boolean;
  month: string;
  today: string;
  onNextMonth: () => void;
  onOpen: (task: Task) => void;
  onPreviousMonth: () => void;
  onRetry: () => void;
  onToday: () => void;
}

const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const STATUS_LABELS: Record<Task["status"], string> = {
  TODO: "ต้องทำ",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
};
const monthFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const agendaDateFormatter = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getCalendarDays(month: string) {
  const firstDay = parseDate(`${month}-01`);
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(index - mondayOffset + 1);
    const key = formatDateKey(date);
    return {
      key,
      day: date.getUTCDate(),
      isCurrentMonth: key.startsWith(month),
    };
  });
}

function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }
    const items = grouped.get(task.dueDate) ?? [];
    items.push(task);
    grouped.set(task.dueDate, items);
  }
  return grouped;
}

function CalendarTaskButton({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  return (
    <button
      type="button"
      className={`calendar-task calendar-task-${task.status.toLowerCase()} calendar-priority-${task.priority.toLowerCase()}`}
      aria-label={`${task.title}, ${STATUS_LABELS[task.status]}`}
      onClick={() => onOpen(task)}
    >
      <span className="calendar-priority-dot" aria-hidden="true" />
      <span>{task.title}</span>
    </button>
  );
}

export function TaskCalendar({
  data,
  error,
  isLoading,
  month,
  today,
  onNextMonth,
  onOpen,
  onPreviousMonth,
  onRetry,
  onToday,
}: TaskCalendarProps) {
  const days = getCalendarDays(month);
  const tasksByDate = groupTasksByDate(data?.items ?? []);
  const agendaDates = [...tasksByDate.keys()].sort();
  const monthLabel = monthFormatter.format(parseDate(`${month}-01`));

  return (
    <section className="task-calendar" aria-label={`ปฏิทินงาน ${monthLabel}`}>
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button type="button" className="calendar-nav-button" aria-label="เดือนก่อนหน้า" onClick={onPreviousMonth}>
            ‹
          </button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button type="button" className="calendar-nav-button" aria-label="เดือนถัดไป" onClick={onNextMonth}>
            ›
          </button>
        </div>
        <button type="button" className="button button-secondary calendar-today-button" onClick={onToday}>
          เดือนนี้
        </button>
      </div>

      {error ? (
        <div className="load-error calendar-load-error" role="alert">
          <div>
            <strong>โหลดปฏิทินไม่สำเร็จ</strong>
            <span>{error}</span>
          </div>
          <button type="button" className="text-button" onClick={onRetry}>
            ลองอีกครั้ง
          </button>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="calendar-loading" aria-live="polite">
          <span className="skeleton calendar-loading-title" />
          <span className="skeleton calendar-loading-grid" />
          <span className="sr-only">กำลังโหลดปฏิทิน</span>
        </div>
      ) : null}

      {data?.truncated ? (
        <p className="calendar-limit-note" role="status">
          เดือนนี้มีงานมากกว่า 500 งาน ปฏิทินแสดง 500 งานแรกตามกำหนดส่ง
        </p>
      ) : null}

      {data ? (
        <>
          {data.items.length === 0 ? (
            <p className="calendar-empty-note">เดือนนี้ยังไม่มีงานที่กำหนดวันส่ง งานที่ไม่ระบุวันยังดูได้ในมุมมองรายการ</p>
          ) : null}

          <div className="calendar-desktop">
            <div className="calendar-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((day) => {
                const tasks = tasksByDate.get(day.key) ?? [];
                return (
                  <div
                    key={day.key}
                    className={`calendar-day${day.isCurrentMonth ? "" : " calendar-day-outside"}${day.key === today ? " calendar-day-today" : ""}`}
                  >
                    <time dateTime={day.key} className="calendar-day-number">
                      {day.day.toLocaleString("th-TH")}
                    </time>
                    <div className="calendar-day-tasks">
                      {tasks.map((task) => (
                        <CalendarTaskButton key={task.id} task={task} onOpen={onOpen} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="calendar-agenda">
            {agendaDates.length > 0 ? (
              agendaDates.map((date) => (
                <section key={date} className={date === today ? "agenda-day agenda-day-today" : "agenda-day"}>
                  <h4>
                    <time dateTime={date}>{agendaDateFormatter.format(parseDate(date))}</time>
                    {date === today ? <span>วันนี้</span> : null}
                  </h4>
                  <div className="agenda-tasks">
                    {(tasksByDate.get(date) ?? []).map((task) => (
                      <CalendarTaskButton key={task.id} task={task} onOpen={onOpen} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="calendar-agenda-empty">
                <span className="empty-check" aria-hidden="true" />
                <strong>เดือนนี้ยังไม่มีงานที่กำหนดวันส่ง</strong>
                <p>งานที่ไม่ระบุวันยังดูได้ในมุมมองรายการ</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
