import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  requireReason = false,
  reasonLabel = 'Motivo (obrigatório)',
  reasonValue = '',
  onReasonChange,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef(null);
  const reasonOk = !requireReason || reasonValue.trim().length >= 3;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => cancelRef.current?.focus(), 0);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-modal-title">{title}</h3>
        {description ? <p>{description}</p> : null}
        {requireReason ? (
          <label className="builder-field" style={{ marginTop: 4 }}>
            <span>{reasonLabel}</span>
            <textarea
              value={reasonValue}
              onChange={(event) => onReasonChange?.(event.target.value.slice(0, 300))}
              rows={3}
              placeholder="Descreva o motivo desta ação"
            />
          </label>
        ) : null}
        <div className="confirm-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="ghost-button"
            onClick={onCancel}
            title={cancelLabel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'danger-button' : 'primary-button button-inline'}
            onClick={onConfirm}
            disabled={!reasonOk}
            title={confirmLabel}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
