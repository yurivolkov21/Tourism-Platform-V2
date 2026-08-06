import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OFFICES } from '@/mocks/offices';
import { ContactLocation } from './contact-location';

// jsdom không có WebGL nên maplibre-gl không chạy được. Mock ĐÚNG module bản
// đồ (không mock cả @tourism/ui như Nexora buộc phải làm — v2 dùng subpath
// export nên không có barrel kéo theo) — xem ADR-0018.
vi.mock('./contact-map', () => ({
  default: () => <div data-testid="contact-map" />,
}));

describe('ContactLocation', () => {
  it('render đủ card cho mọi văn phòng', () => {
    render(<ContactLocation />);
    for (const office of OFFICES) {
      expect(screen.getByRole('heading', { name: new RegExp(office.city) })).toBeInTheDocument();
    }
  });

  it('nút chỉ đường trỏ Google Maps và mở tab mới — KHÔNG phải link chết #visit', () => {
    render(<ContactLocation />);
    const links = screen.getAllByRole('link', { name: /Get directions/i });
    expect(links).toHaveLength(OFFICES.length);
    links.forEach((link, index) => {
      const office = OFFICES[index];
      expect(link).toHaveAttribute('href', office?.mapHref);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  it('hiện địa chỉ và giờ mở cửa của từng văn phòng', () => {
    render(<ContactLocation />);
    for (const office of OFFICES) {
      for (const line of office.addressLines) {
        expect(screen.getByText(line)).toBeInTheDocument();
      }
      expect(screen.getAllByText(office.hours).length).toBeGreaterThan(0);
    }
  });
});
