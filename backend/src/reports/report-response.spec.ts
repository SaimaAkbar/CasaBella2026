import { buildReport, paginateRows } from './report-response';

describe('report response helpers', () => {
  it('paginates rows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = paginateRows(rows, 2, 3);
    expect(result.pagination).toEqual({ page: 2, limit: 3, total: 10 });
    expect(result.rows).toEqual([{ id: 3 }, { id: 4 }, { id: 5 }]);
  });

  it('builds consistent report envelope', () => {
    const report = buildReport({
      reportType: 'payments',
      user: {
        id: 'u1',
        fullName: 'Admin',
        email: 'a@b.c',
        phone: '1',
        role: 'SUPER_ADMIN' as never,
        status: 'ACTIVE' as never,
        canAccessSalary: true,
        canAccessProfitLoss: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      filters: { month: 8, year: 2026 },
      columns: [{ key: 'amount', header: 'Amount' }],
      rows: [{ amount: '100' }, { amount: '200' }],
      summary: { total: 2 },
      page: 1,
      limit: 25,
    });

    expect(report.reportName).toBe('Payment Report');
    expect(report.generatedBy.fullName).toBe('Admin');
    expect(report.pagination.total).toBe(2);
    expect(report.rows).toHaveLength(2);
  });
});
