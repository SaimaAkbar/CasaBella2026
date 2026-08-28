export type DiffRow = {
  key: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  changed: boolean;
};

const HIDDEN_KEYS = new Set([
  'kind',
  'method',
  'path',
  'query',
  'id',
  'createdAt',
  'updatedAt',
  'createdByUserId',
  'approvedByUserId',
]);

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  paidAmount: 'Paid amount',
  remainingAmount: 'Remaining amount',
  billingMonth: 'Billing month',
  billingYear: 'Billing year',
  expenseDate: 'Expense date',
  expenseScope: 'Scope',
  categoryId: 'Category',
  categoryName: 'Category',
  unitId: 'Unit',
  unitNumber: 'Unit',
  propertyId: 'Property',
  propertyName: 'Property',
  description: 'Description',
  vendorName: 'Vendor',
  notes: 'Notes',
  expenseName: 'Expense name',
  expenseNumber: 'Expense no.',
  paymentStatus: 'Payment status',
  paymentMethod: 'Payment method',
  dueDate: 'Due date',
  paymentDate: 'Payment date',
  checkInDateTime: 'Check-in',
  checkOutDateTime: 'Check-out',
  fullName: 'Name',
  nightlyRate: 'Nightly rate',
  totalAmount: 'Total',
  rentAmount: 'Rent',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(
  value: unknown,
  prefix = '',
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }

  const source =
    prefix === '' && isPlainObject(value.patch)
      ? (value.patch as Record<string, unknown>)
      : value;

  for (const [key, nested] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(nested)) {
      flatten(nested, path, out);
    } else {
      out[path] = nested;
    }
  }

  return out;
}

function unwrapProposed(
  newData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!newData) return {};
  if (newData.kind === 'http_replay') {
    return isPlainObject(newData.body) ? newData.body : {};
  }
  if (isPlainObject(newData.patch)) return newData.patch;
  return newData;
}

function leafKey(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}

function lookupOld(
  oldFlat: Record<string, unknown>,
  path: string,
): unknown {
  if (path in oldFlat) return oldFlat[path];
  const leaf = leafKey(path);
  if (leaf in oldFlat) return oldFlat[leaf];
  const skipMeta = path.replace(/^metadata\./, '');
  if (skipMeta !== path && skipMeta in oldFlat) return oldFlat[skipMeta];
  for (const [key, value] of Object.entries(oldFlat)) {
    if (leafKey(key) === leaf) return value;
  }
  return undefined;
}

function canon(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const asNum = Number(value);
    if (value.trim() !== '' && Number.isFinite(asNum)) {
      return String(asNum);
    }
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate) && /\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(asDate).toISOString().slice(0, 10);
    }
    return value;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function humanize(key: string): string {
  const leaf = leafKey(key);
  if (FIELD_LABELS[leaf]) return FIELD_LABELS[leaf];
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return leaf
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

export function buildDiffRows(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): DiffRow[] {
  const proposed = unwrapProposed(newData);
  const oldFlat = flatten(oldData ?? {});
  const newFlat = flatten(proposed);
  const keys = Array.from(new Set(Object.keys(newFlat)))
    .filter((key) => !HIDDEN_KEYS.has(key) && !HIDDEN_KEYS.has(leafKey(key)))
    .sort();

  const rows = keys.map((key) => {
    const newValue = newFlat[key];
    const oldValue = lookupOld(oldFlat, key);
    const changed = canon(oldValue) !== canon(newValue);
    return {
      key,
      label: humanize(key),
      oldValue,
      newValue,
      changed,
    };
  });

  const changed = rows.filter((row) => row.changed);
  return changed.length > 0 ? changed : rows;
}

export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatApprovalDiffValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const leaf = leafKey(key).toLowerCase();
  if (leaf.includes('amount') || leaf.includes('rate') || leaf.includes('rent')) {
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(amount)) {
      return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        maximumFractionDigits: 2,
      }).format(amount);
    }
  }
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    }
  }
  return formatDiffValue(value);
}
