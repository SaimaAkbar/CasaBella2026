import { useEffect, useState, type FormEvent } from 'react';
import { enterElectricityCurrentReading } from '../../api/electricity-readings';
import type { ElectricityReading } from '../../types/expense';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  reading: ElectricityReading | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function EnterCurrentReadingModal({
  open,
  token,
  reading,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [currentReading, setCurrentReading] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !reading) return;
    setCurrentReading(
      String(reading.currentReading ?? reading.currentUnits ?? ''),
    );
    setDueDate(reading.dueDate ? String(reading.dueDate).slice(0, 10) : '');
    setNotes('');
  }, [open, reading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reading || saving) return;
    setSaving(true);
    try {
      await enterElectricityCurrentReading(token, reading.id, {
        currentReading: Number(currentReading),
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save reading.');
    } finally {
      setSaving(false);
    }
  }

  const previous = reading?.previousReading ?? reading?.previousUnits ?? '0';

  return (
    <FormModal open={open} title="Enter Current Reading" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <p className="form-hint">
          {reading?.property?.name ?? 'Property'} —{' '}
          {reading?.unit?.unitNumber ?? 'Unit'}
          <br />
          Previous reading: <strong>{previous}</strong>
        </p>
        <label className="form-field">
          <span>Current Reading</span>
          <input
            type="number"
            min={Number(previous)}
            step="0.001"
            value={currentReading}
            onChange={(e) => setCurrentReading(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="form-field">
          <span>Due Date (optional)</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Reading'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
