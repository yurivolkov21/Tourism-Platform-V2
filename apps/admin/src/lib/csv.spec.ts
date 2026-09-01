import { describe, expect, it } from 'vitest';
import { CSV_BOM, csvDocument, csvFilename, escapeCsvValue, isoDay, toCsv } from './csv';

/**
 * Dựng CSV (spec P4b §3-F6) — đường 0-dependency: không thư viện xlsx/PDF nào
 * được thêm (freeze 15/10), nên phần escape phải tự đứng vững. Đây là code
 * sinh ra FILE mà người khác mở bằng Excel, nên hai lớp nguy hiểm đều có test:
 * ký tự phá cấu trúc (dấu phẩy/nháy/xuống dòng) và CSV injection.
 */
describe('escapeCsvValue', () => {
  it('giá trị thường đi qua nguyên vẹn, không bọc nháy thừa', () => {
    expect(escapeCsvValue('BK-7Q2M9XKD')).toBe('BK-7Q2M9XKD');
    expect(escapeCsvValue('117.00')).toBe('117.00');
    expect(escapeCsvValue('')).toBe('');
  });

  it('dấu phẩy trong tên khách được bọc nháy', () => {
    expect(escapeCsvValue('Nguyen, Alice')).toBe('"Nguyen, Alice"');
  });

  it('nháy kép được nhân đôi rồi bọc — luật RFC 4180', () => {
    expect(escapeCsvValue('Alice "Ada" Nguyen')).toBe('"Alice ""Ada"" Nguyen"');
  });

  it('xuống dòng (LF và CRLF) được bọc nháy chứ không làm vỡ hàng', () => {
    expect(escapeCsvValue('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsvValue('line one\r\nline two')).toBe('"line one\r\nline two"');
  });

  it('CSV injection: = + - @ ở ĐẦU giá trị bị vô hiệu bằng tiền tố nháy đơn', () => {
    // Excel/Sheets coi những ký tự này là mở đầu công thức; một tên khách
    // "=HYPERLINK(...)" là code chạy trên máy người mở file.
    expect(escapeCsvValue('=1+1')).toBe("'=1+1");
    expect(escapeCsvValue('+1 555 0100')).toBe("'+1 555 0100");
    expect(escapeCsvValue('-30.00')).toBe("'-30.00");
    expect(escapeCsvValue('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    // Tab/CR mở đầu cũng là véc-tơ tiêm quen thuộc (Excel bỏ qua rồi đọc tiếp).
    expect(escapeCsvValue('\t=1+1')).toBe("'\t=1+1");
  });

  it('injection ĐI CÙNG dấu phẩy: vô hiệu hoá TRƯỚC rồi mới bọc', () => {
    expect(escapeCsvValue('=cmd|, evil')).toBe('"\'=cmd|, evil"');
  });

  it('ký tự nguy hiểm nằm GIỮA giá trị không bị đụng tới', () => {
    expect(escapeCsvValue('BK-2026=07')).toBe('BK-2026=07');
    expect(escapeCsvValue('a+b')).toBe('a+b');
  });
});

describe('toCsv', () => {
  it('ghép hàng bằng CRLF và kết thúc bằng một CRLF', () => {
    expect(
      toCsv([
        ['Code', 'Amount'],
        ['BK-1', '10.00'],
      ]),
    ).toBe('Code,Amount\r\nBK-1,10.00\r\n');
  });

  it('escape từng ô — header cũng không được miễn', () => {
    expect(toCsv([['Customer, full name'], ['Nguyen, Alice']])).toBe(
      '"Customer, full name"\r\n"Nguyen, Alice"\r\n',
    );
  });

  it('không có dòng dữ liệu nào thì chỉ còn header — file rỗng vẫn mở được', () => {
    expect(toCsv([['Code', 'Amount']])).toBe('Code,Amount\r\n');
  });

  it('ô rỗng vẫn giữ chỗ của cột', () => {
    expect(
      toCsv([
        ['a', 'b', 'c'],
        ['1', '', '3'],
      ]),
    ).toBe('a,b,c\r\n1,,3\r\n');
  });
});

describe('csvDocument', () => {
  // Khoá theo CODEPOINT, không theo chính hằng `CSV_BOM` (review F6): so hai
  // vế cùng dùng hằng đó thì test vẫn xanh kể cả khi nó thành chuỗi rỗng —
  // mà U+FEFF là ký tự VÔ HÌNH trong source, đúng thứ một lần đổi encoding
  // hay một công cụ strip-BOM có thể nuốt mà không ai thấy.
  it('CSV_BOM đúng là U+FEFF, một ký tự', () => {
    expect([...CSV_BOM]).toHaveLength(1);
    expect(CSV_BOM.codePointAt(0)).toBe(0xfeff);
  });

  it('mở đầu bằng BOM UTF-8 — không có nó Excel đọc "Hội An" thành ký tự rác', () => {
    const doc = csvDocument([['Tour'], ['Hội An']]);
    expect(doc.codePointAt(0)).toBe(0xfeff);
    expect(doc).toBe(`\uFEFFTour\r\nHội An\r\n`);
  });

  it('ba byte EF BB BF thật sự nằm ở đầu file khi đi qua UTF-8', () => {
    // Đây mới là thứ Excel đọc: byte trên đĩa, không phải ký tự trong JS.
    const bytes = new TextEncoder().encode(csvDocument([['Tour']]));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe('isoDay', () => {
  it('ngày UTC của một mốc — cùng thước với ngày mà API lọc', () => {
    expect(isoDay(new Date('2026-09-01T23:30:00.000Z'))).toBe('2026-09-01');
    // Cùng khoảnh khắc ấy đã là 02/09 ở giờ máy UTC+7; báo cáo vẫn nói 01/09.
    expect(isoDay(new Date('2026-12-31T00:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('csvFilename', () => {
  it('tên + ngày xuất + đuôi .csv', () => {
    expect(csvFilename('nexora-bookings', '2026-09-01')).toBe('nexora-bookings-2026-09-01.csv');
  });

  it('làm sạch tên: chỉ chữ/số/gạch sống sót — tên file đi vào header HTTP', () => {
    // Content-Disposition bị chèn nháy/xuống dòng là một lỗ header injection;
    // mọi ký tự ngoài [a-z0-9] thành gạch nối, gạch thừa hai đầu bị cắt.
    expect(csvFilename('book"ings\r\n', '2026-09-01')).toBe('book-ings-2026-09-01.csv');
    expect(csvFilename('report 2026/09', '2026-09-01')).toBe('report-2026-09-2026-09-01.csv');
    expect(csvFilename('Nexora Bookings', '2026-09-01')).toBe('nexora-bookings-2026-09-01.csv');
  });
});
