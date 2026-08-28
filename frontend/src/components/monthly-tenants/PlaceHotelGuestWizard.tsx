import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  approveHotelUse,
  createHotelUse,
  createHotelUseBooking,
  fetchEligibleHotelUseAssignments,
} from '../../api/tenant-unit-hotel-use';
import { fetchGuests } from '../../api/guests';
import { fetchProperties } from '../../api/properties';
import { formatPkr, formatHotelDateTime } from '../../lib/format';
import { invalidateEligibleUnitsQueries } from '../../lib/query-cache';
import {
  formatUnitOptionLabel,
  NO_ELIGIBLE_UNITS_MESSAGE,
} from '../../lib/unit-label';
import type { Guest } from '../../types/guest';
import type {
  EligibleHotelUseAssignment,
  SettlementType,
  TenantUnitHotelUse,
} from '../../types/hotel-use';
import type { Property } from '../../types/property';
import { FormModal } from '../ui/FormModal';
import { DateTimeFieldPair } from '../ui/DateTimeFieldPair';
import '../../styles/forms.css';
import './PlaceHotelGuestWizard.css';

type PlaceHotelGuestWizardProps = {
  open: boolean;
  token: string;
  tenantId?: string;
  preselectedTenancyId?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST' | undefined;
  onClose: () => void;
  onComplete: () => void;
  onError: (message: string) => void;
};

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toAmount(value: string): number {
  if (value.trim() === '') return 0;
  return Number(value);
}

function previewShares(input: {
  settlementType: SettlementType;
  totalGuestCharge: number;
  tenantShare: number;
  organizationShare: number;
  tenantPct: number;
  orgPct: number;
}): { tenantShare: number; organizationShare: number; rentCredit: number } {
  const total = input.totalGuestCharge;
  switch (input.settlementType) {
    case 'FIXED_AMOUNT':
      return {
        tenantShare: input.tenantShare,
        organizationShare: Math.max(0, total - input.tenantShare),
        rentCredit: 0,
      };
    case 'PERCENTAGE': {
      const tenantShare = Math.round((total * input.tenantPct) / 100 * 100) / 100;
      return {
        tenantShare,
        organizationShare: Math.round((total - tenantShare) * 100) / 100,
        rentCredit: 0,
      };
    }
    case 'NO_TENANT_SHARE':
      return { tenantShare: 0, organizationShare: total, rentCredit: 0 };
    case 'RENT_CREDIT':
      return {
        tenantShare: input.tenantShare,
        organizationShare: Math.max(0, total - input.tenantShare),
        rentCredit: input.tenantShare,
      };
    case 'CUSTOM':
      return {
        tenantShare: input.tenantShare,
        organizationShare: input.organizationShare,
        rentCredit: 0,
      };
    default:
      return { tenantShare: 0, organizationShare: total, rentCredit: 0 };
  }
}

