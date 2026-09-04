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
 */
const NOW = new Date('2026-09-15T10:30:00.000Z');

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

  it('month hợp lệ được giữ nguyên, kể cả tháng rất cũ', () => {
    expect(parseReportsSearchParams({ month: '2026-01' }, NOW)).toEqual({ month: '2026-01' });
    expect(parseReportsSearchParams({ month: '2024-12' }, NOW)).toEqual({ month: '2024-12' });
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
  it('12 tháng gần nhất, mới nhất trước, bắt đầu từ tháng hiện tại', () => {
    const options = monthOptions(NOW);
    expect(options).toHaveLength(12);
    expect(options[0]).toEqual({ value: '2026-09', label: 'September 2026' });
    expect(options[11]).toEqual({ value: '2025-10', label: 'October 2025' });
  });

  it('lùi qua mốc giao năm không đứt', () => {
    const options = monthOptions(new Date('2026-02-10T00:00:00.000Z'), 4);
    expect(options.map((o) => o.value)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
  });

  it('tháng đang xem nằm ngoài 12 tháng vẫn được CHÈN vào đầu danh sách', () => {
    // Không có nó thì ô select hiện một tháng khác với báo cáo đang đọc —
    // người dùng bấm link cũ và thấy hai thứ nói hai chuyện.
    const options = monthOptions(NOW, 12, '2024-03');
    expect(options[0]).toEqual({ value: '2024-03', label: 'March 2024' });
    expect(options).toHaveLength(13);
  });

  it('tháng đang xem đã có trong danh sách thì không bị nhân đôi', () => {
    const options = monthOptions(NOW, 12, '2026-08');
    expect(options.filter((o) => o.value === '2026-08')).toHaveLength(1);
    expect(options).toHaveLength(12);
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
    const groups = groupMonthOptions(monthOptions(NOW, 12));

    expect(groups.map((g) => g.year)).toEqual(['2026', '2025']);
    expect(groups[0]?.months.map((m) => m.value)).toEqual([
      '2026-09',
      '2026-08',
      '2026-07',
      '2026-06',
      '2026-05',
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
    ]);
    expect(groups[1]?.months.map((m) => m.value)).toEqual(['2025-12', '2025-11', '2025-10']);
  });

  it('cùng một năm ở hai đoạn rời nhau thì thành HAI nhóm, không gộp lại', () => {
    // Tháng đang xem `2025-03` được chèn lên đầu, nên 2025 xuất hiện cả ở đầu
    // lẫn ở cuối. Gộp chúng lại là kéo `2025-03` xuống dưới 2026 — ô chọn sẽ
    // không còn mở ra ở đúng tháng đang đọc.
    const groups = groupMonthOptions(monthOptions(NOW, 12, '2025-03'));

    expect(groups.map((g) => g.year)).toEqual(['2025', '2026', '2025']);
    expect(groups[0]?.months.map((m) => m.value)).toEqual(['2025-03']);
  });

  it('khoá nhóm là duy nhất kể cả khi năm lặp lại — React cần thế', () => {
    const groups = groupMonthOptions(monthOptions(NOW, 12, '2025-03'));

    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
  });

  it('danh sách rỗng thì không nhóm nào', () => {
    expect(groupMonthOptions([])).toEqual([]);
  });
});
