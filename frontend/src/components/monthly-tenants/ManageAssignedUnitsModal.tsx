import { useEffect, useState } from 'react';
import { fetchMonthlyTenancies } from '../../api/monthly-tenancies';
import type { MonthlyTenant } from '../../types/monthly-tenant';
import type { MonthlyTenancy } from '../../types/monthly-tenancy';
import { FormModal } from '../ui/FormModal';
import '../../styles/forms.css';

type Props = {
  open: boolean;
  token: string;
  tenant: MonthlyTenant;
  role?: string;
  canViewFinancials?: boolean;
  onClose: () => void;
  onAssignMore: () => void;
  onPlaceHotelGuest: (tenancyId: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export function ManageAssignedUnitsModal({
  open,
  token,
  tenant,
  onClose,
  onAssignMore,
  onPlaceHotelGuest,
}: Props) {
  const [rows, setRows] = useState<MonthlyTenancy[]>([]);

  useEffect(() => {
    if (!open || !token) return;
    void fetchMonthlyTenancies(token, {
      tenantId: tenant.id,
      tenancyStatus: 'ACTIVE',
    }).then(setRows);
  }, [open, token, tenant.id]);

  return (
    <FormModal
      open={open}
      title={`Assigned units — ${tenant.fullName}`}
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <p className="form-hint">No active unit assignments.</p>
      ) : (
        <ul className="monthly-tenants-page__history-list">
          {rows.map((row) => (
            <li key={row.id}>
              {row.unit?.property?.name} {row.unit?.unitNumber} ·{' '}
              {row.occupancyState}
              {row.hotelUseAllowed ? (
                <button
                  type="button"
                  className="data-table__action"
                  onClick={() => onPlaceHotelGuest(row.id)}
                >
                  Place hotel guest
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn--primary" onClick={onAssignMore}>
          Assign another unit
        </button>
      </div>
    </FormModal>
  );
}
