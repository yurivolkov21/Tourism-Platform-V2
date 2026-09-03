import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { csvDocument } from './csv';
import { SUBSCRIBERS_CSV_HEADER, subscribersCsvRows, toSubscriberCsvRow } from './subscribers-csv';

/**
 * Hàng CSV của `/subscribers/export` (spec P4c §3-F10). File nấu cho CÔNG CỤ,
 * không cho mắt người: mốc là ISO UTC nguyên văn của contract, và giá trị
 * vắng là Ô RỖNG chứ không phải "Direct sign-up"/"Still subscribed" (hai câu
 * đó thuộc về bảng — trong một cột ngày, chúng phá mọi phép lọc/sắp xếp).
 */

const t = messages.admin.subscribers.csv;

const row: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: 'footer',
  createdAt: '2026-09-01T10:00:00.000Z',
  unsubscribedAt: '2026-09-02T08:30:00.000Z',
};

describe('SUBSCRIBERS_CSV_HEADER', () => {
  it('ĐÚNG bốn cột theo spec, không thêm `id` hay cột nào khác', () => {
    expect(SUBSCRIBERS_CSV_HEADER).toEqual([t.email, t.source, t.subscribedAt, t.unsubscribedAt]);
  });
});

describe('toSubscriberCsvRow', () => {
  it('mốc là ISO UTC NGUYÊN VĂN của contract, không phải chữ đã format', () => {
    expect(toSubscriberCsvRow(row)).toEqual([
      'ada@example.com',
      'footer',
      '2026-09-01T10:00:00.000Z',
      '2026-09-02T08:30:00.000Z',
    ]);
  });

  it('hàng còn nhận tin: ô Unsubscribed at RỖNG — "chưa có giá trị" với mọi công cụ', () => {
    expect(toSubscriberCsvRow({ ...row, unsubscribedAt: null })[3]).toBe('');
  });

  it('không khai nguồn: ô Source RỖNG, không phải câu của bảng', () => {
    const cells = toSubscriberCsvRow({ ...row, source: null });
    expect(cells[1]).toBe('');
    expect(cells[1]).not.toBe(messages.admin.subscribers.list.noSource);
  });

  it('số cột của hàng khớp số cột của header', () => {
    expect(toSubscriberCsvRow(row)).toHaveLength(SUBSCRIBERS_CSV_HEADER.length);
  });
});

describe('subscribersCsvRows', () => {
  it('header + một hàng mỗi địa chỉ', () => {
    expect(subscribersCsvRows([row])).toEqual([
      [...SUBSCRIBERS_CSV_HEADER],
      toSubscriberCsvRow(row),
    ]);
  });

  it('tập rỗng vẫn giữ header — file mở ra nói rõ "bộ lọc này không có ai"', () => {
    expect(subscribersCsvRows([])).toEqual([[...SUBSCRIBERS_CSV_HEADER]]);
  });

  it('email dạng công thức bị vô hiệu khi ghép file (CSV injection)', () => {
    // Địa chỉ do NGƯỜI LẠ tự điền vào form footer công khai — đúng bề mặt mà
    // một ô bắt đầu bằng `=` biến thành code chạy trên máy người mở file.
    const document = csvDocument(
      subscribersCsvRows([{ ...row, email: '=HYPERLINK("http://evil","x")@example.com' }]),
    );
    expect(document).toContain('"\'=HYPERLINK(""http://evil"",""x"")@example.com"');
  });
});
