import { FormModal } from '../ui/FormModal';
import { ReceiptPreview } from './ReceiptPreview';
import type { ThermalReceipt } from '../../types/receipt';
import './receipt.css';

type Props = {
  open: boolean;
  receipt: ThermalReceipt | null;
  busy?: boolean;
  onClose: () => void;
  onPrint: () => void;
};

export function ReceiptPreviewModal({
  open,
  receipt,
  busy = false,
  onClose,
  onPrint,
}: Props) {
  return (
    <FormModal
      open={open}
      title="Receipt Preview"
      onClose={() => !busy && onClose()}
    >
      {receipt ? <ReceiptPreview receipt={receipt} /> : null}
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
          Close
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onPrint}
          disabled={busy || !receipt}
        >
          {busy ? 'Printing…' : 'Print'}
        </button>
      </div>
    </FormModal>
  );
}
