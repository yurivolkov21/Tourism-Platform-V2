import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  buildSubscribersWorkbook,
  SUBSCRIBERS_XLSX_HEADER,
  subscriberStatus,
  subscribersFilterSummary,
} from './subscribers-xlsx';
import { DATETIME_FMT } from './xlsx-style';

const l = messages.admin.subscribers.list;
const x = messages.admin.subscribers.xlsx;

const active: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: '2026-09-01T10:05:00.000Z',
  unsubscribedAt: null,
};
const left: SubscriberRow = {
  ...active,
  id: '4f2a1b3c-0000-4000-8000-000000000002',
  email: 'bo@example.com',
  source: 'footer',
  unsubscribedAt: '2026-09-02T08:30:00.000Z',
};

async function open(rows: readonly SubscriberRow[] = [active, left]): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildSubscribersWorkbook(rows, {
      query: { page: 1, limit: 20, active: true },
      generatedAt: '2026-10-10T02:30:00.000Z',
    }),
  );
  const sheet = book.getWorksheet(x.sheet);
  if (!sheet) throw new Error('Không có sheet Subscribers');
  return sheet;
}

describe('subscriberStatus', () => {
  it('đã rút consent → Unsubscribed; chưa bấm link xác nhận → Awaiting confirmation; còn lại Active', () => {
    expect(subscriberStatus(left)).toBe(l.unsubscribed);
    // Rút consent khi CHƯA xác nhận vẫn là Unsubscribed — canh thứ tự hai phép kiểm.
    expect(
      subscriberStatus({ confirmedAt: null, unsubscribedAt: '2026-09-02T08:30:00.000Z' }),
    ).toBe(l.unsubscribed);
    expect(subscriberStatus({ confirmedAt: null, unsubscribedAt: null })).toBe(
      l.awaitingConfirmation,
    );
    expect(subscriberStatus(active)).toBe(l.active);
  });
});

describe('subscribersFilterSummary', () => {
  it('tab · nguồn · từ khoá', () => {
    expect(subscribersFilterSummary({ page: 1, limit: 20, active: true })).toBe(l.active);
    expect(subscribersFilterSummary({ page: 1, limit: 20 })).toBe(l.all);
    expect(
      subscribersFilterSummary({
        page: 1,
        limit: 20,
        active: false,
        source: 'footer',
        search: 'ada',
      }),
    ).toBe([l.unsubscribed, x.source('footer'), x.search('ada')].join(' · '));
  });
});

describe('buildSubscribersWorkbook', () => {
  it('sáu cột đúng thứ tự spec §7.2', async () => {
    const sheet = await open();
    const c = x.columns;
    expect(SUBSCRIBERS_XLSX_HEADER).toEqual([
      c.email,
      c.source,
      c.status,
      c.subscribedAt,
      c.confirmedAt,
      c.unsubscribedAt,
    ]);
    expect(sheet.getCell('A1').value).toBe(c.email);
    expect(sheet.headerFooter.oddHeader).toContain(x.headerCenter(l.active));
  });

  it('nguồn nguyên văn (vắng là ô trống), trạng thái là nhãn, mốc là giờ Việt Nam', async () => {
    const sheet = await open();
    expect(sheet.getCell('B2').value).toBeNull();
    expect(sheet.getCell('C2').value).toBe(l.active);
    expect(sheet.getCell('D2').value).toEqual(new Date('2026-09-01T17:00:00.000Z'));
    expect(sheet.getCell('D2').numFmt).toBe(DATETIME_FMT);
    expect(sheet.getCell('F2').value).toBeNull();
    expect(sheet.getCell('B3').value).toBe('footer');
    expect(sheet.getCell('C3').value).toBe(l.unsubscribed);
  });

  it('đóng băng, lọc tới hàng cuối; tập rỗng vẫn có tiêu đề', async () => {
    const sheet = await open();
    expect(sheet.views[0]?.state).toBe('frozen');
    expect(sheet.autoFilter).toBe('A1:F3');
    const empty = await open([]);
    expect(empty.getCell('A2').value).toBeNull();
  });
});
