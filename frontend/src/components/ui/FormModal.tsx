import type { ReactNode } from 'react';
import { ModalOverlay } from './ModalOverlay';
import './Modal.css';

type FormModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
};

export function FormModal({
  open,
  title,
  children,
  onClose,
  panelClassName,
}: FormModalProps) {
  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div
        className={['modal-panel', panelClassName].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-panel__header">
          <h2 id="form-modal-title">{title}</h2>
          <button
            type="button"
            className="modal-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="modal-panel__body">{children}</div>
      </div>
    </ModalOverlay>
  );
}
