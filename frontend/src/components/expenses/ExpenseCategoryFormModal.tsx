import { useState, type FormEvent } from 'react';
import { createExpenseCategory } from '../../api/expense-categories';
import type { ExpenseCategory } from '../../types/expense';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type ExpenseCategoryFormModalProps = {
  open: boolean;
  token: string;
  onClose: () => void;
  onSaved: (category: ExpenseCategory) => void;
  onError: (message: string) => void;
};

export function ExpenseCategoryFormModal({
  open,
  token,
  onClose,
  onSaved,
  onError,
}: ExpenseCategoryFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      onError('Category name is required.');
      return;
    }

    setSaving(true);
    try {
      const category = await createExpenseCategory(token, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      onSaved(category);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to create category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} title="Add Expense Type" onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Category Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Generator Fuel"
            required
          />
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Category'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
