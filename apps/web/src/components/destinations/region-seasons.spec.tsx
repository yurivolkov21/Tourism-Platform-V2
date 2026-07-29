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
  it('vẽ ĐỦ 12 ô tháng, không chỉ các tháng đẹp', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(12);
  });

  it('đánh dấu ĐÚNG các tháng đẹp, không thừa không thiếu', () => {
    const { container } = render(<RegionSeasons {...PROPS} />);
    const best = [...container.querySelectorAll('[data-month][data-best="true"]')].map((el) =>
      Number(el.getAttribute('data-month')),
    );
    expect(best).toEqual([3, 4, 5, 9, 10, 11]);
  });

  // Tháng 12 quấn qua tháng 1 ở miền Nam — dải phải đánh dấu cả hai đầu,
  // không được coi [12,1,2,3,4] là một khoảng liên tục rồi tô nhầm 5..11.
  it('mùa vắt qua năm (12→4) đánh dấu đúng hai đầu dải', () => {
    const { container } = render(<RegionSeasons {...PROPS} months={[12, 1, 2, 3, 4]} />);
    const best = [...container.querySelectorAll('[data-month][data-best="true"]')].map((el) =>
      Number(el.getAttribute('data-month')),
    );
    expect(best).toEqual([1, 2, 3, 4, 12]);
  });

  it('in ghi chú thời tiết', () => {
    render(<RegionSeasons {...PROPS} />);
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  // Vùng đẹp quanh năm là dữ liệu hợp lệ (nhiệt đới, không mùa mưa rõ rệt).
  // Khi đó nhãn "Shoulder & wet months" không được đứng một mình với danh sách
  // rỗng — nó sẽ đọc thành một lời khuyên cụt.
  it('đẹp cả 12 tháng thì BỎ mục chú giải "tháng còn lại", không để nhãn trống', () => {
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    const { container } = render(<RegionSeasons {...PROPS} months={all} />);
    expect(container.querySelectorAll('[data-month][data-best="true"]')).toHaveLength(12);
    expect(screen.getByText('Best months')).toBeInTheDocument();
    expect(screen.queryByText('Shoulder & wet months')).not.toBeInTheDocument();
  });

  it('không tháng nào thì BỎ HẲN dải, vẫn giữ ghi chú', () => {
    const { container } = render(<RegionSeasons {...PROPS} months={[]} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(0);
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });

  // Số tháng ngoài 1–12 là dữ liệu hỏng. Điều kiện bỏ dải phải hỏi "có ô nào
  // được tô không", không phải "mảng có phần tử nào không" — nếu không, dải hiện
  // ra xám trơn kèm nhãn "Best months" trống rỗng.
  it('số tháng ngoài dải 1–12 thì bỏ dải như khi không có tháng nào', () => {
    const { container } = render(<RegionSeasons {...PROPS} months={[0, 13, 99]} />);
    expect(container.querySelectorAll('[data-month]')).toHaveLength(0);
    expect(screen.queryByText('Best months')).not.toBeInTheDocument();
    expect(screen.getByText('Cool, dry and clear.')).toBeInTheDocument();
  });
});
