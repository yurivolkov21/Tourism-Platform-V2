import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TourCardVM } from '@/lib/api/tours';
import { TourCard } from './tour-card';

const BASE: TourCardVM = {
  id: 'a',
  slug: 'mekong-delta-boats',
  title: 'Mekong Delta Boats',
  summary: 'Catch the dawn floating market at Cái Răng.',
  basePrice: '129.00',
  compareAtPrice: null,
  currency: 'USD',
  durationDays: 2,
  difficulty: 'EASY',
  maxGroupSize: 12,
  isFeatured: false,
  destinations: [
    { slug: 'can-tho', name: 'Cần Thơ', isPrimary: true },
    { slug: 'sai-gon', name: 'Sài Gòn', isPrimary: false },
  ],
  category: { slug: 'cruises', name: 'Cruises' },
  ratingAvg: 4.8,
  ratingCount: 758,
};

function make(overrides: Partial<TourCardVM> = {}): TourCardVM {
  return { ...BASE, ...overrides };
}

describe('TourCard — sáu trường của mặt card', () => {
  it('hiện chuỗi chặng, tiêu đề, hình dạng chuyến, giá và rating', () => {
    render(<TourCard tour={make()} />);
    // getAllByText cho "Cần Thơ": nó vừa là nhãn ảnh vừa là chặng đầu — xem test
    // "nhãn ảnh là tên điểm đến chính" ở dưới, đó là chủ ý.
    expect(screen.getAllByText('Cần Thơ').length).toBeGreaterThan(0);
    expect(screen.getByText('Sài Gòn')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mekong Delta Boats' })).toBeInTheDocument();
    expect(screen.getByText('2 days · Easy')).toBeInTheDocument();
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(758)')).toBeInTheDocument();
  });

  it('KHÔNG hiện chuyên mục, cỡ nhóm hay tóm tắt — chúng đã cố ý bị cắt', () => {
    // Chuyên mục gần như hằng số ở slot này (relatedTours ưu tiên cùng chuyên
    // mục); cỡ nhóm là thông tin lúc quyết; tóm tắt tranh chỗ với tiêu đề.
    render(<TourCard tour={make()} />);
    expect(screen.queryByText('Cruises')).not.toBeInTheDocument();
    expect(screen.queryByText(/max 12/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/floating market/i)).not.toBeInTheDocument();
  });

  it('difficulty null thì bỏ luôn dấu phân cách, không để "2 days · "', () => {
    render(<TourCard tour={make({ difficulty: null })} />);
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});

describe('TourCard — một vùng bấm duy nhất', () => {
  it('cả card là MỘT link tới trang tour, và không có phần tử tương tác nào khác', () => {
    // Bất biến này chốt hai quyết định: (a) bỏ nút tim vì wishlist chưa nối, và
    // (b) không phần tử tương tác lồng nhau — nhờ đó cảm ứng hoạt động y hệt
    // desktop, không cần cử chỉ nào để mở.
    render(<TourCard tour={make()} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/tours/mekong-delta-boats');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('nhãn ảnh là tên điểm đến chính, KHÔNG lặp lại tiêu đề', () => {
    // Lặp lại tiêu đề làm trình đọc màn hình đọc tên tour hai lần liên tiếp.
    render(<TourCard tour={make()} />);
    expect(screen.getAllByText('Cần Thơ')).toHaveLength(2); // nhãn ảnh + chặng đầu
    expect(screen.getAllByText('Mekong Delta Boats')).toHaveLength(1);
  });
});

describe('TourCard — giá và rating ở các nhánh nullable', () => {
  it('có giá gạch thì hiện cả hai giá và chip phần trăm giảm', () => {
    render(<TourCard tour={make({ compareAtPrice: '160.00' })} />);
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.getByText('$160')).toBeInTheDocument();
    // (160-129)/160 = 19,3% → làm tròn xuống 19.
    expect(screen.getByText('−19%')).toBeInTheDocument();
  });

  it('không giá gạch thì hiện đơn vị "per person" thay vào chỗ đó', () => {
    render(<TourCard tour={make()} />);
    expect(screen.getByText('per person')).toBeInTheDocument();
    expect(screen.queryByText(/−\d+%/)).not.toBeInTheDocument();
  });

  it('ratingAvg null hiện nhãn chữ và TUYỆT ĐỐI không in 0.0', () => {
    render(<TourCard tour={make({ ratingAvg: null, ratingCount: 0 })} />);
    expect(screen.getByText('Not yet reviewed')).toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
  });

  it('rating tròn vẫn in một chữ số thập phân', () => {
    // In thô thì 4 hiện thành "4" và hai card cạnh nhau lệch định dạng.
    render(<TourCard tour={make({ ratingAvg: 4 })} />);
    expect(screen.getByText('4.0')).toBeInTheDocument();
  });
});

describe('TourCard — dải chặng khi tour đi nhiều nơi', () => {
  const FOUR = make({
    slug: 'north-to-south-classic',
    title: 'North to South Classic',
    destinations: [
      { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
      { slug: 'hue', name: 'Huế', isPrimary: false },
      { slug: 'hoi-an', name: 'Hội An', isPrimary: false },
      { slug: 'sai-gon', name: 'Sài Gòn', isPrimary: false },
    ],
  });

  it('hiện 2 chặng đầu rồi gộp phần dư thành +N', () => {
    render(<TourCard tour={FOUR} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('tên chặng bị gộp VẪN đọc được — "+2" không được làm mất thông tin', () => {
    render(<TourCard tour={FOUR} />);
    expect(screen.getByText('Hội An, Sài Gòn')).toBeInTheDocument();
  });

  it('tour một điểm đến thì không có +N', () => {
    render(
      <TourCard tour={make({ destinations: [{ slug: 'hue', name: 'Huế', isPrimary: true }] })} />,
    );
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('điểm đến chính luôn đứng đầu dải, kể cả khi dữ liệu trả về sau', () => {
    // routeChain() sắp lại chứ không tin thứ tự mảng — contract nói primary đứng
    // đầu nhưng không bảo đảm.
    render(
      <TourCard
        tour={make({
          destinations: [
            { slug: 'sai-gon', name: 'Sài Gòn', isPrimary: false },
            { slug: 'can-tho', name: 'Cần Thơ', isPrimary: true },
          ],
        })}
      />,
    );
    // Nhãn ảnh cũng là điểm đến chính → xuất hiện 2 lần nếu sắp đúng.
    expect(screen.getAllByText('Cần Thơ')).toHaveLength(2);
  });
});
