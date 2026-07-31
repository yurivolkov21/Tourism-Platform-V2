import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { Gallery } from './gallery';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver — header của Gallery dùng
  // `motion.h2`/`motion.p` với `whileInView`, cần API này để mount. Test này
  // không quan sát animation nên stub tối giản (không làm gì) là đủ.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Fix review Important (Task 2, cụm Destinations): `dest.region` giờ mang TÊN
// HIỂN THỊ ('Northern Vietnam'), không còn là khoá vùng ('north'). Card phải
// đi qua regionOf() để đổi tên hiển thị đó thành khoá trước khi gắn
// data-region — nếu ai quay lại so thô `dest.region === region.key`,
// data-region sẽ ra chuỗi tên hiển thị. Lớp tint `[data-region]` đã rút theo
// ADR-0015 nên hậu quả không còn là mất màu, nhưng thuộc tính vẫn phải mang
// KHOÁ: nó là móc dữ liệu duy nhất nói thẻ này thuộc vùng nào.
//
// Ánh xạ dưới đây là SỰ THẬT NỀN cố định theo đúng fixture DESTINATIONS (xem
// mocks/destinations.ts: 3 địa điểm/vùng, xếp liền mạch Bắc→Trung→Nam) — viết
// tay bằng tay, KHÔNG gọi lại regionOf() để tính, vì nếu dùng lại chính hàm
// đang được kiểm thì một bug trong hàm đó sẽ lọt qua test mà không ai biết.
const EXPECTED_REGION_KEY: Record<string, 'north' | 'central' | 'south'> = {
  'sa-pa': 'north',
  'ha-long': 'north',
  'ninh-binh': 'north',
  hue: 'central',
  'da-nang': 'central',
  'hoi-an': 'central',
  'ho-chi-minh-city': 'south',
  'can-tho': 'south',
  'phu-quoc': 'south',
};

const REGION_NAME_BY_KEY = new Map(REGIONS.map((r) => [r.key, r.name]));

/** Card là MỘT thẻ <a>; tên truy cập của nó gộp cả chip vùng + mô tả ảnh + tên
    địa điểm, nên regex khớp theo tên địa điểm vẫn định vị đúng một card duy
    nhất (9 tên trong fixture không trùng lặp nhau). */
function cardFor(destName: string) {
  return screen.getByRole('link', { name: new RegExp(destName) });
}

describe('Gallery — data-region phải là KHOÁ vùng, không phải tên hiển thị', () => {
  it('mỗi thẻ địa điểm mang data-region đúng khoá vùng (north/central/south)', () => {
    render(<Gallery />);
    for (const dest of DESTINATIONS) {
      const link = cardFor(dest.name);
      const expectedKey = EXPECTED_REGION_KEY[dest.slug];
      // Khẳng định DƯƠNG, so BẰNG (không phải toContain): nếu component quay lại
      // so thô dest.region với region.key, data-region sẽ ra "Northern Vietnam"
      // (hoặc null) thay vì "north" — dòng này phải ĐỎ trong ca đó.
      expect(link).toHaveAttribute('data-region', expectedKey);
    }
  });

  it('chip vùng trên mỗi thẻ hiện đúng TÊN HIỂN THỊ của khoá vùng thẻ đó mang', () => {
    render(<Gallery />);
    for (const dest of DESTINATIONS) {
      const link = cardFor(dest.name);
      const expectedKey = EXPECTED_REGION_KEY[dest.slug];
      const expectedName = REGION_NAME_BY_KEY.get(expectedKey);
      expect(expectedName).toBeDefined();
      expect(within(link).getByText(expectedName as string)).toBeInTheDocument();
    }
  });
});
