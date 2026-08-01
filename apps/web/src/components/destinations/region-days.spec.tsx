import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TourCardVM } from '@/lib/api/tours';
import { RegionDays } from './region-days';

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

/** Fixture tối giản — chỉ những field khu này thật sự đọc mang giá trị có nghĩa. */
function tour(slug: string, title: string, durationDays: number): TourCardVM {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }],
    category: { slug: 'trekking', name: 'Trekking' },
    ratingAvg: null,
    ratingCount: 0,
  };
}

/** Hình dạng THẬT của miền Bắc (đo 30/07): chuyến riêng 1, 2, 2, 3, 8 ngày. Hai
    chuyến cùng 2 ngày là một ca có thật, không phải fixture bịa cho đẹp. */
const NORTH = [
  tour('ninh-binh-river-caves', 'Ninh Binh River Caves', 1),
  tour('ha-long-bay-cruise', 'Ha Long Bay Cruise', 2),
  tour('sa-pa-homestay-weekend', 'Sa Pa Homestay Weekend', 2),
  tour('sa-pa-terraces-trek', 'Sa Pa Terraces Trek', 3),
  tour('northern-highlands-loop', 'Northern Highlands Loop', 8),
];

function brackets(container: HTMLElement) {
  return [...container.querySelectorAll('[data-bracket]')];
}

function bracket(container: HTMLElement, name: string) {
  return container.querySelector(`[data-bracket="${name}"]`);
}

