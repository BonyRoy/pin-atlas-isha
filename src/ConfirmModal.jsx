import { useEffect } from "react";

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 7h15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.2 7.5 8 18.2a1.4 1.4 0 0 0 1.4 1.3h5.2a1.4 1.4 0 0 0 1.4-1.3l.8-10.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 11.2v5M14 11.2v5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmTone = "danger",
  extraLabel,
  extraTone = "safe",
  cancelLabel = "Cancel",
  onConfirm,
  onExtra,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="modal-kicker">CONFIRM</p>
        <h2 id="confirm-title">{title}</h2>
        <p className="modal-copy">{message}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          {extraLabel ? (
            <button
              type="button"
              className={`modal-confirm is-${extraTone}`}
              onClick={onExtra}
            >
              {extraLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`modal-confirm is-${confirmTone}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
