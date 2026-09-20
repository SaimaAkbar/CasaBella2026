'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchOccupiedDates } from '@/lib/api/bookings';

type Props = {
  unitId?: string | null;
  checkIn: string;
  checkOut: string;
  onChange: (next: { checkIn: string; checkOut: string }) => void;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function todayKey() {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseKey(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addMonths(base: Date, delta: number) {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

export function StayDateCalendar({
  unitId,
  checkIn,
  checkOut,
  onChange,
}: Props) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const parsed = parseKey(checkIn) || new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  });
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState<'checkIn' | 'checkOut'>(
    checkIn ? 'checkOut' : 'checkIn',
  );
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!unitId) {
      setBooked(new Set());
      return;
    }
    const from = toKey(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1,
    );
    const end = addMonths(monthCursor, 2);
    end.setDate(0);
    const to = toKey(end.getFullYear(), end.getMonth(), end.getDate());

    let cancelled = false;
    void fetchOccupiedDates(unitId, from, to)
      .then((res) => {
        if (cancelled) return;
        setBooked(new Set(res.bookedDates));
        setLoadError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setBooked(new Set());
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load booked dates.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, monthCursor]);

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{
      key: string;
      day: number;
      inMonth: boolean;
    }> = [];

    for (let i = 0; i < firstDow; i += 1) {
      cells.push({ key: `pad-${i}`, day: 0, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        key: toKey(year, month, day),
        day,
        inMonth: true,
      });
    }
    return cells;
  }, [monthCursor]);

  const minDay = todayKey();

  function isInSelection(key: string) {
    if (!checkIn) return false;
    if (!checkOut) return key === checkIn;
    return key >= checkIn && key < checkOut;
  }

  function onDayClick(key: string) {
    if (booked.has(key) || key < minDay) return;

    if (picking === 'checkIn' || !checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: key, checkOut: '' });
      setPicking('checkOut');
      return;
    }

    if (key <= checkIn) {
      onChange({ checkIn: key, checkOut: '' });
      setPicking('checkOut');
      return;
    }

    // Selection cannot cross a booked night
    for (
      let cursor = parseKey(checkIn)!;
      ;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const k = toKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      if (k >= key) break;
      if (booked.has(k)) {
        setLoadError(
          'Selected dates include a booked night. Choose another range.',
        );
        return;
      }
    }

    onChange({ checkIn, checkOut: key });
    setPicking('checkIn');
    setLoadError('');
  }

  const monthLabel = monthCursor.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="stay-cal">
      <div className="stay-cal__toolbar">
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => setMonthCursor((m) => addMonths(m, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          className="stay-cal__nav"
          onClick={() => setMonthCursor((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <p className="stay-cal__hint">
        {unitId
          ? picking === 'checkOut' && checkIn
            ? 'Select check-out date. Red days are already booked.'
            : 'Select check-in, then check-out. Red days are already booked.'
          : 'Select a room first to see booked dates in red.'}
      </p>

      <div className="stay-cal__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="stay-cal__grid">
        {days.map((cell) => {
          if (!cell.inMonth) {
            return <span key={cell.key} className="stay-cal__cell is-empty" />;
          }
          const isBooked = booked.has(cell.key);
          const isPast = cell.key < minDay;
          const isSelected = isInSelection(cell.key);
          const isStart = cell.key === checkIn;
          const isEnd = checkOut ? cell.key === checkOut : false;
          return (
            <button
              key={cell.key}
              type="button"
              disabled={isBooked || isPast || !unitId}
              className={[
                'stay-cal__cell',
                isBooked ? 'is-booked' : '',
                isPast ? 'is-past' : '',
                isSelected ? 'is-selected' : '',
                isStart ? 'is-start' : '',
                isEnd ? 'is-end' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onDayClick(cell.key)}
              title={isBooked ? 'Booked' : cell.key}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="stay-cal__legend">
        <span>
          <i className="stay-cal__swatch is-booked" /> Booked
        </span>
        <span>
          <i className="stay-cal__swatch is-selected" /> Selected
        </span>
        <span>
          Check-in: <strong>{checkIn || '—'}</strong>
        </span>
        <span>
          Check-out: <strong>{checkOut || '—'}</strong>
        </span>
      </div>
      {loadError ? <p className="stay-cal__error">{loadError}</p> : null}
    </div>
  );
}
