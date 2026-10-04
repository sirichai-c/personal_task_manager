import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from "react";
import { ApiError } from "../api/tasks";
import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskRecurrence,
  TaskReminder,
  TaskStatus,
} from "../types";

interface TaskFormDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}

const EMPTY_FORM: TaskInput = {
  title: "",
  description: "",
  status: "TODO",
  dueDate: "",
  priority: "NORMAL",
  recurrence: "NONE",
  reminder: "NONE",
  tags: [],
};

export function TaskFormDialog({ task, onClose, onSave }: TaskFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const dueDateId = useId();
  const statusId = useId();
  const priorityId = useId();
  const recurrenceId = useId();
  const reminderId = useId();
  const tagsId = useId();
  const [form, setForm] = useState<TaskInput>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          dueDate: task.dueDate ?? "",
          priority: task.priority,
          recurrence: task.recurrence,
          reminder: task.reminder,
          tags: task.tags,
        }
      : EMPTY_FORM,
  );
  const [tagsDraft, setTagsDraft] = useState(() => task?.tags.join(", ") ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
      titleInputRef.current?.focus();
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setFieldErrors({});
    setFormError("");
    try {
      await onSave({
        ...form,
        tags: tagsDraft
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("ระบบไม่สามารถบันทึกงานได้");
      }
      setIsSaving(false);
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement, Event>) {
    if (isSaving) {
      event.preventDefault();
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={`${titleId}-heading`}
      onCancel={handleCancel}
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <form className="task-form" onSubmit={handleSubmit} noValidate>
        <div className="dialog-heading">
          <div>
            <h2 id={`${titleId}-heading`}>{task ? "แก้ไขงาน" : "เพิ่มงานใหม่"}</h2>
            <p>{task ? "ปรับรายละเอียดหรือเปลี่ยนสถานะได้ทุกเมื่อ" : "บันทึกสิ่งที่ต้องทำให้ชัดเจน"}</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="ปิดหน้าต่าง"
          >
            ×
          </button>
        </div>

        {formError ? (
          <div className="form-error" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="field">
          <div className="field-label-row">
            <label htmlFor={titleId}>ชื่องาน</label>
            <span>{Array.from(form.title).length}/120</span>
          </div>
          <input
            ref={titleInputRef}
            id={titleId}
            name="title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            maxLength={120}
            required
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? `${titleId}-error` : undefined}
            placeholder="เช่น เตรียมเอกสารประชุม"
          />
          {fieldErrors.title ? (
            <span id={`${titleId}-error`} className="field-error">
              {fieldErrors.title}
            </span>
          ) : null}
        </div>

        <div className="field">
          <div className="field-label-row">
            <label htmlFor={descriptionId}>รายละเอียด</label>
            <span>{Array.from(form.description).length}/2,000</span>
          </div>
          <textarea
            id={descriptionId}
            name="description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            maxLength={2_000}
            rows={5}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? `${descriptionId}-error` : undefined}
            placeholder="เพิ่มข้อมูลที่ช่วยให้กลับมาทำงานต่อได้ง่าย"
          />
          {fieldErrors.description ? (
            <span id={`${descriptionId}-error`} className="field-error">
              {fieldErrors.description}
            </span>
          ) : null}
        </div>

        <div className="field">
          <div className="field-label-row">
            <label htmlFor={dueDateId}>วันครบกำหนด</label>
            <span>
              {form.recurrence === "NONE" && form.reminder === "NONE"
                ? "ไม่บังคับ"
                : "ต้องกำหนด"}
            </span>
          </div>
          <input
            id={dueDateId}
            name="dueDate"
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.dueDate)}
            aria-required={form.recurrence !== "NONE" || form.reminder !== "NONE"}
            aria-describedby={fieldErrors.dueDate ? `${dueDateId}-error` : undefined}
          />
          {fieldErrors.dueDate ? (
            <span id={`${dueDateId}-error`} className="field-error">
              {fieldErrors.dueDate}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={reminderId}>เตือนฉัน</label>
          <select
            id={reminderId}
            name="reminder"
            value={form.reminder}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reminder: event.target.value as TaskReminder,
              }))
            }
            aria-invalid={Boolean(fieldErrors.reminder)}
            aria-describedby={
              fieldErrors.reminder
                ? `${reminderId}-error`
                : form.reminder !== "NONE"
                  ? `${reminderId}-hint`
                  : undefined
            }
          >
            <option value="NONE">ไม่เตือน</option>
            <option value="ON_DUE_DATE">วันครบกำหนด</option>
            <option value="ONE_DAY_BEFORE">ล่วงหน้า 1 วัน</option>
            <option value="THREE_DAYS_BEFORE">ล่วงหน้า 3 วัน</option>
            <option value="SEVEN_DAYS_BEFORE">ล่วงหน้า 7 วัน</option>
          </select>
          {form.reminder !== "NONE" ? (
            <span id={`${reminderId}-hint`} className="field-hint">
              การเตือนจะแสดงในแอปเมื่อถึงช่วงที่เลือก
            </span>
          ) : null}
          {fieldErrors.reminder ? (
            <span id={`${reminderId}-error`} className="field-error">
              {fieldErrors.reminder}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={recurrenceId}>ทำซ้ำ</label>
          <select
            id={recurrenceId}
            name="recurrence"
            value={form.recurrence}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recurrence: event.target.value as TaskRecurrence,
              }))
            }
            aria-invalid={Boolean(fieldErrors.recurrence)}
            aria-describedby={
              fieldErrors.recurrence
                ? `${recurrenceId}-error`
                : form.recurrence !== "NONE"
                  ? `${recurrenceId}-hint`
                  : undefined
            }
          >
            <option value="NONE">ไม่ทำซ้ำ</option>
            <option value="DAILY">ทุกวัน</option>
            <option value="WEEKLY">ทุกสัปดาห์</option>
            <option value="MONTHLY">ทุกเดือน</option>
          </select>
          {form.recurrence !== "NONE" ? (
            <span id={`${recurrenceId}-hint`} className="field-hint">
              เมื่อทำงานเสร็จ ระบบจะสร้างงานรอบถัดไปพร้อมรายการย่อยที่ยังไม่ทำ
            </span>
          ) : null}
          {fieldErrors.recurrence ? (
            <span id={`${recurrenceId}-error`} className="field-error">
              {fieldErrors.recurrence}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={priorityId}>ความสำคัญ</label>
          <select
            id={priorityId}
            name="priority"
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                priority: event.target.value as TaskPriority,
              }))
            }
            aria-invalid={Boolean(fieldErrors.priority)}
            aria-describedby={fieldErrors.priority ? `${priorityId}-error` : undefined}
          >
            <option value="LOW">ต่ำ</option>
            <option value="NORMAL">ปกติ</option>
            <option value="HIGH">สูง</option>
          </select>
          {fieldErrors.priority ? (
            <span id={`${priorityId}-error`} className="field-error">
              {fieldErrors.priority}
            </span>
          ) : null}
        </div>

        <div className="field">
          <div className="field-label-row">
            <label htmlFor={tagsId}>แท็ก</label>
            <span>ไม่เกิน 10 แท็ก</span>
          </div>
          <input
            id={tagsId}
            name="tags"
            value={tagsDraft}
            onChange={(event) => setTagsDraft(event.target.value)}
            maxLength={319}
            aria-invalid={Boolean(fieldErrors.tags)}
            aria-describedby={fieldErrors.tags ? `${tagsId}-error` : `${tagsId}-hint`}
            placeholder="เช่น งาน, ด่วน, ส่วนตัว"
          />
          <span id={`${tagsId}-hint`} className="field-hint">
            คั่นแต่ละแท็กด้วยจุลภาค และยาวไม่เกิน 30 ตัวอักษรต่อแท็ก
          </span>
          {fieldErrors.tags ? (
            <span id={`${tagsId}-error`} className="field-error">
              {fieldErrors.tags}
            </span>
          ) : null}
        </div>

        {task ? (
          <div className="field">
            <label htmlFor={statusId}>สถานะ</label>
            <select
              id={statusId}
              name="status"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as TaskStatus,
                }))
              }
              aria-invalid={Boolean(fieldErrors.status)}
            >
              <option value="TODO">ต้องทำ</option>
              <option value="IN_PROGRESS">กำลังทำ</option>
              <option value="DONE">เสร็จแล้ว</option>
            </select>
          </div>
        ) : (
          <p className="default-status-note">
            งานใหม่จะเริ่มที่สถานะ <strong>ต้องทำ</strong>
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={isSaving}>
            ยกเลิก
          </button>
          <button type="submit" className="button button-primary" disabled={isSaving}>
            {isSaving ? "กำลังบันทึก…" : task ? "บันทึกการแก้ไข" : "เพิ่มงาน"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
