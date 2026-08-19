import { cancellationDoc, privacyDoc, termsDoc } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

// Nội dung pháp lý port từ bản tiền nhiệm nên phải có lưới canh brand: 19/08 user
// lấy LẠI tên "Nexora" cho v2, nên brand tạm "Tourism" (viết hoa — tên riêng,
// không bắt chữ thường "tourism" nghĩa chung) mới là thứ không được sót; còn
// slug trùng thì gãy anchor TOC rất âm thầm.
const DOCS = [
  ['terms', termsDoc],
  ['privacy', privacyDoc],
  ['cancellation', cancellationDoc],
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

  it.each(DOCS)('%s ghi ngày cập nhật thống nhất', (_name, doc) => {
    expect(doc.updated).toBe('Last updated: 25 July 2026');
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
