import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HEADER_DELAY, REVEAL_EASE, SPRING, SPRING_HEADING, STAGGER } from './motion';

/**
 * ⚠️ Spec này ĐỌC SOURCE của component thay vì render chúng, và đó là lựa chọn có
 * lý do: `lib/motion.ts` không phải là nguồn duy nhất của bộ số này — 21 file khai
 * `const SPRING` nguyên văn tại chỗ và 19 file gõ spring 240 inline vào `transition`
 * của `h2`. Chừng nào chưa dedup được (đổi chúng là phải chụp và đo lại mọi trang đã
 * duyệt), thứ duy nhất giữ hai bản khỏi trôi khỏi nhau là một test so SỐ với SỐ.
 *
 * Cách này đã có tiền lệ trong repo: `region-theme.spec.ts` đọc `page.tsx` để bắt ca
 * "thêm khoá vào `sections` mà quên lắp nhánh render". Cùng lý do ở đây — Vitest
 * không render Server Component async, và `src/app/**` không nằm trong `include`.
 */
function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

/** Source đã BỎ comment. Bắt buộc cho các assertion dạng "không được có X": comment
    tiếng Việt của repo giải thích chính những pattern bị cấm (kể cả bằng cách gõ
    nguyên văn `initial={{ opacity: 0 }}` để nói vì sao không dùng), nên khớp regex
    trên source thô là bắt được prose và báo đỏ oan. */
