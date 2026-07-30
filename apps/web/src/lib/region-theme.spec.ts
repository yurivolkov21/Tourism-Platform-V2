import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';
import { type RegionSectionKey, regionTheme } from './region-theme';

const KEYS: MockRegionKey[] = ['north', 'central', 'south'];

/** Số khu GIỮA hero và footer. Bảy khu mỗi miền là ràng buộc user chốt, và hai
    trong bảy là hero + footer do layout lo → còn đúng năm ở `sections`. */
const MIDDLE_SECTIONS = 5;

/** Khu chỉ được xuất hiện ở ĐÚNG MỘT miền — "6 khu riêng, không khu nào lặp". */
const UNIQUE: RegionSectionKey[] = ['heritage', 'worlds', 'days', 'dayTrips', 'seasons', 'reviews'];

describe('regionTheme — thứ tự khu và biến thể theo vùng', () => {
  it('ba vùng đều có ĐÚNG 5 khu giữa — bảy khu tính cả hero và footer', () => {
    for (const key of KEYS) {
      expect(regionTheme(key).sections.length, key).toBe(MIDDLE_SECTIONS);
    }
  });

  it('mọi vùng trong REGIONS đều có theme — không vùng nào rơi ra ngoài bản đồ', () => {
    for (const region of REGIONS) {
      expect(regionTheme(region.key).sections.length, region.key).toBe(MIDDLE_SECTIONS);
    }
  });

  it('ba galleryVariant KHÁC nhau — mỗi miền một bố cục ảnh riêng', () => {
    const variants = KEYS.map((key) => regionTheme(key).galleryVariant);
    expect(new Set(variants).size).toBe(KEYS.length);
  });

  it('ba introVariant KHÁC nhau', () => {
    const variants = KEYS.map((key) => regionTheme(key).introVariant);
    expect(new Set(variants).size).toBe(KEYS.length);
  });

  it('thứ tự khu của ba vùng không trùng nhau', () => {
    const orders = KEYS.map((key) => regionTheme(key).sections.join('>'));
    expect(new Set(orders).size).toBe(KEYS.length);
  });

  // User chốt: ĐÚNG ba thứ giống hệt cả ba miền — hero, lưới 6 tour card, footer.
  // Hero/footer do layout lo nên chỉ `tours` nằm trong `sections`. (`intro` và
  // `gallery` cũng có ở cả ba nhưng KHÁC biến thể, nên chúng không "giống hệt".)
  it('`tours` có mặt ở cả ba vùng, đúng một lần mỗi vùng', () => {
    for (const key of KEYS) {
      const tours = regionTheme(key).sections.filter((section) => section === 'tours');
      expect(tours, key).toHaveLength(1);
    }
  });

  // Sáu khu RIÊNG là cách ba trang tách khỏi nhau (user gọi bản một-khu-chữ-ký là
  // *"na ná"*). Một khu lọt sang miền thứ hai là mất một phần phân hoá, và mất
  // IM LẶNG — không có gì trên màn hình nói cho biết.
  it('sáu khu riêng mỗi khu chỉ ở ĐÚNG MỘT miền', () => {
    for (const unique of UNIQUE) {
      const owners = KEYS.filter((key) => regionTheme(key).sections.includes(unique));
      expect(owners, unique).toHaveLength(1);
    }
  });

  it('mỗi miền dùng đúng hai khu riêng — 6 khu chia đều cho 3 miền', () => {
    for (const key of KEYS) {
      const own = regionTheme(key).sections.filter((section) => UNIQUE.includes(section));
      expect(own, key).toHaveLength(2);
    }
  });

  // Bất biến chống "thêm key mà quên lắp": `sections` là danh sách chuỗi, nên thêm
  // một khoá vào đó mà không thêm nhánh render ở `page.tsx` thì khu đó BIẾN MẤT im
  // lặng — trang vẫn dựng, chỉ thiếu một băng. Đọc chính source của page là cách
  // duy nhất canh được từ tầng unit test: page là Server Component async, Vitest
  // không render nó (và `src/app/**` không nằm trong `include` của runner).
  it('mọi khu trong sections đều có nhánh render ở page.tsx', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../app/(site)/destinations/[region]/page.tsx', import.meta.url)),
      'utf8',
    );
    const used = new Set(KEYS.flatMap((key) => [...regionTheme(key).sections]));
    expect(used.size).toBe(9);
    for (const section of used) {
      expect(source, section).toContain(`case '${section}':`);
    }
  });
});
