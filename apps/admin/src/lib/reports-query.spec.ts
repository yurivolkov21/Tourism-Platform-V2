import { describe, expect, it } from 'vitest';
import {
  currentMonth,
  formatMonthLabel,
  groupMonthOptions,
  monthOptions,
  parseReportsSearchParams,
  reportsExportHref,
  reportsHref,
} from './reports-query';

/**
 * Trạng thái trang `/reports` nằm TRÊN URL như mọi bảng vùng (spec P4b §2.2):
 * `?month=YYYY-MM`. "Bây giờ" luôn được TRUYỀN VÀO chứ không đọc lén từ
 * `new Date()` bên trong — nếu không, test này chỉ đúng trong đúng tháng viết
 * ra nó, và bản in sẽ đổi nội dung tuỳ đồng hồ máy chạy.
 *
 * Sàn 01/2026 (user chốt 15/09/2026): dữ liệu vận hành bắt đầu từ tháng 1/2026,
 * nên ô chọn tháng lẫn `?month=` không bao giờ trỏ một tháng trước mốc đó — kể cả
 * khi báo cáo tháng ấy chỉ toàn số 0.
 */
const NOW = new Date('2026-09-15T10:30:00.000Z');
/** Một mốc đã qua sàn hơn 12 tháng, để dải đủ 12 tháng và vắt qua mốc giao năm. */
const NOW_2027 = new Date('2027-02-10T00:00:00.000Z');

