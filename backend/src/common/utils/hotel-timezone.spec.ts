import {
  hotelCalendarYmd,
  hotelDayUtcRange,
} from './hotel-timezone';

describe('hotel timezone helpers', () => {
  it('formats PKT calendar dates consistently', () => {
    expect(hotelCalendarYmd(new Date('2026-08-16T14:18:00+05:00'))).toBe(
      '2026-08-16',
    );
    expect(hotelCalendarYmd(new Date('2026-08-15T21:00:00.000Z'))).toBe(
      '2026-08-16',
    );
  });

  it('maps a hotel day to the PKT UTC window', () => {
    const { start, end } = hotelDayUtcRange('2026-08-16');
    expect(start.toISOString()).toBe('2026-08-15T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-16T18:59:59.999Z');
  });
});
