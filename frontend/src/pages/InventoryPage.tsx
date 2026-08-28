import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBookings } from '../api/bookings';
import { fetchEmployees } from '../api/employees';
import {
  archiveInventoryCategory,
  fetchInventoryCategories,
} from '../api/inventory-categories';
import {
  archiveInventoryItem,
  fetchInventoryItems,
  fetchInventorySummary,
} from '../api/inventory-items';
import { fetchInventoryMovements } from '../api/inventory-movements';
import { fetchMonthlyTenancies } from '../api/monthly-tenancies';
import { fetchProperties } from '../api/properties';
import {
  archiveRoomAsset,
  fetchRoomAssets,
} from '../api/room-assets';
import { fetchUnits } from '../api/units';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { AssetConditionBadge } from '../components/inventory/AssetConditionBadge';
import { CategoryFormModal } from '../components/inventory/CategoryFormModal';
import { ChangeConditionFormModal } from '../components/inventory/ChangeConditionFormModal';
import { InventoryItemFormModal } from '../components/inventory/InventoryItemFormModal';
import { IssueItemFormModal } from '../components/inventory/IssueItemFormModal';
import {
  MovementActionFormModal,
  type MovementActionMode,
} from '../components/inventory/MovementActionFormModal';
import { PurchaseStockFormModal } from '../components/inventory/PurchaseStockFormModal';
import { RoomAssetFormModal } from '../components/inventory/RoomAssetFormModal';
import { RoomAssetHistoryModal } from '../components/inventory/RoomAssetHistoryModal';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar } from '../components/ui/FilterBar';
import { FormModal } from '../components/ui/FormModal';
import { LoadingState } from '../components/ui/LoadingState';
import { MoneyDisplay } from '../components/ui/MoneyDisplay';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import { formatDate, formatLabel, formatPkr } from '../lib/format';
import type { Booking } from '../types/booking';
import type { Employee } from '../types/employee';
import type {
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventorySummary,
  RoomAsset,
  RoomAssetCondition,
} from '../types/inventory';
import type { MonthlyTenancy } from '../types/monthly-tenancy';
import type { Property } from '../types/property';
import type { Unit } from '../types/unit';
import '../styles/forms.css';
import './InventoryPage.css';

const now = new Date();

type Tab = 'items' | 'movements' | 'assets' | 'categories';

const MOVEMENT_TYPES: InventoryMovementType[] = [
  'PURCHASE',
  'ISSUE',
  'RETURN',
  'TRANSFER',
  'ADJUSTMENT',
  'DAMAGE',
  'LOSS',
];

const CONDITIONS: RoomAssetCondition[] = [
  'GOOD',
  'FAIR',
  'DAMAGED',
  'UNDER_REPAIR',
  'REPLACED',
  'MISSING',
];

