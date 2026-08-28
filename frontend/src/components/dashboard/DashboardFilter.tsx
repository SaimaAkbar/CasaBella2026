import type { DashboardFilterOptions, DashboardFiltersState } from '../../types/dashboard';
import './DashboardFilter.css';

type DashboardFilterProps = {
  value: DashboardFiltersState;
  options: DashboardFilterOptions;
  onChange: (next: DashboardFiltersState) => void;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'CLEANING_REQUIRED', label: 'Cleaning Required' },
  { value: 'MONTHLY_TENANT_VACANT', label: 'Monthly Empty' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'BLOCKED', label: 'Blocked' },
];

const currentYear = new Date().getFullYear();

export function DashboardFilter({
  value,
  options,
  onChange,
}: DashboardFilterProps) {
  const apartments = value.propertyId
    ? options.apartments.filter((item) => item.propertyId === value.propertyId)
    : options.apartments;

  function update<K extends keyof DashboardFiltersState>(
    key: K,
    nextValue: DashboardFiltersState[K],
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  return (
    <section className="dashboard-filter" aria-label="Dashboard filters">
      <label>
        <span>Property</span>
        <select
          value={value.propertyId}
          onChange={(event) =>
            onChange({
              ...value,
              propertyId: event.target.value,
              apartmentId: '',
            })
          }
        >
          <option value="">All Properties</option>
          {options.properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Apartment</span>
        <select
          value={value.apartmentId}
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
        <span>Status</span>
        <select
          value={value.displayStatus || value.status}
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

      <label>
        <span>Period</span>
        <select
          value={value.period}
          onChange={(event) =>
            update(
              'period',
              event.target.value as DashboardFiltersState['period'],
            )
          }
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
          <option value="custom">Custom Range</option>
        </select>
      </label>

      {value.period === 'month' ? (
        <label>
          <span>Month</span>
          <select
            value={value.month}
            onChange={(event) => update('month', event.target.value)}
          >
            {Array.from({ length: 12 }, (_, index) => {
              const month = String(index + 1);
              return (
                <option key={month} value={month}>
                  {new Date(2000, index, 1).toLocaleString(undefined, {
                    month: 'long',
                  })}
                </option>
              );
            })}
          </select>
        </label>
      ) : null}

      {value.period === 'month' || value.period === 'year' ? (
        <label>
          <span>Year</span>
          <select
            value={value.year}
            onChange={(event) => update('year', event.target.value)}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {value.period === 'custom' ? (
        <>
          <label>
            <span>From</span>
            <input
              type="date"
              value={value.dateFrom}
              onChange={(event) => update('dateFrom', event.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={value.dateTo}
              onChange={(event) => update('dateTo', event.target.value)}
            />
          </label>
        </>
      ) : null}

      <label className="dashboard-filter__search">
        <span>Search</span>
        <input
          type="search"
          value={value.search}
          placeholder="Room or property"
          onChange={(event) => update('search', event.target.value)}
        />
      </label>
    </section>
  );
}
