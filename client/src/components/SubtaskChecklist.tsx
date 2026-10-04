import { useState, type FormEvent } from "react";
import { ApiError } from "../api/tasks";
import type { SubtaskUpdateInput, Task } from "../types";

interface SubtaskChecklistProps {
  task: Task;
  onCreate: (taskId: number, title: string) => Promise<void>;
  onUpdate: (
    taskId: number,
    subtaskId: number,
    input: SubtaskUpdateInput,
  ) => Promise<void>;
  onDelete: (taskId: number, subtaskId: number) => Promise<void>;
}

const MAX_SUBTASKS = 30;

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "อัปเดตรายการย่อยไม่สำเร็จ";
}

export function SubtaskChecklist({
  task,
  onCreate,
  onUpdate,
  onDelete,
}: SubtaskChecklistProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [completionOverrides, setCompletionOverrides] = useState<Record<number, boolean>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const completedCount = task.subtasks.reduce(
    (count, subtask) => count + (subtask.completed ? 1 : 0),
    0,
  );
  const isComplete = task.subtasks.length > 0 && completedCount === task.subtasks.length;
  const isAtLimit = task.subtasks.length >= MAX_SUBTASKS;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) {
      setErrorMessage("กรุณากรอกชื่อรายการย่อย");
      return;
    }
    setPendingAction("create");
    setErrorMessage("");
    try {
      await onCreate(task.id, title);
      setDraft("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingAction("");
    }
  }

  async function handleToggle(subtaskId: number, completed: boolean) {
    setCompletionOverrides((current) => ({ ...current, [subtaskId]: completed }));
    setPendingAction(`toggle-${subtaskId}`);
    setErrorMessage("");
    try {
      await onUpdate(task.id, subtaskId, { completed });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setCompletionOverrides((current) => {
        const next = { ...current };
        delete next[subtaskId];
        return next;
      });
      setPendingAction("");
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>, subtaskId: number) {
    event.preventDefault();
    const title = editingDraft.trim();
    if (!title) {
      setErrorMessage("กรุณากรอกชื่อรายการย่อย");
      return;
    }
    setPendingAction(`edit-${subtaskId}`);
    setErrorMessage("");
    try {
      await onUpdate(task.id, subtaskId, { title });
      setEditingId(null);
      setEditingDraft("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingAction("");
    }
  }

  async function handleDelete(subtaskId: number) {
    setPendingAction(`delete-${subtaskId}`);
    setErrorMessage("");
    try {
      await onDelete(task.id, subtaskId);
      setConfirmingDeleteId(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <details className={`checklist ${isComplete ? "checklist-complete" : ""}`}>
      <summary>
        <span className="checklist-summary-label">รายการย่อย</span>
        <span className="checklist-count">
          {task.subtasks.length > 0
            ? `เสร็จแล้ว ${completedCount}/${task.subtasks.length}`
            : "ยังไม่มีรายการ"}
        </span>
      </summary>

      <div className="checklist-body">
        {task.subtasks.length > 0 ? (
          <>
            <progress
              className="checklist-progress"
              value={completedCount}
              max={task.subtasks.length}
              aria-label={`ทำเสร็จ ${completedCount} จาก ${task.subtasks.length} รายการ`}
            />
            <ul className="subtask-list">
              {task.subtasks.map((subtask) => {
                const isPending = pendingAction.endsWith(`-${subtask.id}`);
                const checkboxId = `subtask-${task.id}-${subtask.id}`;
                return (
                  <li
                    className={subtask.completed ? "subtask-completed" : ""}
                    key={subtask.id}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={completionOverrides[subtask.id] ?? subtask.completed}
                      disabled={isPending}
                      onChange={(event) => {
                        void handleToggle(subtask.id, event.currentTarget.checked);
                      }}
                    />
                    {editingId === subtask.id ? (
                      <form
                        className="subtask-edit-form"
                        onSubmit={(event) => void handleEdit(event, subtask.id)}
                      >
                        <label className="sr-only" htmlFor={`${checkboxId}-edit`}>
                          แก้ไขชื่อรายการย่อย
                        </label>
                        <input
                          id={`${checkboxId}-edit`}
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                          maxLength={120}
                          autoFocus
                        />
                        <button type="submit" className="subtask-action" disabled={isPending}>
                          บันทึก
                        </button>
                        <button
                          type="button"
                          className="subtask-action"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                        >
                          ยกเลิก
                        </button>
                      </form>
                    ) : (
                      <>
                        <label className="subtask-title" htmlFor={checkboxId}>
                          {subtask.title}
                        </label>
                        <div className="subtask-actions">
                          {confirmingDeleteId === subtask.id ? (
                            <>
                              <button
                                type="button"
                                className="subtask-action subtask-action-danger"
                                onClick={() => void handleDelete(subtask.id)}
                                disabled={isPending}
                              >
                                ยืนยันลบ
                              </button>
                              <button
                                type="button"
                                className="subtask-action"
                                onClick={() => setConfirmingDeleteId(null)}
                                disabled={isPending}
                              >
                                ยกเลิก
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="subtask-action"
                                onClick={() => {
                                  setEditingId(subtask.id);
                                  setEditingDraft(subtask.title);
                                  setConfirmingDeleteId(null);
                                }}
                              >
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                className="subtask-action subtask-action-danger"
                                onClick={() => {
                                  setConfirmingDeleteId(subtask.id);
                                  setEditingId(null);
                                }}
                              >
                                ลบ
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="checklist-empty">แบ่งงานนี้เป็นขั้นตอนเล็ก ๆ เพื่อทำต่อได้ง่ายขึ้น</p>
        )}

        <form className="subtask-add-form" onSubmit={(event) => void handleCreate(event)}>
          <label className="sr-only" htmlFor={`subtask-new-${task.id}`}>
            เพิ่มรายการย่อย
          </label>
          <input
            id={`subtask-new-${task.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isAtLimit ? "รายการย่อยครบ 30 รายการแล้ว" : "เพิ่มขั้นตอนถัดไป"}
            maxLength={120}
            disabled={isAtLimit || pendingAction === "create"}
          />
          <button
            type="submit"
            className="button button-secondary"
            disabled={isAtLimit || pendingAction === "create"}
          >
            เพิ่ม
          </button>
        </form>
        {errorMessage ? (
          <p className="checklist-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </details>
  );
}