export function PlaceHotelGuestWizard({
  open,
  token,
  tenantId,
  preselectedTenancyId,
  role,
  onClose,
  onComplete,
  onError,
}: PlaceHotelGuestWizardProps) {
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canCreateSettlement = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canApprove = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const [step, setStep] = useState<WizardStep>(1);
  const [busy, setBusy] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [assignments, setAssignments] = useState<EligibleHotelUseAssignment[]>(
    [],
  );
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    preselectedTenancyId ?? '',
  );
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [guestId, setGuestId] = useState('');
  const [newGuest, setNewGuest] = useState({
    fullName: '',
    phone: '',
    cnicOrPassport: '',
  });
  const [bookingType, setBookingType] = useState<'DAILY' | 'HOURLY'>('DAILY');
  const [checkInDateTime, setCheckInDateTime] = useState('');
  const [checkOutDateTime, setCheckOutDateTime] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [numberOfDays, setNumberOfDays] = useState('1');
  const [numberOfHours, setNumberOfHours] = useState('1');
  const [settlementType, setSettlementType] =
    useState<SettlementType>('FIXED_AMOUNT');
  const [tenantShare, setTenantShare] = useState('');
  const [organizationShare, setOrganizationShare] = useState('');
  const [tenantPct, setTenantPct] = useState('40');
  const [orgPct, setOrgPct] = useState('60');
  const [reason, setReason] = useState('');
  const [billingMonth, setBillingMonth] = useState(String(new Date().getMonth() + 1));
  const [billingYear, setBillingYear] = useState(String(new Date().getFullYear()));
  const [draft, setDraft] = useState<TenantUnitHotelUse | null>(null);
  const [approved, setApproved] = useState<TenantUnitHotelUse | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(12, 0, 0, 0);
    setStep(1);
    setDraft(null);
    setApproved(null);
    setPropertyId('');
    setSelectedAssignmentId(preselectedTenancyId ?? '');
    setCheckInDateTime(toLocalInputValue(start));
    setCheckOutDateTime(toLocalInputValue(end));
    setBusy(true);
    void Promise.all([
      fetchProperties(token),
      fetchGuests(token, { isActive: true }),
    ])
      .then(([propertyRows, guestRows]) => {
        setProperties(propertyRows);
        setGuests(guestRows);
      })
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : 'Unable to load wizard data');
      })
      .finally(() => setBusy(false));
  }, [open, token, tenantId, preselectedTenancyId, onError]);

  useEffect(() => {
    if (!open || !token || !preselectedTenancyId || propertyId) return;

    let cancelled = false;
    void fetchEligibleHotelUseAssignments(token, { tenantId }).then((rows) => {
      if (cancelled) return;
      const match = rows.find((row) => row.id === preselectedTenancyId);
      const resolvedPropertyId = match?.unit?.property?.id;
      if (resolvedPropertyId) {
        setPropertyId(resolvedPropertyId);
        setSelectedAssignmentId(preselectedTenancyId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, token, tenantId, preselectedTenancyId, propertyId]);

  useEffect(() => {
    if (!open || !token || !propertyId) {
      setAssignments([]);
      return;
    }

    let cancelled = false;
    setLoadingAssignments(true);
    void fetchEligibleHotelUseAssignments(token, {
      tenantId,
      propertyId,
    })
      .then((rows) => {
        if (cancelled) return;
        setAssignments(rows);
        if (preselectedTenancyId && rows.some((r) => r.id === preselectedTenancyId)) {
          setSelectedAssignmentId(preselectedTenancyId);
        } else if (rows.length === 1) {
          setSelectedAssignmentId(rows[0].id);
        } else {
          setSelectedAssignmentId('');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAssignments([]);
        onError(err instanceof Error ? err.message : 'Unable to load eligible units');
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, token, tenantId, propertyId, preselectedTenancyId, onError]);

  const selected = useMemo(
    () => assignments.find((row) => row.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );

  const roomCharges = useMemo(() => {
    if (bookingType === 'HOURLY') {
      return toAmount(hourlyRate) * toAmount(numberOfHours);
    }
    return toAmount(dailyRate) * toAmount(numberOfDays);
  }, [bookingType, hourlyRate, numberOfHours, dailyRate, numberOfDays]);

  const sharePreview = useMemo(
    () =>
      previewShares({
        settlementType,
        totalGuestCharge: roomCharges,
        tenantShare: toAmount(tenantShare),
        organizationShare: toAmount(organizationShare),
        tenantPct: toAmount(tenantPct),
        orgPct: toAmount(orgPct),
      }),
    [
      settlementType,
      roomCharges,
      tenantShare,
      organizationShare,
      tenantPct,
      orgPct,
    ],
  );

  const filteredGuests = useMemo(() => {
    const term = guestSearch.trim().toLowerCase();
    if (!term) return guests.slice(0, 40);
    return guests
      .filter(
        (g) =>
          g.fullName.toLowerCase().includes(term) ||
          g.phone.includes(term) ||
          (g.cnicOrPassport ?? '').toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [guests, guestSearch]);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  function validateStep(current: WizardStep): string | null {
    if (current === 1 && !selectedAssignmentId) {
      return 'Select an eligible empty tenant unit.';
    }
    if (current === 2) {
      if (guestMode === 'existing' && !guestId) {
        return 'Select an existing guest.';
      }
      if (guestMode === 'new') {
        if (!newGuest.fullName.trim() || !newGuest.phone.trim()) {
          return 'Guest full name and phone are required.';
        }
      }
    }
    if (current === 3) {
      if (!checkInDateTime || !checkOutDateTime) {
        return 'Check-in and check-out are required.';
      }
      if (new Date(checkOutDateTime) <= new Date(checkInDateTime)) {
        return 'Check-out must be after check-in.';
      }
      if (roomCharges <= 0) {
        return 'Enter a valid rate and duration.';
      }
    }
    if (current === 4 && !settlementType) {
      return 'Choose a settlement type.';
    }
    if (current === 5) {
      if (settlementType === 'FIXED_AMOUNT' && tenantShare.trim() === '') {
        return 'Enter tenant share for FIXED_AMOUNT.';
      }
      if (settlementType === 'PERCENTAGE') {
        if (toAmount(tenantPct) + toAmount(orgPct) !== 100) {
          return 'Percentages must total 100.';
        }
      }
      if (settlementType === 'CUSTOM') {
        if (!isSuperAdmin) return 'CUSTOM settlement requires Super Admin.';
        if (!reason.trim()) return 'Reason is required for CUSTOM.';
        if (
          Math.abs(
            toAmount(tenantShare) + toAmount(organizationShare) - roomCharges,
          ) > 0.001
        ) {
          return 'Shares must equal total guest charge.';
        }
      }
      if (settlementType === 'RENT_CREDIT' && tenantShare.trim() === '') {
        return 'Enter tenant share / rent credit amount.';
      }
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      onError(message);
      return;
    }
    setStep((current) => Math.min(7, current + 1) as WizardStep);
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1) as WizardStep);
  }

  async function handleCreateDraft() {
    if (!canCreateSettlement || !token || !selected) {
      onError('Only Admin / Super Admin can create settlements.');
      return;
    }
    const message = validateStep(5);
    if (message) {
      onError(message);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        monthlyTenancyId: selected.id,
        settlementType,
        totalGuestCharge: roomCharges,
        tenantShare:
          settlementType === 'NO_TENANT_SHARE'
            ? undefined
            : sharePreview.tenantShare,
        organizationShare:
          settlementType === 'CUSTOM'
            ? sharePreview.organizationShare
            : undefined,
        tenantSharePercentage:
          settlementType === 'PERCENTAGE' ? toAmount(tenantPct) : undefined,
        organizationSharePercentage:
          settlementType === 'PERCENTAGE' ? toAmount(orgPct) : undefined,
        reason: reason.trim() || undefined,
        billingMonth:
          settlementType === 'RENT_CREDIT' ? Number(billingMonth) : undefined,
        billingYear:
          settlementType === 'RENT_CREDIT' ? Number(billingYear) : undefined,
        plannedCheckInDateTime: new Date(checkInDateTime).toISOString(),
        plannedCheckOutDateTime: new Date(checkOutDateTime).toISOString(),
      };
      const created = await createHotelUse(token, payload);
      setDraft(created);
      setStep(6);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to create settlement');
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!canApprove || !token || !draft) return;
    setBusy(true);
    try {
      const row = await approveHotelUse(token, draft.id);
      setApproved(row);
      setDraft(row);
      setStep(7);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to approve settlement');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBooking(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    const hotelUseId = approved?.id ?? draft?.id;
    if (!hotelUseId) {
      onError('Approve the settlement before creating the booking.');
      return;
    }
    if ((approved ?? draft)?.status !== 'APPROVED') {
      onError('Settlement must be APPROVED before booking.');
      return;
    }

    setBusy(true);
    try {
      await createHotelUseBooking(token, hotelUseId, {
        guestId: guestMode === 'existing' ? guestId : undefined,
        guest:
          guestMode === 'new'
            ? {
                fullName: newGuest.fullName.trim(),
                phone: newGuest.phone.trim(),
                cnicOrPassport: newGuest.cnicOrPassport.trim() || undefined,
              }
            : undefined,
        bookingType,
        checkInDateTime: new Date(checkInDateTime).toISOString(),
        checkOutDateTime: new Date(checkOutDateTime).toISOString(),
        dailyRate: bookingType === 'DAILY' ? toAmount(dailyRate) : undefined,
        hourlyRate: bookingType === 'HOURLY' ? toAmount(hourlyRate) : undefined,
        numberOfDays: bookingType === 'DAILY' ? toAmount(numberOfDays) : undefined,
        numberOfHours:
          bookingType === 'HOURLY' ? toAmount(numberOfHours) : undefined,
        bookingSource: 'HOTEL_USE_ON_TENANT_UNIT',
      });
      onComplete();
      invalidateEligibleUnitsQueries();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to create booking');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <FormModal open={open} title="Place Hotel Guest" onClose={handleClose}>
      <div className="hotel-use-wizard">
        <ol className="hotel-use-wizard__steps" aria-label="Wizard steps">
          {[
            'Unit',
            'Guest',
            'Booking',
            'Settlement',
            'Shares',
            'Approve',
            'Book',
          ].map((label, index) => {
            const n = (index + 1) as WizardStep;
            return (
              <li
                key={label}
                className={
                  n === step
                    ? 'is-current'
                    : n < step
                      ? 'is-done'
                      : undefined
                }
              >
                <span>{n}</span>
                {label}
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <div className="form-grid">
            <p className="hotel-use-wizard__hint">
              Select a property, then an empty assigned unit with hotel use
              allowed.
            </p>
            <label className="form-field">
              <span>Property *</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setSelectedAssignmentId('');
                }}
              >
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>
            {!propertyId ? (
              <p className="hotel-use-wizard__hint">Select a property first.</p>
            ) : loadingAssignments ? (
              <p className="hotel-use-wizard__hint">Loading units…</p>
            ) : assignments.length === 0 ? (
              <p className="form-field__error">{NO_ELIGIBLE_UNITS_MESSAGE}</p>
            ) : (
              <label className="form-field">
                <span>Eligible unit *</span>
                <select
                  value={selectedAssignmentId}
                  disabled={!propertyId || loadingAssignments}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                >
                  <option value="">Select unit…</option>
                  {assignments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatUnitOptionLabel({
                        unitNumber: row.unit?.unitNumber ?? 'Unit',
                        unitType: row.unit?.unitType,
                        floor: row.unit?.floor,
                        property: row.unit?.property,
                      })}
                      {row.monthlyRent
                        ? ` · Rent ${formatPkr(row.monthlyRent)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form-grid">
            <div className="form-field form-field--checkbox">
              <label>
                <input
                  type="radio"
                  checked={guestMode === 'existing'}
                  onChange={() => setGuestMode('existing')}
                />
                Existing guest
              </label>
              <label>
                <input
                  type="radio"
                  checked={guestMode === 'new'}
                  onChange={() => setGuestMode('new')}
                />
                New guest
              </label>
            </div>
            {guestMode === 'existing' ? (
              <>
                <label className="form-field">
                  <span>Search guests</span>
                  <input
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder="Name, phone, CNIC"
                  />
                </label>
                <label className="form-field">
                  <span>Guest</span>
                  <select
                    value={guestId}
                    onChange={(e) => setGuestId(e.target.value)}
                  >
                    <option value="">Select guest…</option>
                    {filteredGuests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.fullName} · {g.phone}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="form-grid form-grid--2">
                <label className="form-field">
                  <span>Full name *</span>
                  <input
                    value={newGuest.fullName}
                    onChange={(e) =>
                      setNewGuest((c) => ({ ...c, fullName: e.target.value }))
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Phone *</span>
                  <input
                    value={newGuest.phone}
                    onChange={(e) =>
                      setNewGuest((c) => ({ ...c, phone: e.target.value }))
                    }
                  />
                </label>
                <label className="form-field">
                  <span>CNIC / Passport</span>
                  <input
                    value={newGuest.cnicOrPassport}
                    onChange={(e) =>
                      setNewGuest((c) => ({
                        ...c,
                        cnicOrPassport: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span>Booking type</span>
              <select
                value={bookingType}
                onChange={(e) =>
                  setBookingType(e.target.value as 'DAILY' | 'HOURLY')
                }
              >
                <option value="DAILY">Daily</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </label>
            <label className="form-field">
              <span>Preview room charges</span>
              <input value={formatPkr(String(roomCharges))} readOnly />
            </label>
            <DateTimeFieldPair
              dateLabel="Check-in date"
              timeLabel="Check-in time"
              required
              value={checkInDateTime}
              onChange={setCheckInDateTime}
            />
            <DateTimeFieldPair
              dateLabel="Check-out date"
              timeLabel="Check-out time"
              required
              value={checkOutDateTime}
              onChange={setCheckOutDateTime}
            />
            {bookingType === 'DAILY' ? (
              <>
                <label className="form-field">
                  <span>Daily rate</span>
                  <input
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="form-field">
                  <span>Number of days</span>
                  <input
                    value={numberOfDays}
                    onChange={(e) => setNumberOfDays(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="form-field">
                  <span>Hourly rate</span>
                  <input
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <label className="form-field">
                  <span>Number of hours</span>
                  <input
                    value={numberOfHours}
                    onChange={(e) => setNumberOfHours(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
              </>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="form-grid">
            {!canCreateSettlement ? (
              <p className="form-field__error">
                Receptionists cannot create settlements. Ask Admin / Super Admin
                to create and approve, then you can book on step 7.
              </p>
            ) : null}
            <label className="form-field">
              <span>Settlement type</span>
              <select
                value={settlementType}
                disabled={!canCreateSettlement}
                onChange={(e) =>
                  setSettlementType(e.target.value as SettlementType)
                }
              >
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="NO_TENANT_SHARE">No tenant share</option>
                <option value="RENT_CREDIT">Rent credit</option>
                {isSuperAdmin ? <option value="CUSTOM">Custom</option> : null}
              </select>
            </label>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="form-grid form-grid--2">
            <div className="hotel-use-wizard__summary">
              <strong>Total guest charge</strong>
              <span>{formatPkr(String(roomCharges))}</span>
            </div>
            {settlementType === 'PERCENTAGE' ? (
              <>
                <label className="form-field">
                  <span>Tenant %</span>
                  <input
                    value={tenantPct}
                    onChange={(e) => setTenantPct(e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Organization %</span>
                  <input
                    value={orgPct}
                    onChange={(e) => setOrgPct(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {settlementType === 'FIXED_AMOUNT' ||
            settlementType === 'RENT_CREDIT' ||
            settlementType === 'CUSTOM' ? (
              <label className="form-field">
                <span>
                  {settlementType === 'RENT_CREDIT'
                    ? 'Rent credit / tenant share'
                    : 'Tenant share'}
                </span>
                <input
                  value={tenantShare}
                  onChange={(e) => setTenantShare(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            ) : null}
            {settlementType === 'CUSTOM' ? (
              <label className="form-field">
                <span>Organization share</span>
                <input
                  value={organizationShare}
                  onChange={(e) => setOrganizationShare(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            ) : null}
            {settlementType === 'RENT_CREDIT' ? (
              <>
                <label className="form-field">
                  <span>Billing month</span>
                  <input
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
                <label className="form-field">
                  <span>Billing year</span>
                  <input
                    value={billingYear}
                    onChange={(e) => setBillingYear(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
              </>
            ) : null}
            {(settlementType === 'CUSTOM' || reason) && (
              <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                <span>Reason {settlementType === 'CUSTOM' ? '*' : ''}</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <div className="hotel-use-wizard__summary">
              <div>
                Tenant share: {formatPkr(String(sharePreview.tenantShare))}
              </div>
              <div>
                Organization share:{' '}
                {formatPkr(String(sharePreview.organizationShare))}
              </div>
              {sharePreview.rentCredit > 0 ? (
                <div>
                  Rent credit: {formatPkr(String(sharePreview.rentCredit))}
                </div>
              ) : null}
              <p className="hotel-use-wizard__hint">
                Backend recalculates shares — frontend preview only.
              </p>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="form-grid">
            <dl className="detail-list">
              <div>
                <dt>Unit</dt>
                <dd>
                  {selected?.unit?.property?.name} · {selected?.unit?.unitNumber}
                </dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>
                  {draft?.settlementType ?? settlementType} ·{' '}
                  {draft?.status ?? 'DRAFT'}
                </dd>
              </div>
              {draft?.totalGuestCharge ? (
                <div>
                  <dt>Total / shares</dt>
                  <dd>
                    {formatPkr(draft.totalGuestCharge)} · tenant{' '}
                    {formatPkr(draft.tenantShare ?? '0')} · org{' '}
                    {formatPkr(draft.organizationShare ?? '0')}
                  </dd>
                </div>
              ) : null}
            </dl>
            {!draft && canCreateSettlement ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void handleCreateDraft()}
              >
                Create draft settlement
              </button>
            ) : null}
            {draft && draft.status === 'DRAFT' && canApprove ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void handleApprove()}
              >
                Approve settlement
              </button>
            ) : null}
            {draft?.status === 'APPROVED' ? (
              <p className="hotel-use-wizard__hint">
                Approved. Continue to create the hotel guest booking.
              </p>
            ) : null}
            {draft &&
            draft.status === 'DRAFT' &&
            draft.createdByUserId &&
            role === 'ADMIN' ? (
              <p className="hotel-use-wizard__hint">
                Admin cannot approve their own draft — ask Super Admin or another
                Admin.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 7 ? (
          <form className="form-grid" onSubmit={(e) => void handleCreateBooking(e)}>
            <p className="hotel-use-wizard__hint">
              Creates a booking linked to the approved hotel-use settlement
              (occupancy source HOTEL_GUEST_ON_TENANT_UNIT). Monthly tenancy stays
              ACTIVE.
            </p>
            <dl className="detail-list">
              <div>
                <dt>Settlement</dt>
                <dd>
                  {(approved ?? draft)?.id?.slice(0, 8)}… ·{' '}
                  {(approved ?? draft)?.status}
                </dd>
              </div>
              <div>
                <dt>Guest</dt>
                <dd>
                  {guestMode === 'existing'
                    ? guests.find((g) => g.id === guestId)?.fullName ?? guestId
                    : newGuest.fullName}
                </dd>
              </div>
              <div>
                <dt>Stay</dt>
                <dd>
                  {formatHotelDateTime(checkInDateTime)} →{' '}
                  {formatHotelDateTime(checkOutDateTime)}
                </dd>
              </div>
            </dl>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || (approved ?? draft)?.status !== 'APPROVED'}
              >
                Create booking
              </button>
            </div>
          </form>
        ) : null}

        {step < 7 ? (
          <div className="form-actions">
            {step > 1 ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={goBack}
              >
                Back
              </button>
            ) : null}
            {step === 5 && canCreateSettlement ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void handleCreateDraft()}
              >
                Save draft & continue
              </button>
            ) : step === 6 ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy || (draft?.status !== 'APPROVED' && !approved)}
                onClick={() => {
                  if ((approved ?? draft)?.status === 'APPROVED') setStep(7);
                  else onError('Approve the settlement first.');
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={goNext}
              >
                Next
              </button>
            )}
          </div>
        ) : null}
      </div>
    </FormModal>
  );
}
