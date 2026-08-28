import type {
  DashboardDisplayStatus,
  DashboardFilterOptions,
  DashboardFiltersState,
} from '../../types/dashboard';
import './UnitGridFilters.css';

type UnitGridFiltersProps = {
  value: DashboardFiltersState;
  options: DashboardFilterOptions | null;
  onChange: (next: DashboardFiltersState) => void;
  onRefresh: () => void;
  onResetAll?: () => void;
  isLoading?: boolean;
};

const STATUS_OPTIONS: Array<{ value: DashboardDisplayStatus; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'CLEANING_REQUIRED', label: 'Cleaning Required' },
  { value: 'MONTHLY_TENANT_VACANT', label: 'Monthly Empty' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'BLOCKED', label: 'Blocked' },
];

export function UnitGridFilters({
  value,
  options,
  onChange,
  onRefresh,
  onResetAll,
  isLoading = false,
}: UnitGridFiltersProps) {
  const apartments = value.propertyId
    ? (options?.apartments ?? []).filter(
        (item) => item.propertyId === value.propertyId,
      )
    : (options?.apartments ?? []);
  const displayStatus = value.displayStatus || value.status;

  function keepWindowScroll() {
    const x = window.scrollX;
    const y = window.scrollY;
    window.requestAnimationFrame(() => window.scrollTo(x, y));
  }

  function update<K extends keyof DashboardFiltersState>(
    key: K,
    nextValue: DashboardFiltersState[K],
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <section className="unit-grid-filters" aria-label="Room grid filters">
      <label>
        <span className="visually-hidden">Property</span>
        <select
          value={value.propertyId}
          aria-label="Property"
          onMouseDown={keepWindowScroll}
          onFocus={keepWindowScroll}
          onChange={(event) =>
            onChange({
              ...value,
              propertyId: event.target.value,
              apartmentId: '',
              unitId: '',
            })
          }
        >
          <option value="">All Properties</option>
          {(options?.properties ?? []).map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="visually-hidden">Apartment</span>
        <select
          value={value.apartmentId}
          aria-label="Apartment"
          onMouseDown={keepWindowScroll}
          onFocus={keepWindowScroll}
          onChange={(event) => update('apartmentId', event.target.value)}
        >
          <option value="">All Apartments</option>
          {apartments.map((apartment) => (
            <option key={apartment.id} value={apartment.id}>
              {apartment.propertyName} — {apartment.unitNumber}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="visually-hidden">Status</span>
        <select
          value={displayStatus}
          aria-label="Status"
          onMouseDown={keepWindowScroll}
          onFocus={keepWindowScroll}
          onChange={(event) => {
            const next = event.target
              .value as DashboardFiltersState['displayStatus'];
            onChange({
              ...value,
              displayStatus: next,
              status: next,
            });
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="unit-grid-filters__search">
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          value={value.search}
          placeholder="Search unit, guest, tenant…"
          aria-label="Search"
          onChange={(event) => update('search', event.target.value)}
        />
      </label>

      <button
        type="button"
        className="unit-grid-filters__refresh"
        onClick={onRefresh}
        disabled={isLoading}
      >
        Refresh
      </button>
      {onResetAll ? (
        <button
          type="button"
          className="unit-grid-filters__reset"
          onClick={onResetAll}
          disabled={isLoading}
        >
          Reset All Filters
        </button>
      ) : null}
    </section>
  );
}
