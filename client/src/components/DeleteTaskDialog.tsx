import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { ApiError } from "../api/tasks";
import type { Task } from "../types";

interface DeleteTaskDialogProps {
  task: Task;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteTaskDialog({ task, onClose, onConfirm }: DeleteTaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
  }, []);

  async function handleConfirm() {
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError ? caughtError.message : "ระบบไม่สามารถลบงานได้",
      );
      setIsDeleting(false);
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement, Event>) {
    if (isDeleting) {
      event.preventDefault();
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog-small"
      aria-labelledby={headingId}
      onCancel={handleCancel}
      onClose={() => {
        if (!isDeleting) {
          onClose();
        }
      }}
    >
      <div className="confirm-dialog">
        <div className="danger-mark" aria-hidden="true">
          !
        </div>
        <h2 id={headingId}>ลบงานนี้หรือไม่</h2>
        <p>
          งาน “<strong>{task?.title}</strong>” จะถูกลบถาวรและเรียกคืนไม่ได้
        </p>
        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isDeleting}
            autoFocus
          >
            เก็บงานไว้
          </button>
          <button
            type="button"
            className="button button-danger"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "กำลังลบ…" : "ลบงาน"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
