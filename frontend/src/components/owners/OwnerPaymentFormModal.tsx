import { useEffect, useState, type FormEvent } from 'react';
import { createOwnerPayment } from '../../api/owners';
import { PrintReceiptActions } from '../receipts/PrintReceiptActions';
import { FormModal } from '../ui/FormModal';
import type { ReceiptPrintTarget } from '../../types/receipt';
import { formatPkr } from '../../lib/format';
import type { OwnerMonthlyStatement } from '../../types/owner';
import '../../styles/forms.css';

const METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'EASYPAISA',
  'JAZZCASH',
  'OTHER',
] as const;

type Props = {
  open: boolean;
  token: string;
  statement: OwnerMonthlyStatement | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function OwnerPaymentFormModal({
  open,
  token,
  statement,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [bankName, setBankName] = useState('');
  const [accountTitle, setAccountTitle] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printTarget, setPrintTarget] = useState<ReceiptPrintTarget | null>(null);

  useEffect(() => {
    if (!open || !statement) return;
    setSaved(false);
    setPrintTarget(null);
    setAmount(statement.remainingAmount);
    setPaymentMethod('CASH');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setBankName('');
    setAccountTitle('');
    setTransactionReference('');
    setNotes('');
  }, [open, statement]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!statement || busy) return;
    setBusy(true);
    try {
      const payment = await createOwnerPayment(token, {
        ownerMonthlyStatementId: statement.id,
        amount: Number(amount),
        paymentMethod,
        paymentDate,
        bankName: bankName.trim() || undefined,
        accountTitle: accountTitle.trim() || undefined,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setPrintTarget({ sourceType: 'owner_payment', sourceId: payment.id });
      setSaved(true);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to record payment');
    } finally {
      setBusy(false);
    }
  }

  if (!statement) {
    return null;
  }

  return (
    <FormModal
      open={open}
      title={saved ? 'Payment Recorded' : 'Record Owner Payment'}
      onClose={onClose}
    >
      {saved ? (
        <>
          <p className="form-hint">Owner payment saved successfully.</p>
          <PrintReceiptActions
            token={token}
            target={printTarget}
            onError={onError}
          />
          <div className="form-actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </>
      ) : (
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-grid form-grid--2">
          <label className="form-field">
            <span>Owner</span>
            <input readOnly value={statement.owner?.fullName ?? ''} />
          </label>
          <label className="form-field">
            <span>Property / Unit</span>
            <input
              readOnly
              value={`${statement.property?.name ?? ''} — ${statement.unit?.unitNumber ?? ''}`}
            />
          </label>
          <label className="form-field">
            <span>Month / Year</span>
            <input
              readOnly
              value={`${statement.statementMonth}/${statement.statementYear}`}
            />
          </label>
          <label className="form-field">
            <span>Direction</span>
            <input
              readOnly
              value={
                statement.accountDirection === 'RECEIVABLE_FROM_OWNER'
                  ? 'Receivable from owner'
                  : 'Payable to owner'
              }
            />
          </label>
          <label className="form-field">
            <span>Expected</span>
            <input
              readOnly
              value={formatPkr(statement.totalPayableOrReceivable)}
            />
          </label>
          <label className="form-field">
            <span>Already Paid</span>
            <input readOnly value={formatPkr(statement.totalPaid)} />
          </label>
          <label className="form-field">
            <span>Remaining</span>
            <input readOnly value={formatPkr(statement.remainingAmount)} />
          </label>
          <label className="form-field">
            <span>Payment Amount</span>
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="form-hint">
              Defaults to remaining. Paying the full remaining amount turns
              status green Paid.
            </p>
          </label>
          <label className="form-field">
            <span>Payment Date</span>
            <input
              required
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Bank Name</span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Account Title</span>
            <input
              value={accountTitle}
              onChange={(e) => setAccountTitle(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>Transaction Reference</span>
            <input
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
            />
          </label>
          <label className="form-field form-field--full">
            <span>Notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </form>
      )}
    </FormModal>
  );
}
