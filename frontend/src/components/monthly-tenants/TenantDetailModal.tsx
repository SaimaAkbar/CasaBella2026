import { formatDate, formatLabel, formatPkr } from '../../lib/format';
import type { MonthlyTenant } from '../../types/monthly-tenant';
import { FormModal } from '../ui/FormModal';
import { OccupancyBadge } from '../ui/OccupancyBadge';
import { StatusBadge } from '../ui/StatusBadge';
import '../../styles/forms.css';

type TenantDetailModalProps = {
  open: boolean;
  tenant: MonthlyTenant | null;
  canViewRestricted: boolean;
  canViewFinancials?: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canArchive: boolean;
  canManageUnits?: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAssign: () => void;
  onManageUnits?: () => void;
  onArchive: () => void;
};

export function TenantDetailModal({
  open,
  tenant,
  canViewRestricted,
  canViewFinancials = false,
  canEdit,
  canAssign,
  canArchive,
  canManageUnits = false,
  busy,
  onClose,
  onEdit,
  onAssign,
  onManageUnits,
  onArchive,
}: TenantDetailModalProps) {
  if (!tenant) return null;

  const history = tenant.tenancies ?? [];
  const active = history.find((row) => row.tenancyStatus === 'ACTIVE');

  return (
    <FormModal open={open} title="Tenant Profile" onClose={onClose}>
      <dl className="detail-list">
        <div>
          <dt>Full Name</dt>
          <dd>{tenant.fullName}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{tenant.phone}</dd>
        </div>
        {canViewRestricted && tenant.alternatePhone ? (
          <div>
            <dt>Alternate Phone</dt>
            <dd>{tenant.alternatePhone}</dd>
          </div>
        ) : null}
        {canViewRestricted && tenant.email ? (
          <div>
            <dt>Email</dt>
            <dd>{tenant.email}</dd>
          </div>
        ) : null}
        {canViewRestricted ? (
          <div>
            <dt>CNIC</dt>
            <dd>{tenant.cnic || '—'}</dd>
          </div>
        ) : null}
        {canViewRestricted && tenant.address ? (
          <div>
            <dt>Address</dt>
            <dd>{tenant.address}</dd>
          </div>
        ) : null}
        {canViewRestricted && tenant.emergencyContactName ? (
          <div>
            <dt>Emergency Contact</dt>
            <dd>
              {tenant.emergencyContactName}
              {tenant.emergencyContactPhone
                ? ` · ${tenant.emergencyContactPhone}`
                : ''}
            </dd>
          </div>
        ) : null}
        {canViewRestricted && tenant.notes ? (
          <div>
            <dt>Notes</dt>
            <dd>{tenant.notes}</dd>
          </div>
        ) : null}
        <div>
          <dt>Profile Status</dt>
          <dd>
            <StatusBadge status={tenant.isActive ? 'ACTIVE' : 'INACTIVE'} />
          </dd>
        </div>
        {tenant.activeAgreement ? (
          <div>
            <dt>Current Agreement</dt>
            <dd>
              {tenant.activeAgreement.agreementNumber} ·{' '}
              {formatDate(tenant.activeAgreement.agreementStart)}
              {tenant.activeAgreement.agreementEnd
                ? ` → ${formatDate(tenant.activeAgreement.agreementEnd)}`
                : ''}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Total Tenancies</dt>
          <dd>{tenant.tenancyCount ?? history.length}</dd>
        </div>
        {canViewFinancials ? (
          <div>
            <dt>Total Current Monthly Rent</dt>
            <dd>{formatPkr(tenant.currentMonthlyRentTotal ?? '0')}</dd>
          </div>
        ) : null}
        <div>
          <dt>Created</dt>
          <dd>{formatDate(tenant.createdAt)}</dd>
        </div>
      </dl>

      {active ? (
        <div className="monthly-tenants-page__history">
          <h3>Active Tenancy</h3>
          <ul className="monthly-tenants-page__history-list">
            <li>
              {active.unit?.property?.name ?? 'Property'} —{' '}
              {active.unit?.unitNumber ?? 'Unit'} ·{' '}
              <OccupancyBadge state={active.occupancyState} /> ·{' '}
              {formatDate(active.agreementStart)}
              {active.agreementEnd
                ? ` → ${formatDate(active.agreementEnd)}`
                : ''}
              {canViewFinancials && active.monthlyRent
                ? ` · ${formatPkr(active.monthlyRent)}/mo`
                : ''}
            </li>
          </ul>
        </div>
      ) : null}

      <div className="monthly-tenants-page__history">
        <h3>Tenancy History</h3>
        {history.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No tenancy assignments yet. Use Assign to Unit to create history.
          </p>
        ) : (
          <ul className="monthly-tenants-page__history-list">
            {history.map((row) => (
              <li key={row.id}>
                {row.unit?.property?.name ?? 'Property'} —{' '}
                {row.unit?.unitNumber ?? 'Unit'} · {formatLabel(row.tenancyStatus)}{' '}
                · <OccupancyBadge state={row.occupancyState} /> ·{' '}
                {formatDate(row.agreementStart)}
                {row.endedAt ? ` · ended ${formatDate(row.endedAt)}` : ''}
                {canViewFinancials && row.monthlyRent
                  ? ` · ${formatPkr(row.monthlyRent)}/mo`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        {canEdit ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onEdit}
          >
            Edit Profile
          </button>
        ) : null}
        {canManageUnits && onManageUnits ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onManageUnits}
          >
            Manage Assigned Units
          </button>
        ) : null}
        {canAssign && tenant.isActive ? (
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={onAssign}
          >
            Assign to Unit
          </button>
        ) : null}
        {canArchive && tenant.isActive ? (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={onArchive}
          >
            Delete / Archive
          </button>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </FormModal>
  );
}
