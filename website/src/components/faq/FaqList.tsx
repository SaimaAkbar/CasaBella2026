'use client';

import { useState } from 'react';
import type { FaqItem } from '@/types';

export function FaqList({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="faq-list">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className={`faq-item${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className="faq-item__q"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.id)}
            >
              {item.question}
              <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
            {open ? <div className="faq-item__a">{item.answer}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
