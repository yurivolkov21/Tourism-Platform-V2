import { cancellationDoc, cancellationWindowBullets, privacyDoc, termsDoc } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { OFFICES } from '../mocks/offices.js';
import { EMAIL, PHONE } from './site.js';
import { slugify } from './slug.js';

// Nội dung pháp lý port từ bản tiền nhiệm nên phải có lưới canh brand: 19/08 user
// lấy LẠI tên "Nexora" cho v2, nên brand tạm "Tourism" (viết hoa — tên riêng,
// không bắt chữ thường "tourism" nghĩa chung) mới là thứ không được sót; còn
// slug trùng thì gãy anchor TOC rất âm thầm.
const DOCS = [
  ['terms', termsDoc, 'Last updated: 15 September 2026'],
  ['privacy', privacyDoc, 'Last updated: 19 October 2026'],
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

  it('privacy nói đúng cách đăng nhập: mật khẩu lưu dạng hash, Supabase không lo xác thực (W-01)', () => {
    // Bản 25/07 hứa "we never see or store your password" và gọi Supabase là nhà cung cấp xác
    // thực — sai từ khi chuyển sang Better Auth: DB của dự án giữ hash mật khẩu.
    const text = JSON.stringify(privacyDoc);
    expect(text).not.toMatch(/never see or store your password/i);
    expect(text).not.toMatch(/authentication provider \(Supabase\)/i);
    expect(text).toMatch(/one-way hash/);
    expect(text).toMatch(/sign in with Google/);
  });

  it('privacy kể trợ lý AI: tin chat đi tới Anthropic, hội thoại xoá sau 30 ngày (P6)', () => {
    // Chat bật trên production 19/10 (ADR-0050): tin khách gõ đi tới Anthropic để model viết câu
    // trả lời. Danh sách bên nhận dữ liệu mà thiếu Anthropic là văn bản pháp lý nói sai.
    const share = privacyDoc.sections.find((s) => s.heading === 'How we share your information');
    expect(JSON.stringify(share)).toMatch(/Anthropic/);
    const collect = privacyDoc.sections.find((s) => s.heading === 'Information we collect');
    expect(JSON.stringify(collect)).toMatch(/30 days/);
  });

  it('privacy kể Sentry trong danh sách nhà cung cấp (ADR-0010 AMEND 1)', () => {
    // API gửi lỗi 500 lên Sentry khi có SENTRY_DSN; chi tiết lỗi kèm đường dẫn trang đi ra ngoài.
    const share = privacyDoc.sections.find((s) => s.heading === 'How we share your information');
    expect(JSON.stringify(share)).toMatch(/error-monitoring provider \(Sentry\)/);
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

/**
 * Sổ nợ C1: Terms và Privacy gõ tay email, số điện thoại và địa chỉ bưu chính, trong khi phần còn
 * lại của site đọc từ `lib/site.ts` và `mocks/offices.ts`. Đổi một nguồn mà quên văn bản pháp lý
 * thì không build, lint hay test nào khác bắt được.
 */
describe('liên hệ trong văn bản pháp lý khớp nguồn chung (sổ nợ C1)', () => {
  const hcm = OFFICES.find((o) => o.city === 'Hồ Chí Minh City');

  it.each([
    ['terms', termsDoc],
    ['privacy', privacyDoc],
  ] as const)('%s in đúng EMAIL, PHONE và dòng đầu địa chỉ văn phòng Hồ Chí Minh', (_name, doc) => {
    const contact = doc.sections.find((s) => s.heading === 'Contact us');
    const text = JSON.stringify(contact);
    expect(text).toContain(EMAIL);
    expect(text).toContain(PHONE);
    expect(hcm?.addressLines[0]).toBeDefined();
    expect(text).toContain(hcm?.addressLines[0]);
  });
});
