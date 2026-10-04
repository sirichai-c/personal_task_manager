import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createSubtask,
  createTask,
  deleteSubtask,
  deleteTask,
  dismissReminder,
  getReminders,
  getTasks,
  updateSubtask,
  updateTask,
} from "./api/tasks";
import { DeleteTaskDialog } from "./components/DeleteTaskDialog";
import { Pagination } from "./components/Pagination";
import { ReminderCenter } from "./components/ReminderCenter";
import { TaskFormDialog } from "./components/TaskFormDialog";
import { TaskList } from "./components/TaskList";
import type {
  DueDateFilter,
  PriorityFilter,
  StatusFilter,
  SubtaskUpdateInput,
  Task,
  TaskInput,
  TaskListResponse,
  TaskSort,
} from "./types";

interface Filters {
  search: string;
  status: StatusFilter;
  dueDate: DueDateFilter;
  priority: PriorityFilter;
  tag: string;
  sort: TaskSort;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  dueDate: "",
  priority: "",
  tag: "",
  sort: "CREATED_DESC",
};

function getLocalDateValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [reminders, setReminders] = useState<Task[]>([]);
  const [reminderError, setReminderError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settledRequestKey, setSettledRequestKey] = useState("");
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const requestKey = `${filters.search}\u0000${filters.status}\u0000${filters.dueDate}\u0000${filters.priority}\u0000${filters.tag}\u0000${filters.sort}\u0000${page}\u0000${refreshKey}`;

  useEffect(() => {
    const controller = new AbortController();
    getTasks({ ...filters, referenceDate: getLocalDateValue(), page }, controller.signal)
      .then((response) => {
        setData(response);
        setRequestError(null);
        setSettledRequestKey(requestKey);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setRequestError({
          key: requestKey,
          message: error instanceof ApiError ? error.message : "โหลดรายการงานไม่สำเร็จ",
        });
        setSettledRequestKey(requestKey);
      });
    return () => controller.abort();
  }, [filters, page, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    getReminders(getLocalDateValue(), controller.signal)
      .then((items) => {
        setReminders(items);
        setReminderError("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setReminderError(
          error instanceof ApiError ? error.message : "โหลดการแจ้งเตือนไม่สำเร็จ",
        );
      });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setSuccessMessage(""), 3_500);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function announceSuccess(message: string) {
    setSuccessMessage(message);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({
      ...current,
      search: searchDraft.trim(),
      tag: tagDraft.trim(),
    }));
  }

  function clearFilters() {
    setSearchDraft("");
    setTagDraft("");
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  async function handleCreate(input: TaskInput) {
    await createTask(input);
    setIsCreateOpen(false);
    setPage(1);
    refresh();
    announceSuccess("เพิ่มงานแล้ว");
  }

  async function handleUpdate(input: TaskInput) {
    if (!editingTask) {
      return;
    }
    const result = await updateTask(editingTask.id, input);
    setEditingTask(null);
    refresh();
    announceSuccess(
      result.nextItem
        ? "บันทึกแล้ว และสร้างงานรอบถัดไปแล้ว"
        : "บันทึกการแก้ไขแล้ว",
    );
  }

  async function handleDelete() {
    if (!deletingTask) {
      return;
    }
    await deleteTask(deletingTask.id);
    setReminders((current) => current.filter((task) => task.id !== deletingTask.id));
    setDeletingTask(null);
    if (data && data.items.length === 1 && page > 1) {
      setPage((current) => current - 1);
    } else {
      refresh();
    }
    announceSuccess("ลบงานแล้ว");
  }

  async function handleDismissReminder(id: number) {
    await dismissReminder(id);
    setReminders((current) => current.filter((task) => task.id !== id));
    announceSuccess("ซ่อนการเตือนรอบนี้แล้ว");
  }

  async function handleCreateSubtask(taskId: number, title: string) {
    const subtask = await createSubtask(taskId, title);
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: [...task.subtasks, subtask],
                    updatedAt: subtask.updatedAt,
                  }
                : task,
            ),
          }
        : current,
    );
    refresh();
    announceSuccess("เพิ่มรายการย่อยแล้ว");
  }

  async function handleUpdateSubtask(
    taskId: number,
    subtaskId: number,
    input: SubtaskUpdateInput,
  ) {
    const subtask = await updateSubtask(taskId, subtaskId, input);
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.map((item) =>
                      item.id === subtaskId ? subtask : item,
                    ),
                    updatedAt: subtask.updatedAt,
                  }
                : task,
            ),
          }
        : current,
    );
    refresh();
    announceSuccess(input.completed === undefined ? "แก้ไขรายการย่อยแล้ว" : "อัปเดตความคืบหน้าแล้ว");
  }

  async function handleDeleteSubtask(taskId: number, subtaskId: number) {
    await deleteSubtask(taskId, subtaskId);
    setData((current) =>
      current
        ? {
            ...current,
            items: current.items.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: task.subtasks.filter((item) => item.id !== subtaskId),
                  }
                : task,
            ),
          }
        : current,
    );
    refresh();
    announceSuccess("ลบรายการย่อยแล้ว");
  }

  const totalItems = data?.pagination.totalItems ?? 0;
  const hasFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.dueDate ||
      filters.priority ||
      filters.tag ||
      filters.sort !== "CREATED_DESC",
  );
  const isLoading = settledRequestKey !== requestKey;
  const loadError = requestError?.key === requestKey ? requestError.message : "";
  const showInitialLoading = isLoading && !data;

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <h1>งานของฉัน</h1>
            <p>
              {isLoading && !data
                ? "กำลังเปิดสมุดงาน…"
                : `${totalItems.toLocaleString("th-TH")} งานในรายการนี้`}
            </p>
          </div>
        </div>
        <button type="button" className="button button-primary add-button" onClick={() => setIsCreateOpen(true)}>
          <span aria-hidden="true">＋</span> เพิ่มงาน
        </button>
      </header>

      <main className="workspace">
        <form className="filter-bar" role="search" onSubmit={applySearch}>
          <div className="search-field">
            <label htmlFor="task-search">ค้นหาจากชื่องาน</label>
            <div className="search-input-wrap">
              <span aria-hidden="true">⌕</span>
              <input
                id="task-search"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="พิมพ์ชื่องานที่ต้องการค้นหา"
                maxLength={120}
              />
            </div>
          </div>
          <div className="tag-field">
            <label htmlFor="tag-filter">แท็ก</label>
            <input
              id="tag-filter"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="เช่น งาน"
              maxLength={30}
            />
          </div>
          <div className="status-field">
            <label htmlFor="status-filter">สถานะ</label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as StatusFilter,
                }));
                setPage(1);
              }}
            >
              <option value="">ทุกสถานะ</option>
              <option value="TODO">ต้องทำ</option>
              <option value="IN_PROGRESS">กำลังทำ</option>
              <option value="DONE">เสร็จแล้ว</option>
            </select>
          </div>
          <div className="due-date-field">
            <label htmlFor="due-date-filter">กำหนดส่ง</label>
            <select
              id="due-date-filter"
              value={filters.dueDate}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  dueDate: event.target.value as DueDateFilter,
                }));
                setPage(1);
              }}
            >
              <option value="">ทุกกำหนดส่ง</option>
              <option value="TODAY">วันนี้</option>
              <option value="THIS_WEEK">สัปดาห์นี้</option>
              <option value="OVERDUE">เกินกำหนด</option>
              <option value="NO_DATE">ไม่กำหนดวัน</option>
            </select>
          </div>
          <div className="priority-field">
            <label htmlFor="priority-filter">ความสำคัญ</label>
            <select
              id="priority-filter"
              value={filters.priority}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  priority: event.target.value as PriorityFilter,
                }));
                setPage(1);
              }}
            >
              <option value="">ทุกระดับ</option>
              <option value="LOW">ต่ำ</option>
              <option value="NORMAL">ปกติ</option>
              <option value="HIGH">สูง</option>
            </select>
          </div>
          <div className="sort-field">
            <label htmlFor="sort-filter">เรียงตาม</label>
            <select
              id="sort-filter"
              value={filters.sort}
              onChange={(event) => {
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value as TaskSort,
                }));
                setPage(1);
              }}
            >
              <option value="CREATED_DESC">เพิ่มล่าสุด</option>
              <option value="UPDATED_DESC">แก้ไขล่าสุด</option>
              <option value="DUE_ASC">กำหนดส่งใกล้สุด</option>
              <option value="PRIORITY_DESC">สำคัญสูงสุด</option>
            </select>
          </div>
          <button type="submit" className="button button-secondary search-button">
            ค้นหา
          </button>
          {hasFilters ? (
            <button type="button" className="clear-button" onClick={clearFilters}>
              ล้างตัวกรอง
            </button>
          ) : null}
        </form>

        <ReminderCenter
          tasks={reminders}
          error={reminderError}
          referenceDate={getLocalDateValue()}
          onRetry={refresh}
          onOpen={setEditingTask}
          onDismiss={handleDismissReminder}
        />

        <div className="list-heading">
          <div>
            <h2>รายการงาน</h2>
            <p>
              {hasFilters
                ? "ผลลัพธ์ตามตัวกรองและลำดับที่เลือก"
                : "เรียงจากงานที่เพิ่มล่าสุด"}
            </p>
          </div>
          {isLoading && data ? <span className="refresh-indicator">กำลังอัปเดต…</span> : null}
        </div>

        {loadError ? (
          <div className="load-error" role="alert">
            <div>
              <strong>โหลดรายการไม่สำเร็จ</strong>
              <span>{loadError}</span>
            </div>
            <button type="button" className="text-button" onClick={refresh}>
              ลองอีกครั้ง
            </button>
          </div>
        ) : null}

        {loadError && !data ? null : (
          <TaskList
            tasks={data?.items ?? []}
            isLoading={showInitialLoading}
            hasFilters={hasFilters}
            onAdd={() => setIsCreateOpen(true)}
            onClearFilters={clearFilters}
            onEdit={setEditingTask}
            onDelete={setDeletingTask}
            onCreateSubtask={handleCreateSubtask}
            onUpdateSubtask={handleUpdateSubtask}
            onDeleteSubtask={handleDeleteSubtask}
          />
        )}

        {data ? (
          <Pagination {...data.pagination} onPageChange={setPage} />
        ) : null}
      </main>

      {isCreateOpen ? (
        <TaskFormDialog task={null} onClose={() => setIsCreateOpen(false)} onSave={handleCreate} />
      ) : null}
      {editingTask ? (
        <TaskFormDialog task={editingTask} onClose={() => setEditingTask(null)} onSave={handleUpdate} />
      ) : null}
      {deletingTask ? (
        <DeleteTaskDialog
          task={deletingTask}
          onClose={() => setDeletingTask(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      <div className={`toast ${successMessage ? "toast-visible" : ""}`} aria-live="polite" aria-atomic="true">
        <span className="toast-check" aria-hidden="true">
          ✓
        </span>
        {successMessage}
      </div>
    </div>
  );
}