function codeOf(relative: string): string {
  return read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Mọi bộ ba `stiffness/damping/mass` gõ tay trong một file, theo thứ tự xuất hiện. */
function springsIn(relative: string): { stiffness: number; damping: number; mass: number }[] {
  return [
    ...codeOf(relative).matchAll(/stiffness:\s*(\d+),\s*damping:\s*(\d+),\s*mass:\s*(\d+)/g),
  ].map((match) => ({
    stiffness: Number(match[1]),
    damping: Number(match[2]),
    mass: Number(match[3]),
  }));
}

function numbers(spring: typeof SPRING | typeof SPRING_HEADING) {
  return { stiffness: spring.stiffness, damping: spring.damping, mass: spring.mass };
}

/** Chín khu của trang vùng. Danh sách này là bản sao của `RegionSectionKey` ở dạng
    tên file — `region-theme.spec.ts` đã canh rằng chín khoá đó có đủ nhánh render,
    còn ở đây ta canh chín KHU có đủ nhịp header. */
const REGION_SECTIONS = [
  'region-intro',
  'region-gallery',
  'region-tours',
  'region-signature-timeline',
  'region-signature-postcards',
  'region-days',
  'region-day-trips',
  'region-seasons',
  'region-reviews',
] as const;

describe('lib/motion — bộ số phải KHỚP bản copy đang chạy trên trang đã duyệt', () => {
  it('SPRING đúng bộ số `motion/reveal.tsx` dùng (21 file khai lại nguyên văn)', () => {
    expect(springsIn('../components/motion/reveal.tsx')).toEqual([numbers(SPRING)]);
    expect(SPRING.type).toBe('spring');
  });

  // `home/gallery.tsx` là bản mẫu của cặp này: `h2` chạy spring 240 (phần tử LỚN,
  // chậm hơn một bậc) và đoạn dẫn ngay dưới chạy spring 320. Cả HAI phải có trong
  // `lib/motion.ts`, nếu không khu vùng lại gõ tay một trong hai.
  it('SPRING_HEADING và SPRING đều là bộ số `home/gallery.tsx` đang dùng', () => {
    const found = springsIn('../components/home/gallery.tsx');
    expect(found).toContainEqual(numbers(SPRING_HEADING));
    expect(found).toContainEqual(numbers(SPRING));
    expect(SPRING_HEADING.type).toBe('spring');
  });

  it('SPRING_HEADING chậm hơn SPRING một bậc — nó dành cho phần tử LỚN', () => {
    expect(SPRING_HEADING.stiffness).toBeLessThan(SPRING.stiffness);
    expect(SPRING_HEADING.damping).toBe(SPRING.damping);
    expect(SPRING_HEADING.mass).toBe(SPRING.mass);
  });

  it('REVEAL_EASE đúng đường cong `motion/reveal-line.tsx` khai — ease DUY NHẤT có tên', () => {
    expect(read('../components/motion/reveal-line.tsx')).toContain(
      `[${REVEAL_EASE.join(', ')}] as const`,
    );
  });

  it('STAGGER.grid đúng bước lưới ảnh `journey-moments.tsx` dùng', () => {
    expect(read('../components/destinations/journey-moments.tsx')).toContain(
      `${STAGGER.grid} * (index + 1)`,
    );
  });
});

describe('HEADER_DELAY — thang nhịp của cascade header', () => {
  it('tiêu đề khu KHÔNG có delay — nó là phần tử mở màn của cascade', () => {
    expect(HEADER_DELAY.heading).toBe(0);
  });

  it('ba nhịp TĂNG DẦN — một thang không tăng thì không phải cascade', () => {
    expect(HEADER_DELAY.heading).toBeLessThan(HEADER_DELAY.lede);
    expect(HEADER_DELAY.lede).toBeLessThan(HEADER_DELAY.cta);
  });

  // `SectionEyebrow` (không sửa được — 21 consumer trên các trang đã duyệt) khai
  // `delay: 0.2` cứng. Cả cascade phải đóng lại KHÔNG MUỘN HƠN eyebrow của chính
  // nó, nếu không header đọc thành hai đợt rời: chữ lớn xong rồi mới lục tục thêm
  // mấy dòng nhỏ. Đây là ràng buộc pha, không phải con số tự chọn.
  it('nhịp cuối không muộn hơn delay của chính SectionEyebrow', () => {
    const eyebrow = read('../components/home/section-eyebrow.tsx').match(/delay:\s*([\d.]+)/);
    expect(eyebrow?.[1]).toBeDefined();
    expect(HEADER_DELAY.cta).toBeLessThanOrEqual(Number(eyebrow?.[1]));
  });
});

describe('cascade header — cả CHÍN khu trang vùng đi qua lib/motion', () => {
  it.each(REGION_SECTIONS)('%s dùng RevealHeading, không còn `<h2>` trơ', (name) => {
    const code = codeOf(`../components/destinations/${name}.tsx`);
    expect(code).toContain('RevealHeading');
    expect(code).not.toMatch(/<h2[\s>]/);
  });

  it.each(REGION_SECTIONS)('%s KHÔNG gõ tay bộ số spring tại chỗ', (name) => {
    expect(springsIn(`../components/destinations/${name}.tsx`)).toEqual([]);
  });

  // Trước Task 5m `page.tsx` bọc cả 5 khu giữa trong `Reveal` (`y:24`, viewport
  // margin `-80px`). Thêm nhịp cho phần tử CON bên trong là chồng hai transform, và
  // hai observer bắn gần như đồng thời (margin `-80px` so với `0` của
  // `SectionEyebrow`) nên không tách được thành nhịp. Từ 5m mỗi khu tự lo nhịp của
  // mình — đúng như hero vốn đã được miễn.
  it('page.tsx KHÔNG bọc khu vùng trong `Reveal` nữa', () => {
    const code = codeOf('../app/(site)/destinations/[region]/page.tsx');
    expect(code).not.toContain('/components/motion/reveal');
    expect(code).not.toMatch(/<Reveal[\s>]/);
  });
});

describe('trang vùng phải ĐỌC ĐƯỢC khi JS chưa chạy', () => {
  /**
   * `whileInView` với `initial={{ opacity: 0 }}` là chữ KHÔNG BAO GIỜ hiện nếu JS
   * chết: motion render `initial` thành `style` inline ngay trong HTML của server,
   * và thứ đưa nó về 1 là observer phía client. Trang vùng là SSG nên nội dung phải
   * sống mà không cần JS.
   *
   * Đã đo trên `/destinations/northern-vietnam` trước Task 5m: **20 phần tử mang
   * `opacity:0`** trong HTML server, trong đó 5 cái là `Reveal` bọc TRỌN từng khu
   * giữa — tức tắt JS là cả trang dưới hero trắng trơn.
   *
   * Vì vậy cascade header chỉ animate TRANSFORM (`y`), không animate opacity: tắt
   * JS thì chữ nằm lệch 24px nhưng đọc được, còn bật giảm chuyển động thì
   * `MotionConfig reducedMotion="user"` ở root layout tự tước transform đi.
   */
  const FILES = [
    ...REGION_SECTIONS.map((name) => `../components/destinations/${name}.tsx`),
    '../components/motion/reveal-header.tsx',
  ];

  it.each(FILES)('%s không để phần tử nào ở opacity 0 lúc chờ observer', (relative) => {
    expect(codeOf(relative)).not.toMatch(/initial=\{\{[^}]*opacity:\s*0/);
  });
});
