import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RegionGlance } from '@/lib/regions';
import { RegionGlanceBar } from './region-glance';

const GLANCE: RegionGlance = {
  fromPrice: '68.00',
  difficulties: ['EASY', 'MODERATE', 'CHALLENGING'],
  categories: [
    { slug: 'cruises', name: 'Cruises' },
    { slug: 'trekking', name: 'Trekking' },
  ],
};

describe('RegionGlanceBar', () => {
  it('in giá "từ" đã format, KHÔNG in chuỗi thô', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText('$68')).toBeInTheDocument();
    expect(screen.queryByText('68.00')).not.toBeInTheDocument();
  });

  it('phổ ≥2 bậc in dạng khoảng đầu → cuối', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText('Easy → Challenging')).toBeInTheDocument();
  });

  it('phổ đúng 1 bậc in MỘT chữ, không in "Easy → Easy"', () => {
    render(<RegionGlanceBar glance={{ ...GLANCE, difficulties: ['EASY'] }} currency="USD" />);
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  // Thay bản cũ dùng `queryByText(/trips?$/)`: component không bao giờ render
  // chữ đó nên phép phủ định luôn đúng dù code làm gì — xanh mà không canh.
  // Khẳng định DANH SÁCH NHÃN thì thêm mục thứ tư (số tour, khoảng ngày) là đỏ.
  it('ĐÚNG BA mục, đúng ba nhãn — không số tour, không khoảng ngày', () => {
    const { container } = render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    const labels = [...container.querySelectorAll('dt')].map((el) => el.textContent);
    expect(labels).toEqual(['From', 'Difficulty', 'Trip styles']);
  });

  it('liệt kê chuyên mục có mặt', () => {
    render(<RegionGlanceBar glance={GLANCE} currency="USD" />);
    expect(screen.getByText(/Cruises/)).toBeInTheDocument();
    expect(screen.getByText(/Trekking/)).toBeInTheDocument();
  });

  // Nhánh CÓ THẬT khi gắn API: `difficulty` nullable, một vùng mà mọi tour đều
  // null thì `difficulties` rỗng. Bỏ hẳn mục, không in nhãn treo giá trị rỗng.
  it('không bậc độ khó nào thì BỎ HẲN mục đó, không in nhãn rỗng', () => {
    const { container } = render(
      <RegionGlanceBar glance={{ ...GLANCE, difficulties: [] }} currency="USD" />,
    );
    const labels = [...container.querySelectorAll('dt')].map((el) => el.textContent);
    expect(labels).toEqual(['From', 'Trip styles']);
  });
});
