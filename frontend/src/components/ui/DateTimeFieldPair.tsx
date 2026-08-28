import type { ReactNode } from 'react';

type DateTimeFieldPairProps = {
  dateLabel: string;
  timeLabel: string;
  value: string;
  required?: boolean;
  error?: string;
  extra?: ReactNode;
  onChange: (next: string) => void;
};

export function datePart(value: string): string {
  return value.split('T')[0] ?? '';
}

export function timePart(value: string): string {
  return (value.split('T')[1] ?? '').slice(0, 5);
}

export function joinLocalDateTime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

export function DateTimeFieldPair({
  dateLabel,
  timeLabel,
  value,
  required = false,
  error,
  extra,
  onChange,
}: DateTimeFieldPairProps) {
  const date = datePart(value);
  const time = timePart(value);

  return (
    <>
      <label className="form-field">
        <span>{dateLabel}</span>
        <input
          type="date"
          required={required}
          value={date}
          onChange={(event) =>
            onChange(joinLocalDateTime(event.target.value, time))
          }
        />
      </label>
      <label className="form-field">
        <span>{timeLabel}</span>
        <input
          type="time"
          required={required}
          step={60}
          value={time}
          onChange={(event) =>
            onChange(joinLocalDateTime(date, event.target.value))
          }
        />
        {error ? <em className="form-field__error">{error}</em> : null}
        {extra}
      </label>
    </>
  );
}
