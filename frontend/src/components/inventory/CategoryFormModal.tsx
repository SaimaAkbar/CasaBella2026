import { useEffect, useState, type FormEvent } from 'react';
import {
  createInventoryCategory,
  updateInventoryCategory,
} from '../../api/inventory-categories';
import type { InventoryCategory } from '../../types/inventory';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  category?: InventoryCategory | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function CategoryFormModal({
  open,
  token,
  category,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setDescription(category?.description ?? '');
  }, [open, category]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      onError('Category name is required.');
      return;
    }
    setSaving(true);
    try {
      if (category) {
        await updateInventoryCategory(token, category.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createInventoryCategory(token, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Unable to save category',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      open={open}
      title={category ? 'Edit Category' : 'Add Category'}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
