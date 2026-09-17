import { cancellationDoc, cancellationWindowBullets, privacyDoc, termsDoc } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

// Nội dung pháp lý port từ bản tiền nhiệm nên phải có lưới canh brand: 19/08 user
// lấy LẠI tên "Nexora" cho v2, nên brand tạm "Tourism" (viết hoa — tên riêng,
// không bắt chữ thường "tourism" nghĩa chung) mới là thứ không được sót; còn
// slug trùng thì gãy anchor TOC rất âm thầm.
const DOCS = [
  ['terms', termsDoc, 'Last updated: 15 September 2026'],
  ['privacy', privacyDoc, 'Last updated: 25 July 2026'],
  ['cancellation', cancellationDoc, 'Last updated: 15 September 2026'],
] as const;

describe('nội dung pháp lý', () => {
  it.each(DOCS)('%s không còn nhắc brand tạm "Tourism"', (_name, doc) => {
    expect(JSON.stringify(doc)).not.toMatch(/\bTourism\b/);
    expect(JSON.stringify(doc)).toMatch(/Nexora/);
  });

  it.each(DOCS)('%s có slug section duy nhất (anchor TOC phụ thuộc)', (_name, doc) => {
    const slugs = doc.sections.map((s) => slugify(s.heading));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => s.length > 0)).toBe(true);
  });

  it.each(DOCS)('%s có reviewNote cảnh báo tài liệu mẫu', (_name, doc) => {
    expect(doc.reviewNote).toBeTruthy();
  });

  it.each(DOCS)('%s ghi đúng ngày cập nhật của chính nó', (_name, doc, updated) => {
    expect(doc.updated).toBe(updated);
  });

  it('terms nói rõ thanh toán chạy test mode', () => {
    const testModeSection = termsDoc.sections.find((s) => s.heading === 'Test-mode payments');
    expect(testModeSection).toBeDefined();
    expect(JSON.stringify(testModeSection)).toMatch(/test\/sandbox mode/i);
  });

  it('cancellation nhắc lại chuyện không có tiền thật', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/test\/sandbox mode/i);
  });
});

/**
 * ADR-0041 để lại đúng MỘT luật huỷ cho mọi tour. Hai văn bản pháp lý là nơi
 * lời hứa cũ sống dai nhất (bảng bậc, ân hạn 24 giờ, hẹn "2 business days",
 * đổi ngày, vế "recover from suppliers"), nên khoá cả hai chiều: ý mới phải có
 * mặt, ý đã gỡ không được lẻn về.
 */
describe('chính sách huỷ một hạn chót (ADR-0041)', () => {
  const both = JSON.stringify([cancellationDoc, termsDoc]);

  it('bảng hạn chót của /cancellation-policy sinh từ luật chung, đúng ba dòng', () => {
    const section = cancellationDoc.sections.find(
      (s) => s.heading === 'Your free-cancellation deadline',
    );
    expect(section?.bullets).toEqual(cancellationWindowBullets());
    expect(section?.bullets).toHaveLength(3);
  });

  it('nói rõ chuyến ngừng nhận đặt đúng lúc hạn chót hết, và lối liên hệ khi cần đi gấp', () => {
    const section = cancellationDoc.sections.find((s) => s.heading === 'When bookings close');
    expect(JSON.stringify(section)).toMatch(/contact us/i);
  });

  it('công ty huỷ chuyến thì hoàn 100%', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/100% of what you paid/);
  });

  it('nói thời gian tiền về và phương thức thanh toán ban đầu', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/5–10 business days/);
    expect(JSON.stringify(cancellationDoc)).toMatch(/payment method you used at checkout/);
  });

  it('không còn bảng bậc, ân hạn 24 giờ, hẹn 2 ngày làm việc hay vế "recover from suppliers"', () => {
    for (const pattern of [
      /refund schedule/i,
      /24 hours/i,
      /2 business days/i,
      /recover from suppliers/i,
      /50% refund/i,
    ]) {
      expect(both).not.toMatch(pattern);
    }
  });

  it('không hứa đổi ngày ở cả hai văn bản', () => {
    for (const pattern of [/reschedule/i, /date change/i, /amendment fee/i, /re-arrange/i]) {
      expect(both).not.toMatch(pattern);
    }
  });
});
