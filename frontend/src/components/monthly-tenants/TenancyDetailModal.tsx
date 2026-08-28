import { formatDate, formatLabel } from '../../lib/format';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import { PaymentHistoryList } from '../payments/PaymentHistoryList';
import { FormModal } from '../ui/FormModal';
import { MoneyDisplay } from '../ui/MoneyDisplay';
import { OccupancyBadge } from '../ui/OccupancyBadge';
import { PaymentStatusBadge } from '../ui/PaymentStatusBadge';
import { StatusBadge } from '../ui/StatusBadge';
import '../../styles/forms.css';

type TenancyDetailModalProps = {
  open: boolean;
  tenancy: MonthlyTenancy | null;
  canViewFinancials: boolean;
  canMarkOccupancy: boolean;
  canEnd: boolean;
  canArchiveTenant: boolean;
  busy: boolean;
  token?: string;
  canAddPayment?: boolean;
  paymentRefreshKey?: number;
  onAddPayment?: () => void;
  onClose: () => void;
  onMarkEmpty: () => void;
  onMarkOccupied: () => void;
  onEnd: () => void;
  onArchiveTenant: () => void;
};

export function TenancyDetailModal({
  open,
  tenancy,
  canViewFinancials,
  canMarkOccupancy,
  canEnd,
  canArchiveTenant,
  busy,
  token,
  canAddPayment = false,
  paymentRefreshKey = 0,
  onAddPayment,
  onClose,
  onMarkEmpty,
  onMarkOccupied,
  onEnd,
  onArchiveTenant,
}: TenancyDetailModalProps) {
  if (!tenancy) {
    return null;
  }

  const isActive = tenancy.tenancyStatus === 'ACTIVE';

  return (
    <FormModal open={open} title="Tenancy Details" onClose={onClose}>
      <dl className="detail-list">
        <div>
          <dt>Tenant</dt>
          <dd>{tenancy.tenant?.fullName ?? '—'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{tenancy.tenant?.phone ?? '—'}</dd>
        </div>
        {canViewFinancials && tenancy.tenant?.cnic ? (
          <div>
            <dt>CNIC</dt>
            <dd>{tenancy.tenant.cnic}</dd>
          </div>
        ) : null}
        {canViewFinancials && tenancy.tenant?.address ? (
          <div>
            <dt>Address</dt>
            <dd>{tenancy.tenant.address}</dd>
          </div>
        ) : null}
        <div>
          <dt>Property</dt>
          <dd>{tenancy.unit?.property?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Floor</dt>
          <dd>
            {tenancy.unit?.floor == null ? '—' : String(tenancy.unit.floor)}
          </dd>
        </div>
        <div>
          <dt>Agreement Start</dt>
          <dd>{formatDate(tenancy.agreementStart)}</dd>
        </div>
        <div>
          <dt>Agreement End</dt>
          <dd>{formatDate(tenancy.agreementEnd)}</dd>
        </div>

        {canViewFinancials ? (
          <>
            <div>
              <dt>Security Deposit</dt>
              <dd>
                <MoneyDisplay value={tenancy.securityDeposit} />
              </dd>
            </div>
            <div>
              <dt>Monthly Rent</dt>
              <dd>
                <MoneyDisplay value={tenancy.monthlyRent} />
              </dd>
            </div>
            <div>
              <dt>Maintenance</dt>
              <dd>
                <MoneyDisplay value={tenancy.maintenanceCharges} />
              </dd>
            </div>
            <div>
              <dt>Laundry</dt>
              <dd>
                <MoneyDisplay value={tenancy.laundryCharges} />
              </dd>
            </div>
            <div>
              <dt>Cleaning</dt>
              <dd>
                <MoneyDisplay value={tenancy.cleaningCharges} />
              </dd>
            </div>
            <div>
              <dt>Water</dt>
              <dd>
                <MoneyDisplay value={tenancy.waterCharges} />
              </dd>
            </div>
            <div>
              <dt>Society</dt>
              <dd>
                <MoneyDisplay value={tenancy.societyCharges} />
              </dd>
            </div>
            <div>
              <dt>Electricity</dt>
              <dd>
                <MoneyDisplay value={tenancy.electricityCharges} />
              </dd>
            </div>
            <div>
              <dt>Other Charges</dt>
              <dd>
                <MoneyDisplay value={tenancy.otherCharges} />
              </dd>
            </div>
            <div>
              <dt>Previous Balance</dt>
              <dd>
                <MoneyDisplay value={tenancy.previousBalance} />
              </dd>
            </div>
            <div>
              <dt>Total Payable</dt>
              <dd>
                <MoneyDisplay value={tenancy.totalPayable} />
              </dd>
            </div>
            <div>
              <dt>Total Received</dt>
              <dd>
                <MoneyDisplay value={tenancy.totalReceived} />
              </dd>
            </div>
            <div>
              <dt>Remaining Balance</dt>
              <dd>
                <MoneyDisplay value={tenancy.remainingBalance} />
              </dd>
            </div>
            <div>
              <dt>Electricity Bill</dt>
              <dd>
                {tenancy.electricityReadingRequired
                  ? 'READING REQUIRED'
                  : <MoneyDisplay value={tenancy.electricityBillAmount} />}
              </dd>
            </div>
            <div>
              <dt>Electricity Paid</dt>
              <dd>
                {tenancy.electricityReadingRequired ? '—' : (
                  <MoneyDisplay value={tenancy.electricityPaidAmount} />
                )}
              </dd>
            </div>
            <div>
              <dt>Electricity Remaining</dt>
              <dd>
                {tenancy.electricityReadingRequired ? '—' : (
                  <MoneyDisplay value={tenancy.electricityRemainingAmount} />
                )}
              </dd>
            </div>
            <div>
              <dt>Total Outstanding</dt>
              <dd>
                <MoneyDisplay value={tenancy.totalOutstanding} />
              </dd>
            </div>
            <div>
              <dt>Payment State</dt>
              <dd>
                <PaymentStatusBadge state={tenancy.paymentState} />
              </dd>
            </div>
          </>
        ) : null}

        <div>
          <dt>Occupancy</dt>
          <dd>
            <OccupancyBadge state={tenancy.occupancyState} />
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge
              status={
                tenancy.tenancyStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
              }
            />{' '}
            ({formatLabel(tenancy.tenancyStatus)})
          </dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{tenancy.notes || '—'}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(tenancy.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(tenancy.updatedAt)}</dd>
        </div>
        {tenancy.endedAt ? (
          <div>
            <dt>Ended</dt>
            <dd>{formatDate(tenancy.endedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {token && canViewFinancials ? (
        <PaymentHistoryList
          token={token}
          monthlyTenancyId={tenancy.id}
          canAddPayment={canAddPayment}
          onAddPayment={onAddPayment}
          refreshKey={paymentRefreshKey}
        />
      ) : null}

      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        {canMarkOccupancy && isActive && tenancy.occupancyState === 'OCCUPIED' ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onMarkEmpty}
          >
            Mark Empty
          </button>
        ) : null}
        {canMarkOccupancy && isActive && tenancy.occupancyState === 'EMPTY' ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onMarkOccupied}
          >
            Mark Occupied
          </button>
        ) : null}
        {canEnd && isActive ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onEnd}
          >
            End Tenancy
          </button>
        ) : null}
        {canArchiveTenant && tenancy.tenant?.isActive !== false ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onArchiveTenant}
          >
            Archive Tenant
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </FormModal>
  );
}
