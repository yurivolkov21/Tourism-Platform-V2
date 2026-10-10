import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocFooter } from './doc-footer';
import { DocLetterhead } from './doc-letterhead';
import { DocPage } from './doc-page';
import { DocStamp, STAMP_TONE_CLASS } from './doc-stamp';

describe('DocPage', () => {
  it('là tờ A4 chỉ hiện khi in, mang data-print-doc và phạm vi màu sáng', () => {
    const html = renderToStaticMarkup(createElement(DocPage, null, 'x'));
    expect(html).toContain('data-print-doc=""');
    // So theo TỪNG class, không theo chuỗi con: "light" nằm trong "scheme-light", so chuỗi thì
    // mất class `light` (giấy tối khi in từ giao diện tối) mà ca vẫn xanh.
    const classes = html.match(/class="([^"]*)"/)?.[1]?.split(' ') ?? [];
    for (const cls of ['light', 'scheme-light', 'hidden', 'print:flex', 'h-[297mm]', 'w-[210mm]']) {
      expect(classes).toContain(cls);
    }
  });

  // Tờ phủ kín A4 lề 0 và ép in màu: nền phải là màu gần trắng nhất (`card`), không phải
  // `background` ám xám — cả tờ in một lớp nền, tốn mực, dải `paper` chìm vào (review G40).
  it('nền giấy là card, không phải background', () => {
    const html = renderToStaticMarkup(createElement(DocPage, null, 'x'));
    const classes = html.match(/class="([^"]*)"/)?.[1]?.split(' ') ?? [];
    expect(classes).toContain('bg-card');
    expect(classes).not.toContain('bg-background');
  });
});

describe('DocLetterhead', () => {
  it('giấy: loại, số và mốc của tài liệu; không scope tối', () => {
    const html = renderToStaticMarkup(
      createElement(DocLetterhead, {
        brand: 'B',
        docType: 'Monthly report',
        docNumber: '2026-09',
        meta: 'Generated 1 Oct 2026, 08:00 UTC',
      }),
    );
    expect(html).toContain('Monthly report');
    expect(html).toContain('data-slot="doc-number"');
    expect(html).toContain('2026-09');
    expect(html).toContain('Generated 1 Oct 2026, 08:00 UTC');
    expect(html).not.toMatch(/<header[^>]*class="[^"]*\bdark\b/);
  });

  it('bìa ảnh: gắn scope dark (teal nhạt cho primary-emphasis), chữ on-media, không dòng số', () => {
    const html = renderToStaticMarkup(
      createElement(DocLetterhead, {
        brand: 'B',
        docType: 'Trip voucher',
        meta: 'm',
        tone: 'photo',
      }),
    );
    expect(html).toMatch(/<header[^>]*class="[^"]*\bdark\b/);
    expect(html).toContain('text-on-media/80');
    expect(html).not.toContain('data-slot="doc-number"');
  });
});

describe('DocStamp', () => {
  it('tông confirmed là teal primary, không phải success (G32); pending nghiêng ngược', () => {
    expect(STAMP_TONE_CLASS.confirmed).toContain('text-primary');
    expect(STAMP_TONE_CLASS.confirmed).not.toContain('success');
    expect(STAMP_TONE_CLASS.pending).toContain('text-pending');
    expect(STAMP_TONE_CLASS.pending).toContain('-rotate-2');
    const html = renderToStaticMarkup(
      createElement(DocStamp, { label: 'CONFIRMED', tone: 'confirmed' }),
    );
    expect(html).toContain('CONFIRMED');
    expect(html).toContain('data-tone="confirmed"');
  });
});

describe('DocFooter', () => {
  it('hai đầu chân trang', () => {
    const html = renderToStaticMarkup(createElement(DocFooter, { start: 'help', end: 'printed' }));
    expect(html).toContain('data-slot="doc-footer"');
    expect(html).toContain('help');
    expect(html).toContain('printed');
  });
});
