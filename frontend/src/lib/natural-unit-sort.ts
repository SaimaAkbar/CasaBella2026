/** Natural room order: 2, 3, 101, 102, 201 — not 101, 102, 2. */
export function compareUnitNumbers(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return collator.compare(left, right);
}

export function sortByUnitNumber<T>(
  rows: T[],
  getNumber: (row: T) => string | null | undefined,
): T[] {
  return [...rows].sort((left, right) =>
    compareUnitNumbers(getNumber(left) ?? '', getNumber(right) ?? ''),
  );
}
