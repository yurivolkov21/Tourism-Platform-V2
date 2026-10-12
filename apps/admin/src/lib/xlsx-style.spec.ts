import { messages } from '@tourism/i18n';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  addSheet,
  BRAND,
  calendarDate,
  cellText,
  DATE_FMT,
  DATETIME_FMT,
  dateTime,
  headerText,
  MONEY_FMT,
  money,
  printFrame,
  subtotalRow,
  sumMoney,
  vietnamDateTime,
} from './xlsx-style';

const f = messages.admin.exportFile;
const AT = '2026-09-30T12:00:00.000Z';

async function reload(book: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(await book.xlsx.writeBuffer());
  return copy;
}

describe('định dạng (spec G40 §6.1, ADR-0034 AMEND 3)', () => {
  it('ngày ép tiếng Anh bằng [$-409] — máy vi-VN không ra "Thg10"', () => {
    expect(DATE_FMT).toBe('[$-409]d mmm yyyy');
    expect(DATETIME_FMT).toBe('[$-409]d mmm yyyy hh:mm');
  });

  it('tiền âm trong ngoặc, không tô đỏ (bản thảo D1)', () => {
    expect(MONEY_FMT).toBe('#,##0.00;(#,##0.00)');
  });
});

describe('ngày và giờ', () => {
  it('mốc ISO → ô ngày-giờ hiện đúng giờ Việt Nam (UTC+7, không giờ mùa hè)', () => {
    expect(vietnamDateTime('2026-10-09T17:30:00.000Z').toISOString()).toBe(
      '2026-10-10T00:30:00.000Z',
    );
  });

  it('ngày lịch → nửa đêm UTC, không trôi theo giờ máy', () => {
    expect(calendarDate('2026-11-03').toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  // Review max G40 Phần 3: Excel làm tròn tới GIÂY gần nhất rồi mới áp hh:mm, nên phần nghìn giây
  // đẩy 23:59:59.999 thành 00:00 ngày hôm sau; màn admin cắt bỏ, không làm tròn.
  it('dateTime ghi giờ Việt Nam bỏ phần nghìn giây; mốc vắng là ô trống', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('x');
    dateTime(sheet.getCell('A1'), '2026-07-18T16:59:59.999Z');
    dateTime(sheet.getCell('A2'), null);
    expect((sheet.getCell('A1').value as Date).toISOString()).toBe('2026-07-18T23:59:59.000Z');
    expect(sheet.getCell('A1').numFmt).toBe(DATETIME_FMT);
    expect(sheet.getCell('A2').value).toBeNull();
  });
});

// Review max G40 Phần 3: chữ khách hay người lạ nhập đi thẳng vào ô.
describe('cellText — chữ người dùng nhập', () => {
  it('bỏ ký tự XML cấm (U+FFFE, U+FFFF, surrogate lẻ, điều khiển C0) — một ký tự là hỏng cả file', () => {
    expect(cellText('Nora\uFFFFDahl\uFFFE')).toBe('NoraDahl');
    expect(cellText('a\uD800b')).toBe('ab');
    expect(cellText('a\u0001b\u001Fc')).toBe('abc');
  });

  it('giữ chữ Việt, emoji và xuống dòng', () => {
    expect(cellText('Hội An 🏮\nline')).toBe('Hội An 🏮\nline');
  });

  // Lưu file thành CSV (ADR-0034 AMEND 3 bảo ai cần CSV thì Save As) rồi mở lại là Excel chạy công
  // thức trong chữ — ô `.xlsx` thì an toàn, chuyến đi vòng qua CSV thì không.
  it('chữ mở đầu bằng = + - @ hay tab thành chữ có dấu nháy, không thành công thức khi qua CSV', () => {
    expect(cellText('=1+2')).toBe("'=1+2");
    expect(cellText('+HYPERLINK("x")')).toBe('\'+HYPERLINK("x")');
    expect(cellText('-cmd')).toBe("'-cmd");
    expect(cellText('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(cellText('\t=1')).toBe("'\t=1");
  });

  it('số điện thoại và số thường giữ nguyên — không có hàm nào để chạy', () => {
    expect(cellText('+84 24 3826 0126')).toBe('+84 24 3826 0126');
    expect(cellText('-5')).toBe('-5');
    expect(cellText('(024) 3826-0126')).toBe('(024) 3826-0126');
  });
});

describe('tiền', () => {
  it('money ghi SỐ kèm định dạng; negate đổi dấu dòng chi phí; 0 không thành -0', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('x');
    money(sheet.getCell('A1'), '210.50', { negate: true });
    money(sheet.getCell('A2'), '0.00', { negate: true });
    money(sheet.getCell('A3'), '-186.36');
    expect(sheet.getCell('A1').value).toBe(-210.5);
    expect(Object.is(sheet.getCell('A2').value, -0)).toBe(false);
    expect(sheet.getCell('A3').value).toBe(-186.36);
    expect(sheet.getCell('A1').numFmt).toBe(MONEY_FMT);
  });

  it('sumMoney cộng theo xu — 0.10 + 0.20 ra đúng 0.3, không 0.30000000000000004', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe(0.3);
    expect(sumMoney([])).toBe(0);
  });

  it('sumMoney đổi xu bằng toCents của contract — làm tròn HALF_UP như server', () => {
    expect(sumMoney(['1.005'])).toBe(1.01);
  });
});

describe('đầu và chân trang khi in (spec §6.1)', () => {
  it('ba ô đầu trang; chân trang giờ tạo (UTC) và số trang', () => {
    const frame = printFrame('Monthly report · September 2026', AT);
    expect(frame.oddHeader).toBe(
      `&L&"Calibri,Bold"${f.backOffice}&C&"Calibri,Regular"Monthly report · September 2026&R&"Calibri,Regular"${f.internal}`,
    );
    expect(frame.oddFooter).toBe(
      `&L&"Calibri,Regular"${f.generated('30 Sep 2026, 12:00 UTC')}&R&"Calibri,Regular"${f.pageOf}`,
    );
  });

  it('dấu & trong chữ được nhân đôi — & là mã điều khiển của Excel', () => {
    expect(headerText('Old Town & Lanterns')).toBe('Old Town && Lanterns');
    expect(printFrame('A & B', AT).oddHeader).toContain('A && B');
  });

  it('phần giữa dài quá 100 ký tự thì cắt kèm dấu …', () => {
    const header = printFrame('x'.repeat(150), AT).oddHeader ?? '';
    expect(header).toContain(`${'x'.repeat(99)}…`);
    expect(header).not.toContain('x'.repeat(100));
  });

  // Review max G40 Phần 3: cắt TRƯỚC khi nhân đôi & thì 120 dấu & thành đầu trang 286 ký tự — Excel
  // không mở file có đầu trang quá 255 ký tự.
  it('đầu trang luôn ≤ 255 ký tự sau khi nhân đôi &, không để lẻ một dấu & ở chỗ cắt', () => {
    const header = printFrame('&'.repeat(120), AT).oddHeader ?? '';
    expect(header.length).toBeLessThanOrEqual(255);
    const middle = header.split('&C&"Calibri,Regular"')[1]?.split('&R')[0] ?? '';
    expect(middle.replace('…', '').length % 2).toBe(0);
  });
});

describe('addSheet — khung trang chung', () => {
  it('A4, vừa một trang ngang, căn giữa, lề 0.5″ / 0.8″, tab màu, lưới theo cờ — đọc lại từ file', async () => {
    const book = new ExcelJS.Workbook();
    addSheet(book, 'S', { tab: BRAND, grid: false, frame: printFrame('X', AT) });
    const sheet = (await reload(book)).getWorksheet('S');
    expect(sheet?.pageSetup.paperSize).toBe(9);
    expect(sheet?.pageSetup.fitToWidth).toBe(1);
    expect(sheet?.pageSetup.horizontalCentered).toBe(true);
    expect(sheet?.pageSetup.margins).toMatchObject({
      left: 0.5,
      right: 0.5,
      top: 0.8,
      bottom: 0.8,
    });
    expect(sheet?.properties.tabColor).toEqual({ argb: BRAND });
    expect(sheet?.views[0]?.showGridLines).toBe(false);
    expect(sheet?.headerFooter.oddFooter).toContain(f.pageOf);
  });
});

describe('subtotalRow', () => {
  it('SUBTOTAL(109, …) trên đúng vùng dữ liệu, kèm giá trị đệm; bảng trống thì không có hàng tổng', () => {
    const sheet = new ExcelJS.Workbook().addWorksheet('x');
    subtotalRow(sheet, 'Total', { first: 2, last: 4 }, 3, [
      { column: 2, result: 12, numFmt: '#,##0' },
    ]);
    expect(sheet.getCell('A5').value).toBe('Total');
    expect(sheet.getCell('B5').value).toEqual({ formula: 'SUBTOTAL(109,B2:B4)', result: 12 });
    const empty = new ExcelJS.Workbook().addWorksheet('y');
    subtotalRow(empty, 'Total', { first: 2, last: 1 }, 3, [
      { column: 2, result: 0, numFmt: '#,##0' },
    ]);
    expect(empty.getCell('A2').value).toBeNull();
  });
});