export function InventoryPage() {
  const { token, user } = useAuth();
  const handleApiError = useApiErrorHandler();

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isReceptionist = role === 'RECEPTIONIST';
  const canManage = isSuperAdmin || isAdmin;
  const canViewCosts = !isReceptionist;
  const canArchive = isSuperAdmin;
  const canAdjust = isSuperAdmin;
  const canLoss = isSuperAdmin;
  const canPurchase = canManage;
  const canTransfer = canManage;
  const canReturn = canManage;
  const canDamage = canManage;
  const canIssue = Boolean(role);

  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [assets, setAssets] = useState<RoomAsset[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tenancies, setTenancies] = useState<MonthlyTenancy[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [movementType, setMovementType] = useState<InventoryMovementType | ''>(
    '',
  );
  const [condition, setCondition] = useState<RoomAssetCondition | ''>('');
  const [lowStock, setLowStock] = useState<boolean | ''>('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [archiveItem, setArchiveItem] = useState<InventoryItem | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [presetItemId, setPresetItemId] = useState<string | undefined>();
  const [movementMode, setMovementMode] = useState<MovementActionMode | null>(
    null,
  );
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editAsset, setEditAsset] = useState<RoomAsset | null>(null);
  const [viewAsset, setViewAsset] = useState<RoomAsset | null>(null);
  const [archiveAsset, setArchiveAsset] = useState<RoomAsset | null>(null);
  const [conditionAsset, setConditionAsset] = useState<RoomAsset | null>(null);
  const [historyAsset, setHistoryAsset] = useState<RoomAsset | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editCategory, setEditCategory] = useState<InventoryCategory | null>(
    null,
  );
  const [archiveCategory, setArchiveCategory] =
    useState<InventoryCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredUnits = useMemo(
    () =>
      propertyId
        ? units.filter((u) => u.propertyId === propertyId)
        : units,
    [units, propertyId],
  );

  const showToast = useCallback(
    (message: string, tone: 'success' | 'error' = 'success') => {
      setToast({ message, tone });
    },
    [],
  );

  const onError = useCallback(
    (message: string) => {
      showToast(message, 'error');
    },
    [showToast],
  );

  const loadLookups = useCallback(async () => {
    if (!token) return;
    const [cats, props, unitRows, bookingRows, tenancyRows, employeeRows] =
      await Promise.all([
        fetchInventoryCategories(token, true),
        fetchProperties(token),
        fetchUnits(token),
        fetchBookings(token, { bookingStatus: 'CHECKED_IN' }).catch(() => []),
        fetchMonthlyTenancies(token, { tenancyStatus: 'ACTIVE' }).catch(
          () => [],
        ),
        fetchEmployees(token, { isActive: true }).catch(() => []),
      ]);
    setCategories(cats);
    setProperties(props);
    setUnits(unitRows);
    setBookings(bookingRows);
    setTenancies(tenancyRows);
    setEmployees(employeeRows);
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    try {
      const [summaryData, itemRows, movementRows, assetRows] =
        await Promise.all([
          fetchInventorySummary(token),
          fetchInventoryItems(token, {
            search: search.trim() || undefined,
            categoryId: categoryId || undefined,
            lowStock,
            isActive: true,
          }),
          fetchInventoryMovements(token, {
            search: search.trim() || undefined,
            movementType,
            propertyId: propertyId || undefined,
            unitId: unitId || undefined,
            month: month ? Number(month) : '',
            year: year ? Number(year) : '',
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          }),
          fetchRoomAssets(token, {
            search: search.trim() || undefined,
            propertyId: propertyId || undefined,
            unitId: unitId || undefined,
            condition,
            isActive: true,
          }),
        ]);
      setSummary(summaryData);
      setItems(itemRows);
      setMovements(movementRows);
      setAssets(assetRows);
      await loadLookups();
    } catch (err) {
      const message = handleApiError(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    search,
    categoryId,
    lowStock,
    movementType,
    propertyId,
    unitId,
    month,
    year,
    startDate,
    endDate,
    condition,
    loadLookups,
    handleApiError,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const itemColumns: DataTableColumn<InventoryItem>[] = [
    { key: 'code', header: 'Item Code', render: (row) => row.itemCode },
    { key: 'name', header: 'Item Name', render: (row) => row.name },
    {
      key: 'category',
      header: 'Category',
      render: (row) => row.category?.name ?? '—',
    },
    { key: 'uom', header: 'UOM', render: (row) => row.unitOfMeasure },
    {
      key: 'qty',
      header: 'Current Qty',
      render: (row) => (
        <span style={{ color: row.isLowStock ? '#f87171' : undefined }}>
          {row.currentQuantity}
        </span>
      ),
    },
    { key: 'reorder', header: 'Reorder', render: (row) => row.reorderLevel },
    {
      key: 'avg',
      header: 'Avg Unit Cost',
      render: (row) =>
        canViewCosts && row.averageUnitCost != null ? (
          <MoneyDisplay value={row.averageUnitCost} />
        ) : (
          '—'
        ),
    },
    {
      key: 'consumable',
      header: 'Consumable',
      render: (row) => (row.isConsumable ? 'Yes' : 'No'),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (canViewCosts ? row.supplierName ?? '—' : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.isActive ? 'Active' : 'Archived'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="inventory-page__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setViewItem(row)}
          >
            View
          </button>
          {canManage ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEditItem(row);
                setShowItemForm(true);
              }}
            >
              Edit
            </button>
          ) : null}
          {canPurchase ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setPresetItemId(row.id);
                setShowPurchase(true);
              }}
            >
              Purchase
            </button>
          ) : null}
          {canIssue ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setPresetItemId(row.id);
                setShowIssue(true);
              }}
            >
              Issue
            </button>
          ) : null}
          {canTransfer ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setPresetItemId(row.id);
                setMovementMode('transfer');
              }}
            >
              Transfer
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setArchiveItem(row)}
            >
              Archive
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const movementColumns: DataTableColumn<InventoryMovement>[] = [
    {
      key: 'number',
      header: 'Movement #',
      render: (row) => row.movementNumber,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => formatLabel(row.movementType),
    },
    {
      key: 'item',
      header: 'Item',
      render: (row) =>
        row.item ? `${row.item.itemCode} — ${row.item.name}` : '—',
    },
    { key: 'qty', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'cost',
      header: 'Total Cost',
      render: (row) =>
        canViewCosts && row.totalCost != null ? (
          <MoneyDisplay value={row.totalCost} />
        ) : (
          '—'
        ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.movementDate),
    },
    {
      key: 'dest',
      header: 'Location',
      render: (row) =>
        [
          row.destinationProperty?.name ?? row.sourceProperty?.name,
          row.destinationUnit?.unitNumber ?? row.sourceUnit?.unitNumber,
        ]
          .filter(Boolean)
          .join(' / ') || '—',
    },
    {
      key: 'expense',
      header: 'Expense',
      render: (row) => row.expense?.expenseNumber ?? '—',
    },
    {
      key: 'by',
      header: 'By',
      render: (row) => row.createdBy?.fullName ?? '—',
    },
  ];

  const assetColumns: DataTableColumn<RoomAsset>[] = [
    { key: 'code', header: 'Asset Code', render: (row) => row.assetCode },
    {
      key: 'property',
      header: 'Property',
      render: (row) => row.property?.name ?? '—',
    },
    { key: 'unit', header: 'Unit', render: (row) => row.unit?.unitNumber ?? '—' },
    { key: 'item', header: 'Item', render: (row) => row.itemName },
    { key: 'qty', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'cost',
      header: 'Purchase Cost',
      render: (row) =>
        canViewCosts && row.purchaseCost != null ? (
          <MoneyDisplay value={row.purchaseCost} />
        ) : (
          '—'
        ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (row) => <AssetConditionBadge condition={row.condition} />,
    },
    {
      key: 'serial',
      header: 'Serial',
      render: (row) => row.serialNumber ?? '—',
    },
    {
      key: 'assigned',
      header: 'Assigned',
      render: (row) => formatDate(row.assignedDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.isActive ? 'Active' : 'Archived'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="inventory-page__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setViewAsset(row)}
          >
            View
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditAsset(row);
                  setShowAssetForm(true);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setConditionAsset(row)}
              >
                Condition
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setHistoryAsset(row)}
          >
            History
          </button>
          {canArchive ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setArchiveAsset(row)}
            >
              Archive
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const categoryColumns: DataTableColumn<InventoryCategory>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'description',
      header: 'Description',
      render: (row) => row.description ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.isActive ? 'Active' : 'Inactive'),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="inventory-page__actions">
          {canManage ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setEditCategory(row);
                setShowCategoryForm(true);
              }}
            >
              Edit
            </button>
          ) : null}
          {canArchive && row.isActive ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setArchiveCategory(row)}
            >
              Archive
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="inventory-page">
      <PageHeader title="Inventory" breadcrumb={['Home', 'Inventory']} />

      <div className="inventory-page__tabs">
        {(
          [
            ['items', 'Items'],
            ['movements', 'Stock Movements'],
            ['assets', 'Room Assets'],
            ['categories', 'Categories'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`inventory-page__tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="inventory-page__toolbar">
        {canManage && tab === 'items' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditItem(null);
              setShowItemForm(true);
            }}
          >
            Add Item
          </button>
        ) : null}
        {canPurchase ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setPresetItemId(undefined);
              setShowPurchase(true);
            }}
          >
            Purchase Stock
          </button>
        ) : null}
        {canIssue ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setPresetItemId(undefined);
              setShowIssue(true);
            }}
          >
            Issue Item
          </button>
        ) : null}
        {canReturn ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMovementMode('return')}
          >
            Return Item
          </button>
        ) : null}
        {canTransfer ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMovementMode('transfer')}
          >
            Transfer Stock
          </button>
        ) : null}
        {canDamage ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMovementMode('damage')}
          >
            Damage
          </button>
        ) : null}
        {canAdjust ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMovementMode('adjust')}
          >
            Adjust
          </button>
        ) : null}
        {canLoss ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setMovementMode('loss')}
          >
            Loss
          </button>
        ) : null}
        {canManage && tab === 'assets' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditAsset(null);
              setShowAssetForm(true);
            }}
          >
            Add Room Asset
          </button>
        ) : null}
        {canManage && tab === 'categories' ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setEditCategory(null);
              setShowCategoryForm(true);
            }}
          >
            Add Category
          </button>
        ) : null}
      </div>

      {summary ? (
        <div className="inventory-page__summary">
          <SummaryCard
            label="Total Inventory Items"
            value={summary.totalInventoryItems}
            tone="gold"
          />
          <SummaryCard
            label="Total Stock Quantity"
            value={summary.totalStockQuantity}
            tone="default"
          />
          <SummaryCard
            label="Low Stock Items"
            value={summary.lowStockItems}
            tone="danger"
          />
          <SummaryCard
            label="Stock Purchased This Month"
            value={summary.stockPurchasedThisMonth}
            tone="success"
          />
          <SummaryCard
            label="Stock Issued This Month"
            value={summary.stockIssuedThisMonth}
            tone="info"
          />
          {canViewCosts && summary.inventoryExpenseThisMonth != null ? (
            <SummaryCard
              label="Inventory Expense This Month"
              value={formatPkr(Number(summary.inventoryExpenseThisMonth))}
              tone="warn"
            />
          ) : null}
          <SummaryCard
            label="Room Assets"
            value={summary.roomAssets}
            tone="default"
          />
          <SummaryCard
            label="Damaged Assets"
            value={summary.damagedAssets}
            tone="danger"
          />
        </div>
      ) : null}

      <FilterBar>
        <label>
          <span>Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, name, room…"
          />
        </label>
        {tab === 'items' || tab === 'categories' ? (
          <label>
            <span>Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">All</option>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {tab === 'items' ? (
          <label>
            <span>Low Stock</span>
            <select
              value={lowStock === '' ? '' : String(lowStock)}
              onChange={(e) =>
                setLowStock(
                  e.target.value === '' ? '' : e.target.value === 'true',
                )
              }
            >
              <option value="">All</option>
              <option value="true">Low stock only</option>
            </select>
          </label>
        ) : null}
        {tab === 'movements' || tab === 'assets' ? (
          <>
            <label>
              <span>Property</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId('');
                }}
              >
                <option value="">All</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Unit</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">All</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {tab === 'movements' ? (
          <>
            <label>
              <span>Movement Type</span>
              <select
                value={movementType}
                onChange={(e) =>
                  setMovementType(
                    e.target.value as InventoryMovementType | '',
                  )
                }
              >
                <option value="">All</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Month</span>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <label>
              <span>Year</span>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
            <label>
              <span>Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label>
              <span>End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </>
        ) : null}
        {tab === 'assets' ? (
          <label>
            <span>Condition</span>
            <select
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value as RoomAssetCondition | '')
              }
            >
              <option value="">All</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {formatLabel(c)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </FilterBar>

      {error ? <ErrorState message={error} onRetry={() => void loadData()} /> : null}
      {isLoading ? <LoadingState message="Loading inventory…" /> : null}

      {!isLoading && !error && tab === 'items' ? (
        items.length === 0 ? (
          <EmptyState title="No inventory items" />
        ) : (
          <DataTable columns={itemColumns} rows={items} rowKey={(r) => r.id} />
        )
      ) : null}

      {!isLoading && !error && tab === 'movements' ? (
        movements.length === 0 ? (
          <EmptyState title="No stock movements" />
        ) : (
          <DataTable
            columns={movementColumns}
            rows={movements}
            rowKey={(r) => r.id}
          />
        )
      ) : null}

      {!isLoading && !error && tab === 'assets' ? (
        assets.length === 0 ? (
          <EmptyState title="No room assets" />
        ) : (
          <DataTable
            columns={assetColumns}
            rows={assets}
            rowKey={(r) => r.id}
          />
        )
      ) : null}

      {!isLoading && !error && tab === 'categories' ? (
        categories.length === 0 ? (
          <EmptyState title="No categories" />
        ) : (
          <DataTable
            columns={categoryColumns}
            rows={categories}
            rowKey={(r) => r.id}
          />
        )
      ) : null}

      {token ? (
        <>
          <InventoryItemFormModal
            open={showItemForm}
            token={token}
            item={editItem}
            categories={categories.filter((c) => c.isActive)}
            onClose={() => {
              setShowItemForm(false);
              setEditItem(null);
            }}
            onSaved={() => {
              showToast('Inventory item saved');
              void loadData();
            }}
            onError={onError}
          />
          <PurchaseStockFormModal
            open={showPurchase}
            token={token}
            items={items}
            properties={properties}
            presetItemId={presetItemId}
            canViewCosts={canViewCosts}
            onClose={() => setShowPurchase(false)}
            onSaved={() => {
              showToast('Purchase recorded');
              void loadData();
            }}
            onError={onError}
          />
          <IssueItemFormModal
            open={showIssue}
            token={token}
            items={items}
            properties={properties}
            units={units}
            bookings={bookings}
            tenancies={tenancies}
            employees={employees}
            presetItemId={presetItemId}
            canViewCosts={canViewCosts}
            onClose={() => setShowIssue(false)}
            onSaved={() => {
              showToast('Item issued');
              void loadData();
            }}
            onError={onError}
          />
          <MovementActionFormModal
            open={Boolean(movementMode)}
            token={token}
            mode={movementMode}
            items={items}
            properties={properties}
            units={units}
            presetItemId={presetItemId}
            onClose={() => setMovementMode(null)}
            onSaved={() => {
              showToast('Movement recorded');
              void loadData();
            }}
            onError={onError}
          />
          <RoomAssetFormModal
            open={showAssetForm}
            token={token}
            asset={editAsset}
            properties={properties}
            units={units}
            canViewCosts={canViewCosts}
            onClose={() => {
              setShowAssetForm(false);
              setEditAsset(null);
            }}
            onSaved={() => {
              showToast('Room asset saved');
              void loadData();
            }}
            onError={onError}
          />
          <ChangeConditionFormModal
            open={Boolean(conditionAsset)}
            token={token}
            asset={conditionAsset}
            onClose={() => setConditionAsset(null)}
            onSaved={() => {
              showToast('Asset condition updated');
              void loadData();
            }}
            onError={onError}
          />
          <RoomAssetHistoryModal
            open={Boolean(historyAsset)}
            token={token}
            asset={historyAsset}
            canViewCosts={canViewCosts}
            onClose={() => setHistoryAsset(null)}
            onError={onError}
          />
          <CategoryFormModal
            open={showCategoryForm}
            token={token}
            category={editCategory}
            onClose={() => {
              setShowCategoryForm(false);
              setEditCategory(null);
            }}
            onSaved={() => {
              showToast('Category saved');
              void loadData();
            }}
            onError={onError}
          />
        </>
      ) : null}

      <FormModal
        open={Boolean(viewItem)}
        title={viewItem ? `Item ${viewItem.itemCode}` : 'Item'}
        onClose={() => setViewItem(null)}
      >
        {viewItem ? (
          <div className="inventory-detail form-grid">
            <dl>
              <dt>Name</dt>
              <dd>{viewItem.name}</dd>
              <dt>Category</dt>
              <dd>{viewItem.category?.name ?? '—'}</dd>
              <dt>Quantity</dt>
              <dd>{viewItem.currentQuantity}</dd>
              <dt>Reorder</dt>
              <dd>{viewItem.reorderLevel}</dd>
              <dt>Consumable</dt>
              <dd>{viewItem.isConsumable ? 'Yes' : 'No'}</dd>
              {canViewCosts ? (
                <>
                  <dt>Avg Cost</dt>
                  <dd>
                    {viewItem.averageUnitCost != null
                      ? formatPkr(Number(viewItem.averageUnitCost))
                      : '—'}
                  </dd>
                  <dt>Supplier</dt>
                  <dd>{viewItem.supplierName ?? '—'}</dd>
                </>
              ) : null}
            </dl>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setViewItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </FormModal>

      <FormModal
        open={Boolean(viewAsset)}
        title={viewAsset ? `Asset ${viewAsset.assetCode}` : 'Asset'}
        onClose={() => setViewAsset(null)}
      >
        {viewAsset ? (
          <div className="inventory-detail form-grid">
            <dl>
              <dt>Item</dt>
              <dd>{viewAsset.itemName}</dd>
              <dt>Property</dt>
              <dd>{viewAsset.property?.name ?? '—'}</dd>
              <dt>Unit</dt>
              <dd>{viewAsset.unit?.unitNumber ?? '—'}</dd>
              <dt>Condition</dt>
              <dd>
                <AssetConditionBadge condition={viewAsset.condition} />
              </dd>
              <dt>Serial</dt>
              <dd>{viewAsset.serialNumber ?? '—'}</dd>
              {canViewCosts ? (
                <>
                  <dt>Cost</dt>
                  <dd>
                    {viewAsset.purchaseCost != null
                      ? formatPkr(Number(viewAsset.purchaseCost))
                      : '—'}
                  </dd>
                </>
              ) : null}
            </dl>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setViewAsset(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </FormModal>

      <ConfirmDialog
        open={Boolean(archiveItem)}
        title="Archive inventory item?"
        message={
          archiveItem
            ? `Archive ${archiveItem.itemCode} — ${archiveItem.name}?`
            : ''
        }
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveItem(null)}
        onConfirm={() => {
          if (!token || !archiveItem || busy) return;
          setBusy(true);
          void archiveInventoryItem(token, archiveItem.id)
            .then(() => {
              showToast('Item archived');
              setArchiveItem(null);
              void loadData();
            })
            .catch((err) => onError(handleApiError(err)))
            .finally(() => setBusy(false));
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveAsset)}
        title="Archive room asset?"
        message={
          archiveAsset
            ? `Archive ${archiveAsset.assetCode} — ${archiveAsset.itemName}?`
            : ''
        }
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveAsset(null)}
        onConfirm={() => {
          if (!token || !archiveAsset || busy) return;
          setBusy(true);
          void archiveRoomAsset(token, archiveAsset.id)
            .then(() => {
              showToast('Room asset archived');
              setArchiveAsset(null);
              void loadData();
            })
            .catch((err) => onError(handleApiError(err)))
            .finally(() => setBusy(false));
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveCategory)}
        title="Archive category?"
        message={
          archiveCategory
            ? `Archive category "${archiveCategory.name}"? Items keep their link.`
            : ''
        }
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveCategory(null)}
        onConfirm={() => {
          if (!token || !archiveCategory || busy) return;
          setBusy(true);
          void archiveInventoryCategory(token, archiveCategory.id)
            .then(() => {
              showToast('Category archived');
              setArchiveCategory(null);
              void loadData();
            })
            .catch((err) => onError(handleApiError(err)))
            .finally(() => setBusy(false));
        }}
      />

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
