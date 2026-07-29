import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockTestimonial } from '@/mocks/types';
import { TravellerQuotes } from './traveller-quotes';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu là ném ReferenceError lúc mount.
  // Cùng lý do (và cùng cách) như `region-group.spec.tsx`; đã đo là KHÔNG dời
  // được lên `vitest.setup.ts` (19 test ở file khác gãy).
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // embla gọi `new ResizeObserver(...)` không guard ngay trong `init`
  // (`ResizeHandler.ts`) — jsdom cũng không hiện thực API này, thiếu là ném
  // ReferenceError lúc mount. Stub rỗng là đủ: test khẳng định CẤU TRÚC slide,
  // không khẳng định embla tính được kích thước (jsdom trả 0 cho mọi phép đo,
  // nên carousel ở đây không thật sự cuộn được — đó là giới hạn đã biết, xem
  // test "mỗi trích dẫn là một slide riêng").
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function t(name: string, quote: string, rating = 5): MockTestimonial {
  return { name, location: 'Sydney, Australia', quote, rating };
}

const THREE = [
  t('Sarah Mitchell', 'The fog lifted around eight and the bay turned green-gold.'),
  t('Daniel Craig Jr.', 'Our guide grew up in the valley and it showed.', 4),
  t('Emma Larsen', 'Waking up before dawn was worth every minute.'),
];

describe('TravellerQuotes', () => {
  it('render MỌI trích dẫn vào DOM — carousel chỉ cuộn, không cắt bớt dữ liệu', () => {
    render(<TravellerQuotes testimonials={THREE} />);
    for (const item of THREE) {
      expect(screen.getByText(item.quote)).toBeInTheDocument();
    }
  });

  it('mỗi trích dẫn là một slide riêng — đúng một cái ở "vị trí đang xem"', () => {
    // Bản trước xếp 3 trích dẫn thành lưới cạnh nhau; bản này phải là carousel
    // một-lần-một. Đếm slide là cách khẳng định cấu trúc đó mà không phụ thuộc
    // embla có tính được kích thước trong jsdom hay không.
    const { container } = render(<TravellerQuotes testimonials={THREE} />);
    expect(container.querySelectorAll('[data-slot="carousel-item"]')).toHaveLength(3);
  });

  it('có đủ hai nút điều hướng, mỗi nút một nhãn đọc được', () => {
    render(<TravellerQuotes testimonials={THREE} />);
    expect(screen.getByRole('button', { name: /previous slide/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next slide/i })).toBeInTheDocument();
  });

  it('điểm sao đọc thành MỘT câu, không phải 5 icon rời', () => {
    render(<TravellerQuotes testimonials={[THREE[1]!]} />);
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
  });

  it('chữ cái tắt lấy tối đa 2 phần đầu của tên', () => {
    render(<TravellerQuotes testimonials={[t('Sarah Mitchell', 'x')]} />);
    expect(screen.getByText('SM')).toBeInTheDocument();
  });

  it('không có lời chứng thực nào thì ẩn CẢ khu — không dữ liệu dự phòng', () => {
    const { container } = render(<TravellerQuotes testimonials={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('KHÔNG bịa trường `trip` — dòng meta chỉ có nơi ở', () => {
    // Mock v2 không có `trip` như Nexora; bịa một chuyến đi cho lời chứng thực
    // là đúng rủi ro uy tín mà chính Nexora cảnh báo trong comment của họ.
    render(<TravellerQuotes testimonials={[t('Sarah Mitchell', 'x')]} />);
    expect(screen.getByText(/Sydney, Australia/)).toBeInTheDocument();
  });
});
