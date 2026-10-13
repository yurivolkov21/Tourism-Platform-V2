import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { formatCalendarDate, formatDateRange } from './bookings-view';
import type { SubscribersQuery } from './subscribers-query';
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

async function open(
  rows: readonly SubscriberRow[] = [active, left],
  query: SubscribersQuery = { page: 1, limit: 20, active: true },
  selected = 0,
): Promise<ExcelJS.Worksheet> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await buildSubscribersWorkbook(rows, {
      query,
      selected,
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
  // Tab Active gồm cả địa chỉ chưa xác nhận, còn cột Status chỉ gọi "Active" địa chỉ đã xác nhận —
  // đầu trang không được dùng cùng một chữ cho hai tập (review max G40 Phần 3).
  it('tab · nguồn · từ khoá; tab Active nói rõ gồm cả chưa xác nhận', () => {
    expect(subscribersFilterSummary({ page: 1, limit: 20, active: true }, 0)).toBe(x.activeTab);
    expect(subscribersFilterSummary({ page: 1, limit: 20 }, 0)).toBe(l.all);
    expect(
      subscribersFilterSummary(
        {
          page: 1,
          limit: 20,
          active: false,
          source: 'footer',
          search: 'ada',
        },
        0,
      ),
    ).toBe([l.unsubscribed, x.source('footer'), x.search('ada')].join(' · '));
  });

  it('G43: khoảng ngày đứng ngay sau tab và nói rõ là ngày UTC — ba hình dạng khoảng', () => {
    expect(
      subscribersFilterSummary(
        { page: 1, limit: 20, active: true, from: '2026-09-01', to: '2026-09-30' },
        0,
      ),
    ).toBe([x.activeTab, x.utcDates(formatDateRange('2026-09-01', '2026-09-30'))].join(' · '));
    expect(subscribersFilterSummary({ page: 1, limit: 20, from: '2026-09-01' }, 0)).toBe(
      [l.all, x.utcDates(x.dateFrom(formatCalendarDate('2026-09-01')))].join(' · '),
    );
    expect(
      subscribersFilterSummary({ page: 1, limit: 20, active: false, to: '2026-09-30' }, 0),
    ).toBe([l.unsubscribed, x.utcDates(x.dateUntil(formatCalendarDate('2026-09-30')))].join(' · '));
  });

  it('G43: số hàng chọn đứng TRƯỚC nguồn và từ khoá — hai phần chữ tự do, dài thì bị cắt khi in', () => {
    expect(
      subscribersFilterSummary(
        { page: 1, limit: 20, active: true, source: 'footer', search: 'ada' },
        3,
      ),
    ).toBe([x.activeTab, x.selected(3), x.source('footer'), x.search('ada')].join(' · '));
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
    expect(sheet.headerFooter.oddHeader).toContain(x.headerCenter(x.activeTab));
  });

  // Spec §7.2: cùng kiểu sheet với bookings — khổ ngang, không thu nhỏ còn ~70% khi in.
  it('G43: đầu trang khi in giữ khoảng ngày và số hàng chọn dù nguồn và từ khoá chạm trần', async () => {
    const sheet = await open(
      [active],
      {
        page: 1,
        limit: 20,
        active: true,
        from: '2026-09-01',
        to: '2026-09-30',
        source: 's'.repeat(40),
        search: 'q'.repeat(120),
      },
      1,
    );
    const header = sheet.headerFooter.oddHeader ?? '';
    expect(header).toContain(x.utcDates(formatDateRange('2026-09-01', '2026-09-30')));
    expect(header).toContain(x.selected(1));
  });

  it('khổ ngang như file bookings', async () => {
    const sheet = await open();
    expect(sheet.pageSetup.orientation).toBe('landscape');
  });

  it('nguồn đăng ký là chữ người lạ nhập: bỏ ký tự XML cấm, chữ mở đầu như công thức có dấu nháy', async () => {
    const sheet = await open([
      { ...active, source: `ads${String.fromCharCode(0xffff)}` },
      { ...left, source: '=1+2' },
    ]);
    expect(sheet.getCell('B2').value).toBe('ads');
    expect(sheet.getCell('B3').value).toBe(`'=1+2`);
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
