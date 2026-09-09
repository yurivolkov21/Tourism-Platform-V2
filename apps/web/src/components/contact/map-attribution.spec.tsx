import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapAttribution } from './map-attribution';

// Vì sao có file này: bản đồ /contact không có spec nào — jsdom không có WebGL
// nên `contact-map.tsx` chỉ được mock, không được render. Khi đổi từ
// AttributionControl của MapLibre sang tự render (lý do bảo mật ở
// `contact-map.tsx`), nghĩa vụ ghi công licence ADR-0018 mất luôn lớp canh
// cuối cùng. Ba assert dưới đây ghim đúng thứ mà `pnpm gate` không thấy được.
describe('MapAttribution', () => {
  it('giữ đủ ba nguồn mà TileJSON của OpenFreeMap khai', () => {
    render(<MapAttribution />);

    expect(screen.getByRole('link', { name: 'OpenFreeMap' })).toHaveAttribute(
      'href',
      'https://openfreemap.org',
    );
    expect(screen.getByRole('link', { name: '© OpenMapTiles' })).toHaveAttribute(
      'href',
      'https://www.openmaptiles.org/',
    );
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
  });

  it('link ra ngoài mở tab mới và không rò referrer', () => {
    render(<MapAttribution />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });
});
