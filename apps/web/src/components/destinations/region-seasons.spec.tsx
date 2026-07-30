import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RegionSeasons } from './region-seasons';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu API này là ném ReferenceError lúc
  // mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù vài spec khác có bản y
  // hệt: đã đo — dời lên setup chung làm **19 test ở 3 file khác gãy**, vì có
  // global này thì framer-motion đi nhánh khác hẳn so với khi không có.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const PROPS = {
  regionName: 'Northern Vietnam',
  months: [3, 4, 5, 9, 10, 11],
  note: 'Cool, dry and clear.',
};

describe('RegionSeasons', () => {
  // ⚠️ Dải 12 ô đã BỎ (Task 5k). Nó là một đồ thị thu nhỏ — 12 ô có mốc số, tô màu
  // theo dữ liệu — tức cùng họ lỗi với khu phổ mà user bác thẳng: *"đây là trang
  // giao diện web cho người dùng xem chứ đâu phải dashboard báo cáo dành cho
  // admin"*. Test này canh để không ai dựng lại nó.
  it('KHÔNG còn dải 12 ô tháng nào', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(0);
    expect(container.querySelector('ol')).toBeNull();
  });

  it('gom tháng đẹp thành KHOẢNG và nói bằng chữ', () => {
    render(<RegionSeasons {...PROPS} />);
    expect(
      screen.getByText('Plan for Mar–May and Sep–Nov if you can choose your dates.'),
    ).toBeInTheDocument();
  });

  it('mảng KHÔNG sắp sẵn vẫn ra đúng hai khoảng', () => {
    render(<RegionSeasons {...PROPS} months={[11, 3, 10, 4, 9, 5]} />);
    expect(
      screen.getByText('Plan for Mar–May and Sep–Nov if you can choose your dates.'),
    ).toBeInTheDocument();
  });

  // Miền Nam là `[12, 1, 2, 3, 4]` — VẮT QUA NĂM. Đọc như hai khoảng rời ('Dec' và
  // 'Jan–Apr') là nói sai về một mùa khô liền mạch năm tháng.
  it('mùa vắt qua năm nối thành MỘT khoảng', () => {
    render(<RegionSeasons {...PROPS} months={[12, 1, 2, 3, 4]} />);
    expect(screen.getByText('Plan for Dec–Apr if you can choose your dates.')).toBeInTheDocument();
  });

  it('một dải liền dài ra MỘT khoảng', () => {
    render(<RegionSeasons {...PROPS} months={[2, 3, 4, 5, 6, 7, 8]} />);
    expect(screen.getByText('Plan for Feb–Aug if you can choose your dates.')).toBeInTheDocument();
  });

  // Một tháng đơn lẻ phải in 'Jul', không phải 'Jul–Jul'.
  it('tháng đơn lẻ in một tên, không in khoảng rỗng', () => {
    render(<RegionSeasons {...PROPS} months={[7]} />);
    expect(screen.getByText('Plan for Jul if you can choose your dates.')).toBeInTheDocument();
  });

  it('ba khoảng rời nối bằng dấu phẩy và "and"', () => {
    render(<RegionSeasons {...PROPS} months={[1, 5, 6, 10]} />);
    expect(
      screen.getByText('Plan for Jan, May–Jun, and Oct if you can choose your dates.'),
    ).toBeInTheDocument();
  });

  // Vùng đẹp quanh năm là dữ liệu hợp lệ (nhiệt đới, không mùa mưa rõ rệt). Không
  // có tháng nào "bắt đầu" một khoảng khi cả 12 tháng đều đẹp — nhánh riêng.
  it('đẹp cả 12 tháng ra đúng một khoảng Jan–Dec', () => {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    render(<RegionSeasons {...PROPS} months={all} />);
    expect(screen.getByText('Plan for Jan–Dec if you can choose your dates.')).toBeInTheDocument();
  });

  it('in ghi chú thời tiết', () => {
    render(<RegionSeasons {...PROPS} />);
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  it('không tháng nào thì bỏ câu tháng đẹp, vẫn giữ ghi chú', () => {
    render(<RegionSeasons {...PROPS} months={[]} />);
    expect(screen.queryByText(/Plan for/)).not.toBeInTheDocument();
    expect(screen.queryByText('Best months')).not.toBeInTheDocument();
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  // Số tháng ngoài 1–12 là dữ liệu hỏng. Lọc trước khi gom, nếu không 'Invalid
  // Date' hoặc một tên tháng quấn vòng sẽ lọt ra câu chữ.
  it('số tháng ngoài dải 1–12 bị bỏ như khi không có tháng nào', () => {
    render(<RegionSeasons {...PROPS} months={[0, 13, 99]} />);
    expect(screen.queryByText(/Plan for/)).not.toBeInTheDocument();
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  it('lọc số hỏng nhưng GIỮ số hợp lệ trong cùng mảng', () => {
    render(<RegionSeasons {...PROPS} months={[0, 3, 4, 5, 99]} />);
    expect(screen.getByText('Plan for Mar–May if you can choose your dates.')).toBeInTheDocument();
  });

  it('tiêu đề nêu tên vùng', () => {
    render(<RegionSeasons {...PROPS} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'When to visit Northern Vietnam' }),
    ).toBeInTheDocument();
  });

  // ⚠️ Khu này là khu CUỐI của trang miền Bắc. `site-footer.tsx` mang `mt-32` sơn
  // màu `--background`; khu cuối có nền RIÊNG thì 128px đó hiện ra thành một vạch
  // sáng kẹp giữa khu này và footer. Cơ chế `data-flush-footer` từng vá chuyện đó
  // đã xoá (Task 5k) đúng vì cả ba miền giờ kết bằng khu nền-trang.
  it('dùng NỀN TRANG, không nền băng riêng — nó là khu cuối trang', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    expect(container.querySelector('section')?.hasAttribute('style')).toBe(false);
  });

  it('KHÔNG vẽ trục, thanh tỉ lệ hay ô tô theo dữ liệu', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    expect(container.querySelector('[role="meter"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.getAttribute('style')).not.toMatch(/width|height/);
    }
  });
});
