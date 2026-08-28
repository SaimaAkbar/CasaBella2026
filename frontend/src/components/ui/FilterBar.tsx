import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import './FilterBar.css';

type FilterBarProps = {
  children: ReactNode;
};

function keepWindowScroll(
  event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>,
) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const x = window.scrollX;
  const y = window.scrollY;
  window.requestAnimationFrame(() => window.scrollTo(x, y));
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <section
      className="filter-bar"
      onMouseDown={keepWindowScroll}
      onFocusCapture={keepWindowScroll}
    >
      {children}
    </section>
  );
}
