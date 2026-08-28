import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { fetchBookingEligibleUnits } from '../../api/bookings';
import { useEligibleUnitsQuery } from '../../hooks/useEligibleUnitsQuery';
import { formatPkr } from '../../lib/format';
import {
  dailyNightCount,
  elapsedHourCount,
} from '../../lib/stay-duration';
import {
  formatUnitOptionLabel,
  NO_ELIGIBLE_UNITS_MESSAGE,
} from '../../lib/unit-label';
import type {
  Booking,
  BookingFormValues,
  BookingInput,
} from '../../types/booking';
import type { Guest } from '../../types/guest';
import type { Property } from '../../types/property';
import { FormModal } from '../ui/FormModal';
import { DateTimeFieldPair } from '../ui/DateTimeFieldPair';
import '../../styles/forms.css';

const CHECKOUT_AFTER_CHECKIN_MESSAGE =
  'Check-out date must be after check-in date.';

type BookingUnitPreset = {
  propertyId: string;
  unitId: string;
  unitLabel?: string;
  lockSelection?: boolean;
};

type BookingFormModalProps = {
  open: boolean;
  saving: boolean;
  token: string;
  guests: Guest[];
  properties: Property[];
  isSuperAdmin: boolean;
  preset?: BookingUnitPreset | null;
  returnToDashboard?: boolean;
  editing?: Booking | null;
  defaultGuestId?: string | null;
  onClose: () => void;
  onSubmit: (payload: BookingInput) => Promise<void>;
  onError: (message: string) => void;
};

const emptyForm = (): BookingFormValues => ({
  guestMode: 'existing',
  guestId: '',
  fullName: '',
  phone: '',
  alternatePhone: '',
  email: '',
  cnicOrPassport: '',
  address: '',
  propertyId: '',
  unitId: '',
  bookingType: 'DAILY',
  checkInDateTime: '',
  checkOutDateTime: '',
  hourlyRate: '',
  dailyRate: '',
  numberOfHours: '1',
  numberOfDays: '1',
  numberOfGuests: '1',
  adults: '1',
  children: '0',
  bookingSource: '',
  electricityCharges: '0',
  cleaningCharges: '0',
  laundryCharges: '0',
  maintenanceCharges: '0',
  otherCharges: '0',
  otherChargesDescription: '',
  discountAmount: '0',
  receivedAmount: '0',
  allowAdvance: false,
  notes: '',
});

function toAmount(value: string): number {
  if (value.trim() === '') return 0;
  return Number(value);
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStayWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(12, 0, 0, 0);
  return {
    checkInDateTime: toLocalInputValue(start),
    checkOutDateTime: toLocalInputValue(end),
  };
}

