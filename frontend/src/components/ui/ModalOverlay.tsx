import {
  useEffect,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

type ModalOverlayProps = {
  open: boolean;
  children: ReactNode;
  onClose: () => void;
  className?: string;
};

export function ModalOverlay({
  open,
  children,
  onClose,
  className,
}: ModalOverlayProps) {
  useEffect(() => {
    if (!open) return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
      htmlOverflow: documentElement.style.overflow,
    };
    const scrollbar = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.paddingRight = previous.paddingRight;
      documentElement.style.overflow = previous.htmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  if (!open) return null;

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return createPortal(
    <div
      className={className ? `modal-overlay ${className}` : 'modal-overlay'}
      role="presentation"
      onMouseDown={handleBackdrop}
    >
      {children}
    </div>,
    document.body,
  );
}
