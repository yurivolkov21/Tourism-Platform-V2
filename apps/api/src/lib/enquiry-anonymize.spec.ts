import { retentionCutoff } from './enquiry-anonymize.js';

// W4 E8 (ADR-0039 §6): mốc "cũ hơn thì anonymize" — lùi N THÁNG theo ngày
// lịch UTC (cùng nếp ADR-0030), để JS Date tự chuẩn hoá tháng âm/ngày tràn.

describe('retentionCutoff', () => {
  it('lùi đúng N tháng cùng ngày, giờ về 00:00 UTC', () => {
    expect(retentionCutoff(new Date('2026-09-07T15:30:00.000Z'), 18)).toEqual(
      new Date('2025-03-07T00:00:00.000Z'),
    );
  });

  it('qua ranh giới năm', () => {
    expect(retentionCutoff(new Date('2026-01-15T00:00:00.000Z'), 3)).toEqual(
      new Date('2025-10-15T00:00:00.000Z'),
    );
  });

  it('ngày cuối tháng tràn (31/03 lùi 1 tháng không có 31/02) → Date tự chuẩn hoá, không throw', () => {
    // Date.UTC(2026, 1, 31) = 03/03/2026 — hành vi chuẩn hoá của JS, chấp
    // nhận được cho một mốc retention (lệch vài ngày không đổi bản chất).
    expect(retentionCutoff(new Date('2026-03-31T12:00:00.000Z'), 1)).toEqual(
      new Date(Date.UTC(2026, 1, 31)),
    );
  });
});
