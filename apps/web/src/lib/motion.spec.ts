import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AMPLITUDE, HEADER_DELAY, REVEAL_EASE, SPRING, SPRING_HEADING, STAGGER } from './motion';

/**
 * ⚠️ Spec này ĐỌC SOURCE của component thay vì render chúng, và đó là lựa chọn có
 * lý do: thứ nó canh là **sự VẮNG MẶT của một pattern** trên khắp cây component, và
 * không có phép render nào nói được điều đó. Vitest cũng không render Server
 * Component async, và `src/app/**` không nằm trong `include`.
 *
 * Cách này đã có tiền lệ trong repo: `region-theme.spec.ts` đọc `page.tsx` để bắt ca
 * "thêm khoá vào `sections` mà quên lắp nhánh render".
 *
 * Lịch sử (đọc trước khi sửa): tới 30/07 `lib/motion.ts` **không** phải nguồn duy
 * nhất — 21 file khai `const SPRING` nguyên văn, 19 chỗ gõ spring 240 inline và 22
 * chỗ gõ spring 320 inline. Hồi đó spec này so SỐ với SỐ để hai bản khỏi trôi khỏi
 * nhau. Dedup xong (user duyệt 30/07) thì bất biến ĐỔI CHIỀU: không còn "hai bản
 * khớp nhau" mà là "chỉ còn một bản", và test đó không thể xanh giả.
 */
function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

/** Mọi file component (đệ quy), trả về đường dẫn TƯƠNG ĐỐI so với `components/`.
    Quét cả cây thay vì liệt kê tay: danh sách gõ tay sẽ không bao giờ biết tới file
    thứ 41, mà đúng file đó mới là chỗ bản copy quay lại. */
function componentFiles(): string[] {
  const root = fileURLToPath(new URL('../components', import.meta.url));
  const walk = (dir: string, prefix = ''): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return walk(join(dir, entry.name), rel);
      // Bỏ spec: chúng CỐ Ý gõ số để khẳng định, đó là vai trò của chúng.
      return /\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name) ? [rel] : [];
    });
  return walk('.');
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

