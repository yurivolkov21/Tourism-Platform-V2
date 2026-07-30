import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AMPLITUDE, HEADER_DELAY, REVEAL_EASE, SPRING, SPRING_HEADING, STAGGER } from './motion';

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
    '../components/motion/reveal-item.tsx',
  ];

  it.each(FILES)('%s không để phần tử nào ở opacity 0 lúc chờ observer', (relative) => {
    expect(codeOf(relative)).not.toMatch(/initial=\{\{[^}]*opacity:\s*0/);
  });
});

/**
 * Task 5n — nhịp NỘI BỘ của khu, và nó là trục phân hoá ba miền.
 *
 * 5m chỉ chạm header khu; thân khu gần như tĩnh (6 khu không có gì, 3 khu chỉ đổi
 * màu khi hover). 5n cho mỗi khu một nhịp bên trong, và trục của nhịp đó KHÁC nhau
 * theo miền: Bắc trồi lên (`rise`), Trung trượt ngang (`slide`), Nam nở ra
 * (`bloom`). Xem `components/motion/reveal-item.tsx` cho lý lẽ từng trục.
 */
describe('nhịp thân khu — ba miền, ba TRỤC khác nhau', () => {
  /**
   * Mọi chữ ký một file dùng.
   *
   * Bắt tên trong DẤU NHÁY, không bắt riêng `enter="…"`: hai khu dùng chung cả ba
   * miền (`intro`, `gallery`) chọn chữ ký qua một `Record` ánh xạ từ biến thể bố cục
   * (`aside: 'rise'`), nên ở đó tên nằm ở giá trị của map chứ không ở chỗ gọi. Bản
   * đầu của hàm này chỉ khớp `enter="…"` và nó báo đỏ oan đúng hai khu đó.
   *
   * `codeOf` đã bỏ comment, nên comment tiếng Việt nhắc tên ba trục không tính.
   */
  function signaturesIn(name: string): string[] {
    return [
      ...codeOf(`../components/destinations/${name}.tsx`).matchAll(/['"](rise|slide|bloom)['"]/g),
    ].map((match) => match[1] as string);
  }

  /**
   * Khu → tập chữ ký được phép. Đây là bảng phân hoá ba miền ở dạng test, nên nó là
   * chốt chặn cho chính điều user yêu cầu ("phân tích các trang của 3 miền … áp dụng
   * motions vào cho từng sections").
   *
   *  · Sáu khu RIÊNG của một miền chỉ được mang đúng chữ ký của miền đó.
   *  · `intro` và `gallery` dùng chung cả ba miền qua BIẾN THỂ, nên chúng phải mang
   *    CẢ BA chữ ký — mỗi biến thể một trục, đúng như bố cục của chúng đã tách.
   *  · `tours` là khu user chốt phải GIỐNG HỆT ở cả ba miền ("hero · lưới 6 tour
   *    card · footer" là ba thứ duy nhất giống nhau), nên nó KHÔNG được mang chữ ký
   *    miền nào — nó chạy nhịp NHÀ (`rise`), y hệt trên cả ba trang.
   *  · `seasons` không có thân khu: hết header là hết khu (cột trái là câu hỏi, cột
   *    phải là câu trả lời, cả hai đã nằm trong cascade 5m). Nên nó là khu DUY NHẤT
   *    hợp lệ khi không có `enter` nào.
   */
  const ALLOWED: Record<(typeof REGION_SECTIONS)[number], readonly string[]> = {
    'region-intro': ['rise', 'slide', 'bloom'],
    'region-gallery': ['rise', 'slide', 'bloom'],
    'region-tours': ['rise'],
    'region-signature-timeline': ['slide'],
    'region-signature-postcards': ['bloom'],
    'region-days': ['rise'],
    'region-day-trips': ['slide'],
    'region-seasons': [],
    'region-reviews': ['bloom'],
  };

  it.each(REGION_SECTIONS.filter((name) => name !== 'region-seasons'))(
    '%s có nhịp thân khu, không chỉ có cascade header',
    (name) => {
      expect(signaturesIn(name).length).toBeGreaterThan(0);
    },
  );

  it.each(REGION_SECTIONS)('%s chỉ mang chữ ký được phép cho miền của nó', (name) => {
    const allowed = ALLOWED[name];
    expect(new Set(signaturesIn(name))).toEqual(new Set(allowed));
  });

  // Khu riêng của Bắc, của Trung và của Nam phải mang BA trục KHÁC nhau. Đây là
  // khẳng định giữ 5n khỏi biến thành "ba miền cùng một nhịp, khác mỗi delay" —
  // đúng thứ user đã bác hai lần ở các vòng thiết kế trước (tint màu và đồ thị).
  it('ba miền KHÔNG dùng chung một trục nào ở khu riêng của mình', () => {
    const north = signaturesIn('region-days');
    const central = signaturesIn('region-signature-timeline');
    const south = signaturesIn('region-signature-postcards');
    expect(new Set([...north, ...central, ...south]).size).toBe(3);
  });

  // Stagger phải DẪN XUẤT từ `STAGGER.grid`, không gõ số tại chỗ: 21 file khai
  // `const SPRING` nguyên văn là bài học đủ đắt về chuyện đó.
  it.each(REGION_SECTIONS.filter((name) => name !== 'region-seasons'))(
    '%s stagger bằng STAGGER.grid, không gõ số delay tại chỗ',
    (name) => {
      const code = codeOf(`../components/destinations/${name}.tsx`);
      expect(code).toMatch(/delay=\{[^}]*STAGGER\.grid/);
      expect(code).not.toMatch(/delay=\{\s*\d*\.\d+/);
    },
  );

  it('biên độ nay là MỘT nguồn — reveal-header không còn khai 24 tại chỗ', () => {
    const code = codeOf('../components/motion/reveal-header.tsx');
    expect(code).toContain('AMPLITUDE.rise');
    expect(code).not.toMatch(/const RISE = \d+/);
  });

  // Trục x là chỗ 5n có rủi ro RIÊNG: `translateX` khi JS chết đẩy nội dung ra khỏi
  // mép ngang — sang phải là sinh thanh cuộn ngang cho cả body (repo không có
  // `overflow-x: hidden` ở đâu), sang trái là cắt mất chữ. Đo 30/07 ở 390px trên cả
  // ba miền: khe trái = khe phải = 16px cho MỌI phần tử ứng viên, đúng bằng gutter
  // `px-4`. Kế hoạch gốc đề 60 rồi hạ trần 32; cả hai đều tràn.
  it('biên độ x không vượt gutter hẹp nhất đã đo, và nhỏ hơn biên độ y', () => {
    expect(AMPLITUDE.slide).toBeLessThanOrEqual(16);
    expect(AMPLITUDE.slide).toBeLessThan(AMPLITUDE.rise);
  });

  /**
   * Dải đèn lồng của miền Trung là chỗ DUY NHẤT trang vùng có cuộn ngang, và nó có
   * một cái bẫy chỉ đo mới thấy: `IntersectionObserver` tính giao qua cả chuỗi clip,
   * nên ô thứ 4–6 không bao giờ giao với cửa sổ tài liệu cho tới khi người dùng cuộn
   * chính cái dải. Observer không bắn thì ô ở lại `initial` VĨNH VIỄN — kể cả khi bật
   * giảm chuyển động, vì `reducedMotion="user"` chỉ tước transform của phép animate,
   * nó không xoá `initial` đã render. Đo 30/07 ở `prefers-reduced-motion: reduce`:
   * đúng 2 ô còn kẹt `translateX(-16px)`. `eager` nới viewport để cả dải cùng vào tầm.
   */
  it('dải cuộn ngang bọc MỘT nhịp cho cả dải, không một nhịp mỗi ô', () => {
    const code = codeOf('../components/destinations/region-gallery.tsx');
    // Khối `LanternsLayout` — từ tên hàm tới hết `PanoramaLayout` đứng sau nó.
    const lanterns = code.slice(
      code.indexOf('function LanternsLayout'),
      code.indexOf('function PanoramaLayout'),
    );
    // Đúng MỘT `RevealItem`, và nó KHÔNG có `delay` (một đơn vị thì không stagger).
    expect(lanterns.match(/<RevealItem/g)).toHaveLength(1);
    expect(lanterns).not.toContain('delay=');
    // Và nó phải bọc NGOÀI vùng cuộn, không nằm trong `labels.map`.
    expect(lanterns.indexOf('<RevealItem')).toBeLessThan(lanterns.indexOf('labels.map'));
  });

  // Bưu thiếp xoè khi hover là CSS transition, không phải motion component, nên
  // `MotionConfig reducedMotion="user"` VÔ CAN — phải tự guard bằng `motion-safe:`
  // (loại 2). Khuôn: `destination-tile.tsx`, `region-gallery.tsx`.
  it('hiệu ứng hover của bưu thiếp Nam tự guard bằng motion-safe', () => {
    const code = codeOf('../components/destinations/region-signature-postcards.tsx');
    const hovers = [...code.matchAll(/[\w:[\]/.-]*group-hover:[\w[\]/.\-%]+/g)].map(
      (match) => match[0],
    );
    expect(hovers.length).toBeGreaterThan(0);
    for (const hover of hovers) expect(hover.startsWith('motion-safe:')).toBe(true);
  });
});
