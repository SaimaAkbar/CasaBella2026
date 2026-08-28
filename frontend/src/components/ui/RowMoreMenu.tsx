import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './RowMoreMenu.css';

export type RowMoreMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  hidden?: boolean;
  onClick: () => void;
};

type Props = {
  items: RowMoreMenuItem[];
  label?: string;
};

const MENU_MIN_WIDTH = 216;

export function RowMoreMenu({ items, label = 'More actions' }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const visible = items.filter((item) => !item.hidden);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  function placeMenu() {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(MENU_MIN_WIDTH, menu?.offsetWidth ?? MENU_MIN_WIDTH);
    const menuHeight = menu?.offsetHeight ?? visible.length * 36 + 12;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight + 8;
    const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    let left = rect.right - menuWidth;
    left = Math.min(left, window.innerWidth - menuWidth - 8);
    left = Math.max(8, left);
    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;

    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    function onScrollOrResize() {
      setOpen(false);
    }

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div className="row-more" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="data-table__action row-more__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ⋮
      </button>
      {open
        ? createPortal(
            <div
              className="row-more__menu"
              id={menuId}
              role="menu"
              ref={menuRef}
              style={{ top: coords.top, left: coords.left }}
            >
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`row-more__item${item.danger ? ' is-danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function RowMoreHint({ children }: { children: ReactNode }) {
  return <span className="row-more__hint">{children}</span>;
}
