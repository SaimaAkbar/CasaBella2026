import {
  compareUnitNumbers,
  sortByPropertyThenUnitNumber,
  sortByUnitNumber,
} from './natural-unit-sort';

describe('natural unit sort', () => {
  it('orders Casa Bella-style numbers by floor then room', () => {
    const input = ['203', '101', '6', '102', '201', '3', '301'];
    const sorted = [...input].sort(compareUnitNumbers);
    expect(sorted).toEqual(['3', '6', '101', '102', '201', '203', '301']);
  });

  it('keeps prefixed apartments together', () => {
    const input = ['A-201', 'A-101', 'A-102', 'B-1'];
    const sorted = [...input].sort(compareUnitNumbers);
    expect(sorted).toEqual(['A-101', 'A-102', 'A-201', 'B-1']);
  });

  it('sorts objects by unit number', () => {
    const rows = [{ unitNumber: '201' }, { unitNumber: '101' }, { unitNumber: '102' }];
    expect(sortByUnitNumber(rows, (row) => row.unitNumber).map((row) => row.unitNumber)).toEqual([
      '101',
      '102',
      '201',
    ]);
  });

  it('groups by property then unit', () => {
    const rows = [
      { property: 'Palm', unitNumber: 'A-201' },
      { property: 'Casa Bella', unitNumber: '203' },
      { property: 'Casa Bella', unitNumber: '101' },
      { property: 'Palm', unitNumber: 'A-101' },
    ];
    expect(
      sortByPropertyThenUnitNumber(
        rows,
        (row) => row.property,
        (row) => row.unitNumber,
      ),
    ).toEqual([
      { property: 'Casa Bella', unitNumber: '101' },
      { property: 'Casa Bella', unitNumber: '203' },
      { property: 'Palm', unitNumber: 'A-101' },
      { property: 'Palm', unitNumber: 'A-201' },
    ]);
  });
});
