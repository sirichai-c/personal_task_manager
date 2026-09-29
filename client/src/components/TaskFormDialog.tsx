import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from "react";
import { ApiError } from "../api/tasks";
import type { Task, TaskInput, TaskStatus } from "../types";

interface TaskFormDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (input: TaskInput) => Promise<void>;
}

const EMPTY_FORM: TaskInput = { title: "", description: "", status: "TODO" };

export function TaskFormDialog({ task, onClose, onSave }: TaskFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const [form, setForm] = useState<TaskInput>(() =>
    task
      ? { title: task.title, description: task.description, status: task.status }
      : EMPTY_FORM,
  );
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
      await onSave(form);
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
            id={titleId}
            name="title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            maxLength={120}
            required
            autoFocus
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