describe('lib/motion — NGUỒN DUY NHẤT của bộ số, không còn bản copy nào', () => {
  // ⚠️ Ba test dưới đây được SUY LẠI ngày 30/07 sau khi dedup, không phải xoá đi cho
  // xanh. Bản cũ khẳng định "`lib/motion.ts` KHỚP bản copy trong reveal.tsx /
  // gallery.tsx / reveal-line.tsx" — hợp lý khi còn 21 bản `const SPRING`, 19 chỗ
  // spring 240 inline và 22 chỗ spring 320 inline. Dedup xong thì các literal đó
  // không còn, nên test cũ đỏ vì thứ nó canh đã BIẾN MẤT theo đúng ý muốn.
  //
  // Bất biến bây giờ mạnh hơn và đi NGƯỢC chiều: thay vì "hai bản khớp nhau", canh
  // rằng **chỉ còn một bản**. Điều đó không thể xanh giả — thêm lại một `const
  // SPRING` ở bất kỳ component nào là đỏ ngay, còn test cũ thì vẫn xanh miễn hai
  // bên cùng giá trị.
  it('KHÔNG component nào khai lại HAI spring DÙNG CHUNG — lib/motion là bản duy nhất', () => {
    // `Set<number>` tường minh: `as const` ở `lib/motion.ts` làm suy diễn ra
    // `Set<320 | 240>`, và `has()` khi đó từ chối một `number` bất kỳ.
    const shared = new Set<number>([SPRING.stiffness, SPRING_HEADING.stiffness]);
    const offenders = componentFiles().flatMap((file) =>
      springsIn(`../components/${file}`)
        .filter((spring) => shared.has(spring.stiffness))
        .map((spring) => `${file}: stiffness ${spring.stiffness}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * Spring MỘT-LẦN được phép tồn tại, nhưng phải đi qua đây.
   *
   * Hai file dưới đây dùng độ cứng RIÊNG (420 · 260), không phải bản copy của bộ số
   * dùng chung — nên gộp chúng vào `lib/motion.ts` là sai hướng: file đó giữ **từ
   * vựng dùng chung**, và nhồi mọi giá trị một-lần vào sẽ biến nó thành một bãi hằng
   * số mà không ai biết cái nào thật sự dùng ở nhiều nơi.
   *
   * Nhưng danh sách phải là ALLOWLIST chứ không phải bỏ qua im lặng: nếu mai có file
   * thứ ba gõ một spring riêng, test này đỏ và buộc người viết trả lời một câu —
   * "giá trị này là một-lần thật, hay là bản copy thứ 22 sắp trôi khỏi bộ số chung?".
   * Đúng câu hỏi mà 62 bản copy trước 30/07 chưa ai bị buộc phải trả lời.
   */
  it('spring một-lần chỉ ở HAI file đã biết — file thứ ba phải giải trình', () => {
    const withSprings = componentFiles().filter(
      (file) => springsIn(`../components/${file}`).length > 0,
    );
    expect(withSprings.sort()).toEqual(['content/on-this-page.tsx', 'feedback/not-found-body.tsx']);
  });

  // `home/gallery.tsx` là bản mẫu của cặp này: `h2` chạy `SPRING_HEADING` (phần tử
  // LỚN, chậm hơn một bậc) và đoạn dẫn ngay dưới chạy `SPRING`. Nay nó phải lấy CẢ
  // HAI qua import — gõ lại một trong hai là vi phạm test trên.
  it('`home/gallery.tsx` lấy CẢ HAI spring qua import, không gõ số', () => {
    const code = codeOf('../components/home/gallery.tsx');
    expect(code).toMatch(/import \{[^}]*\bSPRING\b[^}]*\} from '@\/lib\/motion'/);
    expect(code).toMatch(/import \{[^}]*\bSPRING_HEADING\b[^}]*\} from '@\/lib\/motion'/);
    expect(SPRING.type).toBe('spring');
    expect(SPRING_HEADING.type).toBe('spring');
  });

  it('SPRING_HEADING chậm hơn SPRING một bậc — nó dành cho phần tử LỚN', () => {
    expect(SPRING_HEADING.stiffness).toBeLessThan(SPRING.stiffness);
    expect(SPRING_HEADING.damping).toBe(SPRING.damping);
    expect(SPRING_HEADING.mass).toBe(SPRING.mass);
  });

  // `REVEAL_EASE` SINH RA ở `reveal-line.tsx` và `lib/motion.ts` từng chép lại. Bản
  // cục bộ đã xoá — hai khai báo cùng giá trị nghĩa là một ngày nào đó sửa một bên,
  // và hero /about với hero trang vùng lặng lẽ chạy hai đường cong khác nhau.
  it('REVEAL_EASE chỉ khai ở lib/motion — `reveal-line.tsx` import, không khai lại', () => {
    const code = codeOf('../components/motion/reveal-line.tsx');
    expect(code).toMatch(/import \{[^}]*\bREVEAL_EASE\b[^}]*\} from '@\/lib\/motion'/);
    expect(code).not.toContain('const REVEAL_EASE');
    // Đường cong vẫn phải đúng bộ số đã duyệt, không chỉ "tồn tại ở một chỗ".
    expect([...REVEAL_EASE]).toEqual([0.16, 1, 0.3, 1]);
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
   *  · `intro` dùng chung cả ba miền qua BIẾN THỂ, nên nó phải mang CẢ BA chữ ký —
   *    mỗi biến thể một trục, đúng như bố cục của chúng đã tách.
   *  · `gallery` cũng dùng chung ba miền, nhưng chỉ mang HAI chữ ký (`rise` cho
   *    `peaks`, `bloom` cho `panorama`). Biến thể `lanterns` của miền Trung KHÔNG
   *    dùng `RevealItem` nữa từ Task 5o: dải của nó chạy ngang theo TIẾN ĐỘ CUỘN
   *    TRANG (khuôn `home/gallery.tsx`), nên trục ngang của miền Trung ở khu này do
   *    chính phép cuộn mang — mạnh hơn một nhịp `slide` 16px, và một transform ghi
   *    lên đúng phần tử mà cơ chế đang lái sẽ tranh nhau. Trục của miền Trung vẫn có
   *    ở ba khu khác (`heritage`, `dayTrips`, `intro`), nên phân hoá không mất.
   *  · `tours` là khu user chốt phải GIỐNG HỆT ở cả ba miền ("hero · lưới 6 tour
   *    card · footer" là ba thứ duy nhất giống nhau), nên nó KHÔNG được mang chữ ký
   *    miền nào — nó chạy nhịp NHÀ (`rise`), y hệt trên cả ba trang.
   *  · `seasons` không có thân khu: hết header là hết khu (cột trái là câu hỏi, cột
   *    phải là câu trả lời, cả hai đã nằm trong cascade 5m). Nên nó là khu DUY NHẤT
   *    hợp lệ khi không có `enter` nào.
   */
  const ALLOWED: Record<(typeof REGION_SECTIONS)[number], readonly string[]> = {
    'region-intro': ['rise', 'slide', 'bloom'],
    'region-gallery': ['rise', 'bloom'],
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
   * ⚠️ Khẳng định này SUY LẠI ở Task 5o. Bản 5n canh "dải bọc ĐÚNG MỘT `RevealItem`
   * cho cả dải" — đúng cho cơ chế cũ (dải là một vùng cuộn ngang có thanh cuộn riêng,
   * và nó cần một nhịp vào như mọi khu khác). Từ 5o dải chạy theo TIẾN ĐỘ CUỘN TRANG
   * trong một khung sticky, nên:
   *
   *  · **Nhịp của dải LÀ phép cuộn.** Không cần thêm một nhịp vào 16px nữa.
   *  · Một `RevealItem` ở đây sẽ ghi `transform` lên ĐÚNG phần tử mà cơ chế mới điều
   *    khiển vị trí — hai thứ tranh nhau.
   *  · Và cái bẫy 5n phát hiện (`IntersectionObserver` cắt qua chuỗi tổ tiên có clip
   *    nên ô 4–6 của một dải `overflow-x-auto` không bao giờ giao với root → phần tử
   *    kẹt ở `initial` VĨNH VIỄN, kể cả ở `prefers-reduced-motion: reduce`) **tan
   *    cùng cơ chế cũ**: không còn `initial` nào trong dải để mà kẹt.
   *
   * Bất biến mới cần canh là chính cơ chế: dải phải được lái bằng `scrollLeft` (KHÔNG
   * phải `transform` như Home — xem JSDoc `LanternsSection` cho hai lỗ của transform),
   * và tiến độ phải đọc từ hộp cao 180vh.
   */
  it('dải cuộn ngang KHÔNG bọc nhịp nào — nhịp của nó LÀ phép cuộn trang', () => {
    const code = codeOf('../components/destinations/region-gallery.tsx');
    // Khối `LanternsSection` — từ tên hàm tới hết `PanoramaLayout` đứng sau nó.
    const lanterns = code.slice(
      code.indexOf('function LanternsSection'),
      code.indexOf('function PanoramaLayout'),
    );
    expect(lanterns).not.toContain('<RevealItem');
    // Cơ chế: ghi `scrollLeft` theo tiến độ, không ghi `style.transform`.
    expect(lanterns).toContain('scrollLeft');
    expect(lanterns).not.toMatch(/style\.transform/);
    expect(lanterns).toContain('h-[180vh]');
    // Vế BÀN PHÍM của cùng cơ chế, và nó là lý do chọn `scrollLeft` thay `transform`:
    // ô đang focus phải kéo được vào tầm. Đo 30/07: Tab tới ô 4 thì Chromium để nó kẹt
    // 252px ngoài mép và không tự cuộn, nên dải phải tự lo — bỏ listener này là quay
    // về đúng chỗ đó mà không có gì báo.
    expect(lanterns).toContain("'focusin'");
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
