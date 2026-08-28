/**
 * Natural / numeric unit-number sorting.
 * "101","102","201" stay in floor order; "A-101","A-102","A-201" keep the prefix.
 * Lexicographic string sort would produce "101","102","201","203","3","4","6".
 */

const TOKEN_RE = /(\d+)|(\D+)/g;

function tokenize(value: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const source = value.trim();
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source)) !== null) {
    if (match[1]) {
      tokens.push(Number(match[1]));
    } else if (match[2]) {
      tokens.push(match[2].toLowerCase());
    }
  }
  return tokens;
}

export function compareUnitNumbers(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const xa = left[index];
    const xb = right[index];
    if (xa === undefined) return -1;
    if (xb === undefined) return 1;
    if (typeof xa === 'number' && typeof xb === 'number') {
      if (xa !== xb) return xa - xb;
      continue;
    }
    const cmp = String(xa).localeCompare(String(xb), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (cmp !== 0) return cmp;
  }

  return 0;
}

export function sortByUnitNumber<T>(
  items: T[],
  getNumber: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort((left, right) =>
    compareUnitNumbers(getNumber(left) ?? '', getNumber(right) ?? ''),
  );
}

export function sortByPropertyThenUnitNumber<T>(
  items: T[],
  getProperty: (item: T) => string | null | undefined,
  getNumber: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort((left, right) => {
    const propertyCmp = (getProperty(left) ?? '').localeCompare(
      getProperty(right) ?? '',
      undefined,
      { sensitivity: 'base' },
    );
    if (propertyCmp !== 0) return propertyCmp;
    return compareUnitNumbers(getNumber(left) ?? '', getNumber(right) ?? '');
  });
}