export function BookingFormModal({
  open,
  saving,
  token,
  guests,
  properties,
  isSuperAdmin,
  preset = null,
  returnToDashboard = false,
  editing = null,
  defaultGuestId = null,
  onClose,
  onSubmit,
  onError,
}: BookingFormModalProps) {
  const [form, setForm] = useState<BookingFormValues>(() => ({
    ...emptyForm(),
    ...defaultStayWindow(),
  }));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof BookingFormValues, string>>
  >({});
  const lockSelection = Boolean(preset?.lockSelection);

  const { units, loading: loadingUnits } = useEligibleUnitsQuery({
    token,
    propertyId: form.propertyId,
    scope: 'booking',
    enabled: open && Boolean(form.propertyId),
    extras: {
      startDate: form.checkInDateTime || null,
      endDate: form.checkOutDateTime || null,
      bookingType: form.bookingType || null,
    },
    fetcher: () => fetchBookingEligibleUnits(token, form.propertyId),
    onError,
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...emptyForm(),
        guestMode: 'existing',
        guestId: editing.guestId,
        propertyId: editing.unit?.property?.id ?? preset?.propertyId ?? '',
        unitId: editing.unitId,
        bookingType: editing.bookingType,
        checkInDateTime: toLocalInputValue(new Date(editing.checkInDateTime)),
        checkOutDateTime: toLocalInputValue(new Date(editing.checkOutDateTime)),
        hourlyRate: editing.hourlyRate ?? '',
        dailyRate: editing.dailyRate ?? '',
        numberOfHours: String(editing.numberOfHours ?? 1),
        numberOfDays: String(editing.numberOfDays ?? 1),
        notes: editing.notes ?? '',
        otherCharges: editing.otherCharges ?? '0',
        otherChargesDescription: editing.otherChargesDescription ?? '',
        receivedAmount: editing.receivedAmount ?? '0',
      });
      setFieldErrors({});
      return;
    }
    setForm({
      ...emptyForm(),
      ...defaultStayWindow(),
      guestId: defaultGuestId ?? '',
      ...(preset
        ? { propertyId: preset.propertyId, unitId: preset.unitId }
        : {}),
    });
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.propertyId, preset?.unitId, editing?.id, defaultGuestId]);

  useEffect(() => {
    if (!form.unitId) return;
    if (loadingUnits) return;
    if (units.some((unit) => unit.id === form.unitId)) return;
    if (lockSelection && preset?.unitId === form.unitId) return;
    if (editing && editing.unitId === form.unitId) return;
    setForm((current) => ({ ...current, unitId: '' }));
  }, [form.unitId, units, loadingUnits, lockSelection, preset?.unitId, editing]);

  useEffect(() => {
    if (!form.unitId) return;
    const selected = units.find((unit) => unit.id === form.unitId);
    if (!selected) return;
    setForm((current) => ({
      ...current,
      dailyRate:
        current.dailyRate ||
        (selected.dailyRate ? String(selected.dailyRate) : current.dailyRate),
      hourlyRate:
        current.hourlyRate ||
        (selected.hourlyRate
          ? String(selected.hourlyRate)
          : current.hourlyRate),
    }));
  }, [form.unitId, units]);

  useEffect(() => {
    if (form.bookingType !== 'DAILY') return;
    const nights = dailyNightCount(form.checkInDateTime, form.checkOutDateTime);
    if (nights == null) return;
    const next = String(nights);
    if (form.numberOfDays === next) return;
    setForm((current) =>
      current.numberOfDays === next
        ? current
        : { ...current, numberOfDays: next },
    );
  }, [
    form.bookingType,
    form.checkInDateTime,
    form.checkOutDateTime,
    form.numberOfDays,
  ]);

  useEffect(() => {
    if (form.bookingType !== 'HOURLY') return;
    const hours = elapsedHourCount(form.checkInDateTime, form.checkOutDateTime);
    if (hours == null) return;
    const next = String(hours);
    if (form.numberOfHours === next) return;
    setForm((current) =>
      current.numberOfHours === next
        ? current
        : { ...current, numberOfHours: next },
    );
  }, [
    form.bookingType,
    form.checkInDateTime,
    form.checkOutDateTime,
    form.numberOfHours,
  ]);

  const nights = useMemo(
    () => dailyNightCount(form.checkInDateTime, form.checkOutDateTime),
    [form.checkInDateTime, form.checkOutDateTime],
  );
  const hours = useMemo(
    () => elapsedHourCount(form.checkInDateTime, form.checkOutDateTime),
    [form.checkInDateTime, form.checkOutDateTime],
  );

  const preview = useMemo(() => {
    const duration =
      form.bookingType === 'HOURLY' ? toAmount(form.numberOfHours) : toAmount(form.numberOfDays);
    const rate =
      form.bookingType === 'HOURLY'
        ? toAmount(form.hourlyRate)
        : toAmount(form.dailyRate);
    const roomCharges = rate * duration;
    const amenities = toAmount(form.otherCharges);
    const total = roomCharges + amenities;
    const received = editing
      ? toAmount(editing.receivedAmount)
      : toAmount(form.receivedAmount);
    return {
      roomCharges,
      amenities,
      total,
      received,
      remaining: total - received,
    };
  }, [form, editing]);

  function validate(values: BookingFormValues) {
    const next: Partial<Record<keyof BookingFormValues, string>> = {};

    if (!editing && values.guestMode === 'existing' && !values.guestId) {
      next.guestId = 'Select a guest.';
    }
    if (!editing && values.guestMode === 'new') {
      if (!values.fullName.trim()) next.fullName = 'Full name is required.';
      if (!values.phone.trim()) next.phone = 'Phone is required.';
    }
    if (!values.propertyId) next.propertyId = 'Property is required.';
    if (!values.unitId) next.unitId = 'Unit is required.';
    if (!values.bookingType) next.bookingType = 'Booking type is required.';
    if (!values.checkInDateTime) next.checkInDateTime = 'Check-in is required.';
    if (!values.checkOutDateTime) {
      next.checkOutDateTime = 'Check-out is required.';
    }
    if (
      values.checkInDateTime &&
      values.checkOutDateTime &&
      new Date(values.checkOutDateTime) <= new Date(values.checkInDateTime)
    ) {
      next.checkOutDateTime = CHECKOUT_AFTER_CHECKIN_MESSAGE;
    }

    if (values.bookingType === 'HOURLY') {
      if (elapsedHourCount(values.checkInDateTime, values.checkOutDateTime) == null) {
        next.numberOfHours = 'Hours must be greater than 0.';
      }
      if (values.hourlyRate.trim() === '' || toAmount(values.hourlyRate) < 0) {
        next.hourlyRate = 'Hourly rate is required.';
      }
    }

    if (values.bookingType === 'DAILY') {
      if (dailyNightCount(values.checkInDateTime, values.checkOutDateTime) == null) {
        next.numberOfDays = 'Nights must be at least 1.';
      }
      if (values.dailyRate.trim() === '' || toAmount(values.dailyRate) < 0) {
        next.dailyRate = 'Rate per night is required.';
      }
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !validate(form)) return;

    const payload: BookingInput = {
      propertyId: form.propertyId,
      unitId: form.unitId,
      bookingType: form.bookingType as 'HOURLY' | 'DAILY',
      checkInDateTime: new Date(form.checkInDateTime).toISOString(),
      checkOutDateTime: new Date(form.checkOutDateTime).toISOString(),
      otherCharges: toAmount(form.otherCharges),
      otherChargesDescription: form.otherChargesDescription.trim() || undefined,
    };

    if (form.bookingType === 'HOURLY') {
      payload.hourlyRate = toAmount(form.hourlyRate);
      payload.numberOfHours = toAmount(form.numberOfHours);
    } else {
      payload.dailyRate = toAmount(form.dailyRate);
      payload.numberOfDays = toAmount(form.numberOfDays);
    }

    if (form.notes.trim()) payload.notes = form.notes.trim();
    if (isSuperAdmin && form.allowAdvance) payload.allowAdvance = true;

    if (!editing) {
      payload.receivedAmount = toAmount(form.receivedAmount);
      payload.electricityCharges = 0;
      payload.cleaningCharges = 0;
      payload.laundryCharges = 0;
      payload.maintenanceCharges = 0;
      payload.discountAmount = 0;
    }

    if (form.guestMode === 'existing') {
      if (!editing) payload.guestId = form.guestId;
    } else if (!editing) {
      payload.guest = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
      };
      if (form.cnicOrPassport.trim()) {
        payload.guest.cnicOrPassport = form.cnicOrPassport.trim();
      }
      if (form.address.trim()) payload.guest.address = form.address.trim();
    }

    try {
      await onSubmit(payload);
      setForm(emptyForm());
      setFieldErrors({});
    } catch {
      // keep open
    }
  }

  function handleClose() {
    if (saving) return;
    setForm(emptyForm());
    setFieldErrors({});
    onClose();
  }

  const activeGuests = guests.filter((guest) => guest.isActive);
  const selectedUnitLabel =
    preset?.unitLabel ||
    units.find((unit) => unit.id === form.unitId)?.unitNumber ||
    form.unitId;
  const selectedPropertyLabel =
    properties.find((p) => p.id === form.propertyId)?.name ?? form.propertyId;

  return (
    <FormModal
      open={open}
      title={editing ? 'Edit Booking' : 'New Booking'}
      onClose={handleClose}
      panelClassName="modal-panel--booking"
    >
      <form className="form-grid form-grid--2" onSubmit={handleSubmit} noValidate>
        {preset && form.unitId ? (
          <p className="form-hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
            Selected unit: {selectedPropertyLabel} · {selectedUnitLabel}
          </p>
        ) : null}

        {editing ? (
          <p className="form-hint" style={{ gridColumn: '1 / -1' }}>
            Guest: {editing.guest?.fullName ?? '—'} · Room{' '}
            {editing.unit?.unitNumber ?? '—'}
          </p>
        ) : (
          <>
            <label className="form-field">
              <span>Guest Mode</span>
              <select
                value={form.guestMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    guestMode: e.target.value as 'existing' | 'new',
                  })
                }
              >
                <option value="existing">Existing Guest</option>
                <option value="new">Add New Guest</option>
              </select>
            </label>

            {form.guestMode === 'existing' ? (
              <label className="form-field">
                <span>Guest *</span>
                <select
                  value={form.guestId}
                  onChange={(e) => setForm({ ...form, guestId: e.target.value })}
                >
                  <option value="">Select guest</option>
                  {activeGuests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.fullName} ({guest.phone})
                    </option>
                  ))}
                </select>
                {fieldErrors.guestId ? (
                  <em className="form-field__error">{fieldErrors.guestId}</em>
                ) : null}
              </label>
            ) : (
              <>
                <label className="form-field">
                  <span>Guest Name *</span>
                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                  />
                  {fieldErrors.fullName ? (
                    <em className="form-field__error">{fieldErrors.fullName}</em>
                  ) : null}
                </label>
                <label className="form-field">
                  <span>Phone *</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  {fieldErrors.phone ? (
                    <em className="form-field__error">{fieldErrors.phone}</em>
                  ) : null}
                </label>
                <label className="form-field">
                  <span>CNIC / Passport</span>
                  <input
                    value={form.cnicOrPassport}
                    onChange={(e) =>
                      setForm({ ...form, cnicOrPassport: e.target.value })
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Address</span>
                  <input
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </>
        )}

        <label className="form-field">
          <span>Property *</span>
          <select
            value={form.propertyId}
            disabled={lockSelection}
            onChange={(e) =>
              setForm({ ...form, propertyId: e.target.value, unitId: '' })
            }
          >
            <option value="">Select property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          {fieldErrors.propertyId ? (
            <em className="form-field__error">{fieldErrors.propertyId}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>Room / Apartment *</span>
          <select
            value={form.unitId}
            disabled={!form.propertyId || loadingUnits || lockSelection}
            onChange={(e) => setForm({ ...form, unitId: e.target.value })}
          >
            <option value="">
              {!form.propertyId
                ? 'Select a property first'
                : loadingUnits
                  ? 'Loading units…'
                  : units.length === 0
                    ? NO_ELIGIBLE_UNITS_MESSAGE
                    : 'Select unit'}
            </option>
            {form.unitId &&
            !units.some((unit) => unit.id === form.unitId) &&
            lockSelection ? (
              <option value={form.unitId}>
                {selectedUnitLabel} (selected)
              </option>
            ) : null}
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {formatUnitOptionLabel(unit)}
              </option>
            ))}
          </select>
          {form.propertyId && !loadingUnits && units.length === 0 && !lockSelection ? (
            <em className="form-field__error">{NO_ELIGIBLE_UNITS_MESSAGE}</em>
          ) : null}
          {fieldErrors.unitId ? (
            <em className="form-field__error">{fieldErrors.unitId}</em>
          ) : null}
        </label>

        <label className="form-field">
          <span>Booking Type *</span>
          <select
            value={form.bookingType}
            onChange={(e) =>
              setForm({
                ...form,
                bookingType: e.target.value as BookingFormValues['bookingType'],
              })
            }
          >
            <option value="DAILY">Daily</option>
            <option value="HOURLY">Hourly</option>
          </select>
        </label>

        {form.bookingType === 'HOURLY' ? (
          <label className="form-field">
            <span>Hourly Rate *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.hourlyRate}
              onChange={(e) =>
                setForm({ ...form, hourlyRate: e.target.value })
              }
            />
            {fieldErrors.hourlyRate ? (
              <em className="form-field__error">{fieldErrors.hourlyRate}</em>
            ) : null}
          </label>
        ) : (
          <label className="form-field">
            <span>Rate Per Night *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.dailyRate}
              onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
            />
            {fieldErrors.dailyRate ? (
              <em className="form-field__error">{fieldErrors.dailyRate}</em>
            ) : null}
          </label>
        )}

        <DateTimeFieldPair
          dateLabel="Check-In Date *"
          timeLabel="Check-In Time *"
          required
          value={form.checkInDateTime}
          error={fieldErrors.checkInDateTime}
          onChange={(checkInDateTime) => setForm({ ...form, checkInDateTime })}
        />

        <DateTimeFieldPair
          dateLabel="Check-Out Date *"
          timeLabel="Check-Out Time *"
          required
          value={form.checkOutDateTime}
          error={fieldErrors.checkOutDateTime}
          onChange={(checkOutDateTime) =>
            setForm({ ...form, checkOutDateTime })
          }
        />

        {form.bookingType === 'HOURLY' ? (
          <label className="form-field">
            <span>Number of Hours</span>
            <input
              type="number"
              readOnly
              value={hours ?? ''}
              title="Calculated from check-in and check-out time"
            />
            {fieldErrors.numberOfHours ? (
              <em className="form-field__error">{fieldErrors.numberOfHours}</em>
            ) : null}
          </label>
        ) : (
          <label className="form-field">
            <span>Number of Nights</span>
            <input
              type="number"
              readOnly
              value={nights ?? ''}
              title="Calculated from check-in and check-out dates"
            />
            {fieldErrors.numberOfDays ? (
              <em className="form-field__error">{fieldErrors.numberOfDays}</em>
            ) : (
              <strong className="form-hint">
                {nights == null
                  ? ''
                  : nights === 1
                    ? 'Stay: 1 Night'
                    : `Stay: ${nights} Nights`}
              </strong>
            )}
          </label>
        )}

        <label className="form-field">
          <span>Room Charges</span>
          <input readOnly value={formatPkr(preview.roomCharges)} />
        </label>

        <label className="form-field">
          <span>Other Amenities / Additional Charges</span>
          <input
            value={form.otherChargesDescription}
            placeholder="Extra Mattress, Breakfast, Airport Pickup…"
            onChange={(e) =>
              setForm({ ...form, otherChargesDescription: e.target.value })
            }
          />
        </label>

        <label className="form-field">
          <span>Additional Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.otherCharges}
            onChange={(e) => setForm({ ...form, otherCharges: e.target.value })}
          />
        </label>

        {editing ? (
          <label className="form-field">
            <span>Paid</span>
            <input readOnly value={formatPkr(preview.received)} />
          </label>
        ) : (
          <label className="form-field">
            <span>Initial Payment</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.receivedAmount}
              onChange={(e) =>
                setForm({ ...form, receivedAmount: e.target.value })
              }
            />
          </label>
        )}

        <label className="form-field">
          <span>Remaining</span>
          <input readOnly value={formatPkr(preview.remaining)} />
        </label>

        {isSuperAdmin && !editing ? (
          <label className="form-field form-field--checkbox">
            <input
              type="checkbox"
              checked={form.allowAdvance}
              onChange={(e) =>
                setForm({ ...form, allowAdvance: e.target.checked })
              }
            />
            <span>Allow advance (received &gt; total)</span>
          </label>
        ) : null}

        <label className="form-field" style={{ gridColumn: '1 / -1' }}>
          <span>Notes</span>
          <textarea
            value={form.notes}
            rows={2}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="booking-bill" style={{ gridColumn: '1 / -1' }}>
          <div>
            <dt>Room Charges</dt>
            <dd>{formatPkr(preview.roomCharges)}</dd>
          </div>
          <div>
            <dt>Other Amenities</dt>
            <dd>
              {form.otherChargesDescription.trim() || '—'}{' '}
              {preview.amenities > 0 ? formatPkr(preview.amenities) : ''}
            </dd>
          </div>
          <div>
            <dt>Total Bill</dt>
            <dd>{formatPkr(preview.total)}</dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>{formatPkr(preview.received)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{formatPkr(preview.remaining)}</dd>
          </div>
        </div>

        <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving
              ? 'Saving…'
              : editing
                ? 'Save Changes'
                : returnToDashboard
                  ? 'Save and Return to Dashboard'
                  : 'Create Booking'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
