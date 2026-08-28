import { useEffect, useState } from 'react';
import {
  fetchOwnerAssignments,
  fetchOwnerSummary,
  fetchOwnerYearView,
} from '../../api/owners';
import { formatDate, formatPkr } from '../../lib/format';
import type {
  OwnerAgreementRevisionRow,
  OwnerDetailSummary,
  OwnerMonthlyStatement,
  OwnerUnitAssignment,
  OwnerYearView,
} from '../../types/owner';
import { SummaryCard } from '../dashboard/SummaryCard';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { StatusBadge } from '../ui/StatusBadge';
import { OwnerPaymentStatusTick } from './OwnerPaymentStatusTick';
import './OwnerDetailDrawer.css';

type DetailTab =
  | 'profile'
  | 'agreements'
  | 'statements'
  | 'payments'
  | 'history';

type Props = {
  open: boolean;
  token: string;
  ownerId: string | null;
  refreshVersion?: number;
  periodLabel?: string;
  isSuperAdmin: boolean;
  onClose: () => void;
  onPayStatement?: (statementId: string) => void;
  onMarkPaid?: (statement: OwnerMonthlyStatement) => void;
  onReviseAssignment?: (assignment: OwnerUnitAssignment) => void;
  onEndAssignment?: (assignment: OwnerUnitAssignment) => void;
  onError: (message: string) => void;
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function OwnerDetailDrawer({
  open,
  token,
  ownerId,
  refreshVersion = 0,
  periodLabel,
  isSuperAdmin,
  onClose,
  onPayStatement,
  onMarkPaid,
  onReviseAssignment,
  onEndAssignment,
  onError,
}: Props) {
  const [tab, setTab] = useState<DetailTab>('profile');
  const [summary, setSummary] = useState<OwnerDetailSummary | null>(null);
  const [yearView, setYearView] = useState<OwnerYearView | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [assignments, setAssignments] = useState<OwnerUnitAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ownerId) return;
    setTab('profile');
    setLoading(true);
    void Promise.all([
      fetchOwnerSummary(token, ownerId),
      fetchOwnerAssignments(token, { ownerId }),
      fetchOwnerYearView(token, ownerId, year),
    ])
      .then(([s, a, y]) => {
        setSummary(s);
        setAssignments(a);
        setYearView(y);
      })
      .catch((err) =>
        onError(err instanceof Error ? err.message : 'Unable to load owner'),
      )
      .finally(() => setLoading(false));
  }, [open, ownerId, token, refreshVersion, year, onError]);

  useEffect(() => {
    if (!open || !ownerId) return;
    void fetchOwnerYearView(token, ownerId, year)
      .then(setYearView)
      .catch((err) =>
        onError(err instanceof Error ? err.message : 'Unable to load year view'),
      );
  }, [year, open, ownerId, token, onError]);

  if (!open || !ownerId) return null;

  const owner = summary?.owner;

  return (
    <div className="owners-page__drawer" role="dialog">
      <div className="owners-page__drawer-panel owner-detail-drawer">
        <header>
          <div>
            <h2>{owner?.fullName ?? 'Owner detail'}</h2>
            <p>
              {owner?.phone ?? '—'}
              {owner?.email ? ` · ${owner.email}` : ''}
              {periodLabel ? ` · ${periodLabel}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="owner-detail-drawer__tabs">
          {(
            [
              ['profile', 'Profile'],
              ['agreements', 'Units & Agreements'],
              ['statements', 'Monthly Statements'],
              ['payments', 'Payments'],
              ['history', 'History'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`owners-page__tab${tab === key ? ' owners-page__tab--active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading || !summary ? (
          <p>Loading…</p>
        ) : (
          <>
            <div className="owners-page__summary owners-page__summary--pastel">
              <SummaryCard
                label="Receivable remaining"
                value={formatPkr(summary.totals.thisMonthReceivableRemaining)}
                tone="gold"
              />
              <SummaryCard
                label="Payable remaining"
                value={formatPkr(summary.totals.thisMonthPayableRemaining)}
                tone="info"
              />
              <SummaryCard
                label="Paid (recv)"
                value={formatPkr(summary.totals.thisMonthReceivablePaid)}
                tone="success"
              />
              <SummaryCard
                label="Paid (pay)"
                value={formatPkr(summary.totals.thisMonthPayablePaid)}
                tone="danger"
              />
            </div>

            {tab === 'profile' ? (
              <dl className="owner-detail-drawer__profile">
                <div>
                  <dt>Full name</dt>
                  <dd>{owner?.fullName}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{owner?.phone}</dd>
                </div>
                <div>
                  <dt>Alternate</dt>
                  <dd>{owner?.alternatePhone ?? '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{owner?.email ?? '—'}</dd>
                </div>
                <div>
                  <dt>CNIC</dt>
                  <dd>{owner?.cnic ?? '—'}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{owner?.city ?? '—'}</dd>
                </div>
                <div>
                  <dt>Bank</dt>
                  <dd>{owner?.bankName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>{owner?.accountNumberOrIban ?? '—'}</dd>
                </div>
                <div className="owner-detail-drawer__full">
                  <dt>Address</dt>
                  <dd>{owner?.address ?? '—'}</dd>
                </div>
                <div className="owner-detail-drawer__full">
                  <dt>Notes</dt>
                  <dd>{owner?.notes ?? '—'}</dd>
                </div>
              </dl>
            ) : null}

            {tab === 'agreements' ? (
              <div className="owner-detail-drawer__stack">
                <table className="owners-page__detail-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Unit</th>
                      <th>%</th>
                      <th>Monthly</th>
                      <th>Status</th>
                      <th>This month</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.assignments.map((a) => {
                      const full = assignments.find((x) => x.id === a.id);
                      return (
                        <tr key={a.id}>
                          <td>{a.property.name}</td>
                          <td>{a.unit.unitNumber}</td>
                          <td>{a.ownershipPercentage}%</td>
                          <td>
                            <MoneyDisplay value={a.fixedMonthlyAmount} />
                          </td>
                          <td>
                            <StatusBadge status={a.status} />
                          </td>
                          <td>
                            <OwnerPaymentStatusTick
                              status={a.thisMonthStatus}
                              tick={a.thisMonthStatusTick}
                            />
                          </td>
                          <td>
                            <div className="owners-page__actions">
                              {isSuperAdmin &&
                              a.status === 'ACTIVE' &&
                              full &&
                              onReviseAssignment ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => onReviseAssignment(full)}
                                >
                                  Revise
                                </button>
                              ) : null}
                              {a.status === 'ACTIVE' &&
                              full &&
                              onEndAssignment ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => onEndAssignment(full)}
                                >
                                  End
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <section className="owner-detail-drawer__year">
                  <div className="owner-detail-drawer__year-head">
                    <h3>Year View</h3>
                    <label>
                      Year
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  {yearView?.units.length ? (
                    yearView.units.map((unit) => (
                      <div key={unit.unitId} className="owner-year-grid">
                        <h4>
                          {unit.propertyName} — {unit.unitNumber}
                        </h4>
                        <div className="owner-year-grid__months">
                          {unit.months.map((m) => (
                            <div
                              key={m.month}
                              className="owner-year-grid__cell"
                              title={
                                m.paymentStatus
                                  ? `${MONTH_LABELS[m.month - 1]}: ${m.paymentStatus}`
                                  : `${MONTH_LABELS[m.month - 1]}: no statement`
                              }
                            >
                              <span className="owner-year-grid__label">
                                {MONTH_LABELS[m.month - 1]}
                              </span>
                              <span className="owner-year-grid__icon">
                                {m.paymentStatusTick?.icon ?? '·'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>No statements for {year}.</p>
                  )}
                </section>
              </div>
            ) : null}

            {tab === 'statements' ? (
              <table className="owners-page__detail-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Unit</th>
                    <th>Expected</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.statements.map((s) => {
                    const remaining = Number(s.remainingAmount);
                    const canMark =
                      isSuperAdmin &&
                      s.paymentStatus !== 'PAID' &&
                      s.paymentStatus !== 'OVERPAID' &&
                      Number.isFinite(remaining) &&
                      remaining > 0;
                    return (
                      <tr key={s.id}>
                        <td>
                          {s.statementMonth}/{s.statementYear}
                        </td>
                        <td>
                          {s.property.name} / {s.unit.unitNumber}
                        </td>
                        <td>
                          <MoneyDisplay value={s.expectedAmount} />
                        </td>
                        <td>
                          <MoneyDisplay value={s.totalPaid} />
                        </td>
                        <td>
                          <MoneyDisplay value={s.remainingAmount} />
                        </td>
                        <td>
                          <OwnerPaymentStatusTick
                            status={s.paymentStatus}
                            tick={s.paymentStatusTick}
                          />
                        </td>
                        <td>
                          <div className="owners-page__actions">
                            {onPayStatement ? (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onPayStatement(s.id);
                                }}
                              >
                                Pay
                              </button>
                            ) : null}
                            {canMark && onMarkPaid ? (
                              <button
                                type="button"
                                className="btn btn--ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onMarkPaid({
                                    id: s.id,
                                    ownerUnitAssignmentId: '',
                                    ownerId: ownerId!,
                                    propertyId: s.property.id,
                                    unitId: s.unit.id,
                                    statementMonth: s.statementMonth,
                                    statementYear: s.statementYear,
                                    accountDirection: s.accountDirection,
                                    expectedAmount: s.expectedAmount,
                                    previousBalance: '0',
                                    adjustmentAmount: '0',
                                    totalPayableOrReceivable: s.expectedAmount,
                                    totalPaid: s.totalPaid,
                                    remainingAmount: s.remainingAmount,
                                    dueDate: s.dueDate,
                                    paymentStatus: s.paymentStatus,
                                    paymentStatusTick: s.paymentStatusTick,
                                    finalized: false,
                                    notes: null,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    owner: owner
                                      ? {
                                          id: owner.id,
                                          fullName: owner.fullName,
                                          phone: owner.phone,
                                        }
                                      : undefined,
                                    property: s.property,
                                    unit: s.unit,
                                  });
                                }}
                              >
                                Mark Paid
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}

            {tab === 'payments' ? (
              <table className="owners-page__detail-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>#</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Unit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td>{p.paymentNumber}</td>
                      <td>
                        <MoneyDisplay value={p.amount} />
                      </td>
                      <td>{p.paymentMethod.replaceAll('_', ' ')}</td>
                      <td>
                        {p.property?.name ?? '—'} / {p.unit?.unitNumber ?? '—'}
                      </td>
                      <td>{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === 'history' ? (
              <div className="owner-detail-drawer__stack">
                <h3>Agreement revisions</h3>
                {summary.revisions.length ? (
                  <table className="owners-page__detail-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Unit</th>
                        <th>Old → New</th>
                        <th>Effective</th>
                        <th>Reason</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.revisions.map((r: OwnerAgreementRevisionRow) => (
                        <tr key={r.id}>
                          <td>{formatDate(r.createdAt)}</td>
                          <td>
                            {r.propertyName} / {r.unitNumber}
                          </td>
                          <td>
                            {formatPkr(r.previousFixedMonthlyAmount)} →{' '}
                            {formatPkr(r.newFixedMonthlyAmount)}
                          </td>
                          <td>{formatDate(r.effectiveFrom)}</td>
                          <td>{r.reason}</td>
                          <td>{r.createdBy.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No revisions yet.</p>
                )}
                <h3>Audit</h3>
                {summary.history.length ? (
                  <table className="owners-page__detail-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.history.map((h) => (
                        <tr key={h.id}>
                          <td>{formatDate(h.createdAt)}</td>
                          <td>{h.action}</td>
                          <td>{h.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No audit events.</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
