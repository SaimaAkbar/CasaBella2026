import { useMemo } from 'react';
import type {
  DashboardRoomGridItem,
  UnitGridViewMode,
  UnitStatus,
} from '../../types/dashboard';
import { formatHotelTime } from '../../lib/format';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import {
  UnitStatusCard,
  isEarlyHotelCheckout,
  unitAllowsHotelCheckout,
} from './UnitStatusCard';
import './UnitStatusGrid.css';

type UnitStatusGridProps = {
  units: DashboardRoomGridItem[];
  viewMode: UnitGridViewMode;
  groupByProperty: boolean;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onUnitClick: (unitId: string) => void;
  onCheckOut?: (unit: DashboardRoomGridItem) => void;
  onViewModeChange: (mode: UnitGridViewMode) => void;
  onGroupByChange: (grouped: boolean) => void;
};

type PropertyGroup = {
  propertyId: string;
  propertyName: string;
  units: DashboardRoomGridItem[];
  counts: Record<string, number>;
};

function countStatus(units: DashboardRoomGridItem[], status: UnitStatus): number {
  return units.filter((u) => u.status === status).length;
}

function buildGroups(
  units: DashboardRoomGridItem[],
  groupByProperty: boolean,
): PropertyGroup[] {
  if (!groupByProperty) {
    return [
      {
        propertyId: 'all',
        propertyName: 'All Properties',
        units,
        counts: {
          total: units.length,
          occupied: countStatus(units, 'OCCUPIED'),
          available: countStatus(units, 'AVAILABLE'),
          cleaning: countStatus(units, 'CLEANING_REQUIRED'),
          monthlyEmpty: countStatus(units, 'MONTHLY_TENANT_VACANT'),
          maintenance: countStatus(units, 'MAINTENANCE'),
          blocked: countStatus(units, 'BLOCKED'),
        },
      },
    ];
  }

  const map = new Map<string, PropertyGroup>();
  for (const unit of units) {
    const existing = map.get(unit.propertyId);
    if (existing) {
      existing.units.push(unit);
    } else {
      map.set(unit.propertyId, {
        propertyId: unit.propertyId,
        propertyName: unit.propertyName,
        units: [unit],
        counts: {
          total: 0,
          occupied: 0,
          available: 0,
          cleaning: 0,
          monthlyEmpty: 0,
          maintenance: 0,
          blocked: 0,
        },
      });
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      counts: {
        total: group.units.length,
        occupied: countStatus(group.units, 'OCCUPIED'),
        available: countStatus(group.units, 'AVAILABLE'),
        cleaning: countStatus(group.units, 'CLEANING_REQUIRED'),
        monthlyEmpty: countStatus(group.units, 'MONTHLY_TENANT_VACANT'),
        maintenance: countStatus(group.units, 'MAINTENANCE'),
        blocked: countStatus(group.units, 'BLOCKED'),
      },
    }))
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName));
}

export function UnitStatusGrid({
  units,
  viewMode,
  groupByProperty,
  isLoading,
  error,
  onRetry,
  onUnitClick,
  onCheckOut,
  onViewModeChange,
  onGroupByChange,
}: UnitStatusGridProps) {
  const groups = useMemo(
    () => buildGroups(units, groupByProperty),
    [units, groupByProperty],
  );

  return (
    <section className="unit-status-grid dash-card">
      <header className="unit-status-grid__header">
        <h2>ALL ROOMS &amp; APARTMENTS STATUS</h2>
        <div className="unit-status-grid__controls">
          <div className="unit-status-grid__toggles" role="group" aria-label="View mode">
            <button
              type="button"
              className={
                viewMode === 'grid' || viewMode === 'compact'
                  ? 'is-active'
                  : undefined
              }
              onClick={() => onViewModeChange('grid')}
            >
              Grid View
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-active' : undefined}
              onClick={() => onViewModeChange('list')}
            >
              List View
            </button>
            <button
              type="button"
              className={viewMode === 'compact' ? 'is-active' : undefined}
              onClick={() => onViewModeChange('compact')}
            >
              Compact
            </button>
          </div>
          <label className="unit-status-grid__group">
            <span className="visually-hidden">Group by</span>
            <select
              value={groupByProperty ? 'property' : 'none'}
              onMouseDown={() => {
                const x = window.scrollX;
                const y = window.scrollY;
                window.requestAnimationFrame(() => window.scrollTo(x, y));
              }}
              onChange={(e) => onGroupByChange(e.target.value === 'property')}
            >
              <option value="property">Group by Property</option>
              <option value="none">Ungrouped</option>
            </select>
          </label>
        </div>
      </header>

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

      {!error && isLoading && units.length === 0 ? (
        <div className="unit-status-grid__skeletons" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="unit-status-grid__skeleton" />
          ))}
        </div>
      ) : null}

      {!error && !isLoading && units.length === 0 ? (
        <EmptyState
          title="No units match these filters"
          description="Try clearing filters or refreshing. Only active rooms and apartments from the database are shown."
        />
      ) : null}

      {!error && units.length > 0
        ? groups.map((group) => (
            <div key={group.propertyId} className="unit-status-grid__group-block">
              {groupByProperty ? (
                <div className="unit-status-grid__property-bar">
                  <strong>{group.propertyName}</strong>
                  <div className="unit-status-grid__property-counts">
                    <span>Total {group.counts.total}</span>
                    <span>Occupied {group.counts.occupied}</span>
                    <span>Available {group.counts.available}</span>
                    <span>Cleaning {group.counts.cleaning}</span>
                    <span>Monthly Empty {group.counts.monthlyEmpty}</span>
                    <span>Maintenance {group.counts.maintenance}</span>
                    <span>Blocked {group.counts.blocked}</span>
                  </div>
                </div>
              ) : null}

              <div
                className={`unit-status-grid__cards unit-status-grid__cards--${viewMode}`}
              >
                {group.units.map((unit) =>
                  viewMode === 'list' ? (
                    <div
                      key={unit.id}
                      className={`unit-status-row unit-status-row--${unit.statusTone}`}
                    >
                      <button
                        type="button"
                        className="unit-status-row__open"
                        onClick={() => onUnitClick(unit.id)}
                      >
                        <strong>{unit.unitNumber ?? unit.roomNumber}</strong>
                        <span>{unit.unitType}</span>
                        <span>{unit.statusLabel ?? unit.status}</span>
                        <span>{unit.guestName ?? unit.monthlyTenant ?? '—'}</span>
                        <span>
                          {unit.bookingType === 'DAILY' ||
                          unit.bookingType === 'HOURLY'
                            ? `In ${formatHotelTime(unit.checkInDate)} · Out ${formatHotelTime(unit.checkoutDate)}`
                            : unit.propertyName}
                        </span>
                      </button>
                      {onCheckOut && unitAllowsHotelCheckout(unit) ? (
                        <button
                          type="button"
                          className="unit-status-row__checkout"
                          onClick={() => onCheckOut(unit)}
                        >
                          {isEarlyHotelCheckout(unit)
                            ? 'Early Check Out'
                            : 'Check Out'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <UnitStatusCard
                      key={unit.id}
                      unit={unit}
                      compact={viewMode === 'compact'}
                      onClick={onUnitClick}
                      onCheckOut={onCheckOut}
                    />
                  ),
                )}
              </div>
            </div>
          ))
        : null}
    </section>
  );
}
