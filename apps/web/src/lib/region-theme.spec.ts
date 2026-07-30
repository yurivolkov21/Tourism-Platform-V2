import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';
import { type RegionSectionKey, regionTheme, SIGNATURE_BAND_BG } from './region-theme';

const KEYS: MockRegionKey[] = ['north', 'central', 'south'];

/** Số khu GIỮA hero và footer. Bảy khu mỗi miền là ràng buộc user chốt, và hai
    trong bảy là hero + footer do layout lo → còn đúng năm ở `sections`. */
const MIDDLE_SECTIONS = 5;

/** Khu chỉ được xuất hiện ở ĐÚNG MỘT miền — "6 khu riêng, không khu nào lặp". */
const UNIQUE: RegionSectionKey[] = ['heritage', 'worlds', 'days', 'dayTrips', 'seasons', 'reviews'];

describe('SIGNATURE_BAND_BG — không gian nội suy', () => {
  // Bẫy đã cắn thật (Task 5l, user báo "nền băng bị hồng" ở cả ba miền):
  // `color-mix(in oklch, var(--muted), var(--background) 55%)` pha HAI màu chroma
  // ≈ 0 (0.010 và 0.003), nên Chrome trả `oklch(0.948648 0.00616 none)` — hue
  // POWERLESS. Không còn góc hue nào để giữ, kết quả render ra 242,236,238
  // (`#f2ecee`): kênh LỤC THẤP NHẤT, dù cả hai đầu vào đều lục trội
  // (220,229,226 và 245,248,247). Lệch ~180° so với cả hai đầu vào.
  //
  // `in oklab` nội suy theo trục Descartes a/b nên không có góc nào để mất: đo
  // lại được 234,239,238 (`#eaefee`), lục trội, ΔL −0.0786 so với −0.0822 → nhịp
  // trang không đổi. Ở dark hai công thức ra gần y hệt (35,50,46 vs 35,50,47),
  // đúng vì ở đó chroma của `--muted` lớn hơn.
  //
  // ⚠️ Luật rút ra: mọi phép `color-mix` giữa các màu GẦN TRUNG TÍNH phải dùng
  // `in oklab`. Đối chứng KHÔNG hỏng: `region-group.tsx:44` pha `--primary`
  // (chroma 0.067) với `--background` — chroma đủ lớn neo được hue, đo ra
  // `#dde7e5` và bản oklab cho kết quả y hệt, nên chỗ đó để nguyên.
  it('pha trong oklab, KHÔNG oklch — hai token gần trung tính làm hue mất ổn định', () => {
    expect(SIGNATURE_BAND_BG).toContain('in oklab');
    expect(SIGNATURE_BAND_BG).not.toContain('in oklch');
  });
});

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