describe('RegionDays', () => {
  it('dựng ba nhóm theo thời lượng, thứ tự ngắn → dài', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    expect(brackets(container).map((el) => el.getAttribute('data-bracket'))).toEqual([
      'short',
      'weekend',
      'long',
    ]);
  });

  it('xếp mỗi chuyến vào ĐÚNG nhóm — 1 ngày · 2–3 ngày · từ 4 ngày', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    expect(bracket(container, 'short')?.textContent).toContain('Ninh Binh River Caves');
    expect(bracket(container, 'weekend')?.textContent).toContain('Ha Long Bay Cruise');
    expect(bracket(container, 'weekend')?.textContent).toContain('Sa Pa Terraces Trek');
    expect(bracket(container, 'long')?.textContent).toContain('Northern Highlands Loop');
    expect(bracket(container, 'short')?.textContent).not.toContain('Northern Highlands Loop');
  });

  // Hai chuyến CÙNG 2 ngày là ca thật của miền Bắc. Gom theo `durationDays` làm
  // khoá (thay vì theo nhóm) sẽ nuốt mất một chuyến im lặng.
  it('hai chuyến cùng số ngày đều được liệt kê, không nuốt mất chuyến nào', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    const weekend = bracket(container, 'weekend');
    expect(weekend?.textContent).toContain('Ha Long Bay Cruise');
    expect(weekend?.textContent).toContain('Sa Pa Homestay Weekend');
    expect(weekend?.querySelectorAll('a')).toHaveLength(3);
  });

  it('mỗi tên chuyến là link sang trang tour CÓ THẬT', () => {
    render(<RegionDays tours={NORTH} />);
    expect(screen.getByRole('link', { name: 'Northern Highlands Loop' })).toHaveAttribute(
      'href',
      '/tours/northern-highlands-loop',
    );
  });

  it('in số chuyến của từng nhóm, số ÍT thì dùng dạng số ít', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    expect(bracket(container, 'short')?.textContent).toContain('1 trip');
    expect(bracket(container, 'weekend')?.textContent).toContain('3 trips');
  });

  // Nhóm rỗng phải BỎ HẲN thẻ. In "0 trips" là một ô trống nói rằng vùng này
  // không có gì cho bạn — và đó là cái ô người đọc nhìn kỹ nhất.
  it('nhóm rỗng thì BỎ HẲN thẻ, không in "0 trips"', () => {
    // Một chuyến 1 ngày và một chuyến 8 ngày: nhóm giữa (2–3 ngày) rỗng.
    const gap = [NORTH[0] as TourCardVM, NORTH[4] as TourCardVM];
    const { container } = render(<RegionDays tours={gap} />);
    expect(brackets(container).map((el) => el.getAttribute('data-bracket'))).toEqual([
      'short',
      'long',
    ]);
    expect(container.textContent).not.toContain('0 trips');
  });

  it('mảng rỗng thì BỎ HẲN khu', () => {
    const { container } = render(<RegionDays tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Nhóm đầu bắt `<= 1`, không phải `=== 1`: `durationDays` 0 là dữ liệu hỏng có
  // thể tới từ API, và ba điều kiện rời nhau sẽ để nó rơi ra ngoài CẢ BA nhóm —
  // chuyến tàng hình, không có gì báo.
  it('chuyến 0 ngày (dữ liệu hỏng) vẫn vào nhóm đầu chứ không tàng hình', () => {
    const { container } = render(
      <RegionDays tours={[tour('broken', 'Broken Duration Trip', 0), ...NORTH.slice(3)]} />,
    );
    expect(bracket(container, 'short')?.textContent).toContain('Broken Duration Trip');
  });

  // Bốn chuyến một ngày (hình dạng miền Trung) chỉ dựng nổi MỘT nhóm — khu này
  // hứa "một buổi sáng, một cuối tuần, hay một tuần", nên một nhóm là lời hứa
  // trống. Đó cũng là lý do khu này là khu RIÊNG của miền Bắc.
  it('chỉ dựng nổi một nhóm thì BỎ HẲN khu', () => {
    const central = [
      tour('hoi-an-lantern-evening', 'Hoi An Lantern Evening', 1),
      tour('hue-imperial-day', 'Hue Imperial Day', 1),
      tour('da-nang-coast-ride', 'Da Nang Coast Ride', 1),
      tour('hoi-an-cooking-market', 'Hoi An Market and Kitchen', 1),
    ];
    const { container } = render(<RegionDays tours={central} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Ba vòng thiết kế trước bị bác vì khu đọc ra như dashboard. Không trục, không
  // thanh tỉ lệ, không mốc số — thẻ này chỉ có chữ và link.
  it('KHÔNG vẽ thanh tỉ lệ hay trục nào — không phải biểu đồ', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    expect(container.querySelector('[role="meter"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.getAttribute('style')).not.toMatch(/width|height/);
    }
  });

  /**
   * ── Hợp đồng SỐ DÒNG (Task 5o) ──
   *
   * Câu mô tả nhóm là phần tử DUY NHẤT của thẻ có số dòng đổi theo bề ngang, và ngay
   * dưới nó là một `border-t` — tức lệch một dòng ở đây là hai thẻ cạnh nhau có VẠCH
   * NGANG ở hai độ cao khác nhau, thứ đọc ra ngay bằng mắt. Đo ở 768 (hai thẻ một
   * hàng) trước khi vá: "Out after breakfast, back before dark." chiếm 1 dòng trong
   * khi thẻ bên cạnh chiếm 2, và danh sách chuyến tụt **24px**.
   *
   * ⚠️ Chỉ GIỮ CHỖ (`min-h`), **không** `line-clamp`: đây là một câu biên tập ngắn
   * trong hộp rộng gấp đôi thẻ chuyến-một-ngày, nên không có gì để cắt — mà kẹp dòng
   * ở đây thì một bản dịch dài hơn sẽ bị mất chữ, đổi một lỗi hình thành một lỗi nội
   * dung. (Thẻ chuyến-một-ngày thì clamp là ĐÚNG: hộp hẹp 233px và tiêu đề tour tới
   * từ API nên độ dài không có trần.)
   */
  it('câu mô tả nhóm giữ chỗ ĐÚNG hai dòng — vạch dưới nó không so le', () => {
    const { container } = render(<RegionDays tours={NORTH} />);
    const bodies = [...container.querySelectorAll('[data-bracket] [data-bracket-body]')];
    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body.className).toContain('min-h-[2lh]');
      expect(body.className).not.toContain('line-clamp');
    }
  });
});