describe('currentMonth', () => {
  it('tháng UTC của một mốc', () => {
    expect(currentMonth(NOW)).toBe('2026-09');
    expect(currentMonth(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
    // 23:30 UTC ngày cuối tháng vẫn là tháng đó, dù giờ máy đã sang tháng sau.
    expect(currentMonth(new Date('2026-12-31T23:30:00.000Z'))).toBe('2026-12');
  });
});

describe('parseReportsSearchParams', () => {
  it('không có month → tháng hiện tại', () => {
    expect(parseReportsSearchParams({}, NOW)).toEqual({ month: '2026-09' });
  });

  it('month hợp lệ từ 01/2026 trở đi được giữ nguyên', () => {
    expect(parseReportsSearchParams({ month: '2026-01' }, NOW)).toEqual({ month: '2026-01' });
    expect(parseReportsSearchParams({ month: '2026-07' }, NOW)).toEqual({ month: '2026-07' });
  });

  it('month trước 01/2026 rơi về tháng hiện tại — không có báo cáo nào trước mốc dữ liệu', () => {
    for (const month of ['2025-12', '2025-10', '2024-12', '1999-01']) {
      expect(parseReportsSearchParams({ month }, NOW)).toEqual({ month: '2026-09' });
    }
  });

  it('month rác rơi về tháng hiện tại — URL là thứ người gõ', () => {
    // Hai giá trị cuối là bẫy năm của Date.UTC (vòng vá review F6): contract
    // khoá năm 1900–2099 nên ở đây chúng chỉ là "rác" như mọi rác khác.
    for (const month of [
      '2026-13',
      '2026-00',
      '2026-9',
      'September',
      '2026-09-01',
      '',
      '9999-12',
      '0050-06',
    ]) {
      expect(parseReportsSearchParams({ month }, NOW)).toEqual({ month: '2026-09' });
    }
  });

  it('param lặp lấy giá trị đầu', () => {
    expect(parseReportsSearchParams({ month: ['2026-07', '2026-08'] }, NOW)).toEqual({
      month: '2026-07',
    });
  });
});

describe('reportsHref', () => {
  it('luôn ghi month lên URL — kể cả tháng hiện tại', () => {
    // Khác `page=1` (bỏ được vì là mặc định vĩnh viễn): "tháng hiện tại" đổi
    // nghĩa mỗi đầu tháng, nên một link không ghi tháng sẽ trỏ sang báo cáo
    // KHÁC khi được mở lại tháng sau.
    expect(reportsHref('2026-09')).toBe('/reports?month=2026-09');
  });
});

describe('reportsExportHref', () => {
  it('trỏ route handler CSV của đúng tháng đang xem', () => {
    expect(reportsExportHref('2026-09')).toBe('/reports/export?month=2026-09');
  });
});

describe('formatMonthLabel', () => {
  it('YYYY-MM → tên tháng đầy đủ + năm', () => {
    expect(formatMonthLabel('2026-09')).toBe('September 2026');
    expect(formatMonthLabel('2026-01')).toBe('January 2026');
    expect(formatMonthLabel('2026-12')).toBe('December 2026');
  });
});

describe('monthOptions', () => {
  it('các tháng gần nhất, mới nhất trước, nhưng không bao giờ trước 01/2026', () => {
    const options = monthOptions(NOW);
    expect(options).toHaveLength(9);
    expect(options[0]).toEqual({ value: '2026-09', label: 'September 2026' });
    expect(options.at(-1)).toEqual({ value: '2026-01', label: 'January 2026' });
    expect(options.some((o) => o.value < '2026-01')).toBe(false);
  });

  it('đủ 12 tháng khi đã qua sàn đủ lâu', () => {
    const options = monthOptions(NOW_2027);
    expect(options).toHaveLength(12);
    expect(options[0]?.value).toBe('2027-02');
    expect(options[11]?.value).toBe('2026-03');
  });

  it('lùi qua mốc giao năm không đứt', () => {
    const options = monthOptions(NOW_2027, 4);
    expect(options.map((o) => o.value)).toEqual(['2027-02', '2027-01', '2026-12', '2026-11']);
  });

  it('chạm sàn thì dừng dù còn thiếu số tháng yêu cầu', () => {
    const options = monthOptions(new Date('2026-02-10T00:00:00.000Z'), 4);
    expect(options.map((o) => o.value)).toEqual(['2026-02', '2026-01']);
  });

  it('tháng đang xem nằm ngoài dải (từ 01/2026 trở đi) vẫn được CHÈN vào đầu danh sách', () => {
    // Không có nó thì ô select hiện một tháng khác với báo cáo đang đọc —
    // người dùng bấm link cũ và thấy hai thứ nói hai chuyện.
    const options = monthOptions(NOW_2027, 12, '2026-01');
    expect(options[0]).toEqual({ value: '2026-01', label: 'January 2026' });
    expect(options).toHaveLength(13);
  });

  it('tháng đang xem trước 01/2026 KHÔNG bao giờ được chèn vào', () => {
    const options = monthOptions(NOW, 12, '2025-10');
    expect(options.some((o) => o.value === '2025-10')).toBe(false);
    expect(options).toHaveLength(9);
  });

  it('tháng đang xem đã có trong danh sách thì không bị nhân đôi', () => {
    const options = monthOptions(NOW, 12, '2026-08');
    expect(options.filter((o) => o.value === '2026-08')).toHaveLength(1);
    expect(options).toHaveLength(9);
  });
});

describe('groupMonthOptions', () => {
  /**
   * Menu tháng của `/reports` (khuôn `dropdown-menu-10`, user chốt 03/09) chia
   * nhóm bằng separator. Trục chia là NĂM — thứ duy nhất trong một danh sách
   * tháng mà mắt cần mốc để bám.
   *
   * Gom theo ĐOẠN LIÊN TIẾP chứ không gom theo khoá: `monthOptions` chèn tháng
   * đang xem lên đầu, nên cùng một năm có thể xuất hiện ở hai đoạn rời nhau —
   * sắp xếp lại là làm hỏng thứ tự mới-nhất-trước mà danh sách vốn có.
   */
  it('cắt nhóm ở mỗi lần đổi năm, giữ nguyên thứ tự vào', () => {
    const groups = groupMonthOptions(monthOptions(NOW_2027, 12));

    expect(groups.map((g) => g.year)).toEqual(['2027', '2026']);
    expect(groups[0]?.months.map((m) => m.value)).toEqual(['2027-02', '2027-01']);
    expect(groups[1]?.months.map((m) => m.value)).toEqual([
      '2026-12',
      '2026-11',
      '2026-10',
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
    ]);
  });

  it('dải chỉ trong một năm thì chỉ một nhóm', () => {
    const groups = groupMonthOptions(monthOptions(NOW, 12));

    expect(groups.map((g) => g.year)).toEqual(['2026']);
  });

  it('cùng một năm ở hai đoạn rời nhau thì thành HAI nhóm, không gộp lại', () => {
    // Tháng đang xem `2026-01` được chèn lên đầu, nên 2026 xuất hiện cả ở đầu
    // lẫn ở cuối. Gộp chúng lại là kéo `2026-01` xuống dưới 2027 — ô chọn sẽ
    // không còn mở ra ở đúng tháng đang đọc.
    const groups = groupMonthOptions(monthOptions(NOW_2027, 12, '2026-01'));

    expect(groups.map((g) => g.year)).toEqual(['2026', '2027', '2026']);
    expect(groups[0]?.months.map((m) => m.value)).toEqual(['2026-01']);
  });

  it('khoá nhóm là duy nhất kể cả khi năm lặp lại — React cần thế', () => {
    const groups = groupMonthOptions(monthOptions(NOW_2027, 12, '2026-01'));

    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
  });

  it('danh sách rỗng thì không nhóm nào', () => {
    expect(groupMonthOptions([])).toEqual([]);
  });
});
