import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { regionTheme } from '@/lib/region-theme';
import { REGIONS } from '@/mocks/regions';
import { RegionGallery, TILE_COUNT } from './region-gallery';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu API này là ném ReferenceError lúc
  // mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù vài spec khác có bản y
  // hệt: đã đo — dời lên setup chung làm **19 test ở 3 file khác gãy**, vì có
  // global này thì framer-motion đi nhánh khác hẳn so với khi không có.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 phần tử ở module scope
const NORTH = REGIONS[0]!;
// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 vùng ở mocks
const SOUTH = REGIONS[2]!;

const t = messages.regionPage;

function tiles(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>('[data-gallery-tile]')];
}

/** Số trong `h-44` / `sm:pt-8` là đơn vị 0.25rem, nên so sánh SỐ đó là so sánh
    chiều cao thật theo tỉ lệ — đủ để canh các bất biến hình khối của `peaks`. */
function scale(className: string, prefix: string): number {
  const match = className.match(new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`));
  return match?.[1] ? Number(match[1]) : Number.NaN;
}

/**
 * Bấm một ô rồi chờ focus RƠI VÀO trong lightbox.
 *
 * Chờ focus, không chỉ chờ dialog xuất hiện: Base UI dời focus trong một effect
 * chạy SAU khi popup vào DOM, nên `findByRole` về trước cuộc đua đó và mũi tên
 * bàn phím bắn vào ô gallery (nằm NGOÀI portal) thì `DialogContent` không nhận
 * được. Cùng cái bẫy đã đo ở `media/lightbox.spec.tsx`.
 */
async function openTile(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return dialog;
}

describe('RegionGallery — ba bố cục, một khu', () => {
  it('tiêu đề nêu tên vùng', () => {
    render(<RegionGallery region={NORTH} variant="peaks" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Northern Vietnam in photos' }),
    ).toBeInTheDocument();
  });

  // User nêu *"ảnh quá nhỏ"* ở bản 5k (8 · 10 · 3 ô). Ít ô hơn là ĐIỀU KIỆN để ô
  // to hẳn ra trong cùng bề ngang, nên số ô là thứ phải khoá lại.
  it('mỗi biến thể dùng đúng số ô đã chốt: peaks 6 · lanterns 6 · panorama 3', () => {
    expect(TILE_COUNT).toEqual({ peaks: 6, lanterns: 6, panorama: 3 });
    for (const [variant, count] of Object.entries(TILE_COUNT)) {
      const { container, unmount } = render(
        <RegionGallery region={NORTH} variant={variant as keyof typeof TILE_COUNT} />,
      );
      expect(tiles(container), variant).toHaveLength(count);
      unmount();
    }
  });

  it('nhãn ô lấy từ danh sách của CHÍNH vùng, không bịa thêm nhãn', () => {
    const { container } = render(<RegionGallery region={SOUTH} variant="panorama" />);
    const labels = tiles(container).map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual(
      t.regions.south.galleryTiles.map((label) => t.galleryLightbox.open(label)),
    );
  });

  // Chốt chặn cho chính lỗi vừa vá: trước 30/07 ba vùng cắt cùng đầu MỘT danh sách
  // dùng chung, nên chú thích ba gallery giống hệt nhau và vài nhãn thuộc vùng
  // khác (trang Bắc chú thích "Lantern-lit old town" — Hội An, miền Trung).
  it('ba vùng KHÔNG dùng chung một nhãn nào', () => {
    const all = REGIONS.flatMap((region) => t.regions[region.key].galleryTiles);
    expect(new Set(all).size).toBe(all.length);
  });

  // Nhãn phải dài ĐÚNG số ô của biến thể vùng đó dùng: thiếu thì `slice` để lại ô
  // không nhãn (component bỏ ô đó, gallery thiếu ảnh), thừa thì nhãn bị cắt âm thầm.
  it('mỗi vùng có đúng số nhãn bằng số ô của biến thể mình dùng', () => {
    for (const region of REGIONS) {
      const variant = regionTheme(region.key).galleryVariant;
      expect(t.regions[region.key].galleryTiles, region.key).toHaveLength(TILE_COUNT[variant]);
    }
  });

  it('không ô nào lặp nhãn — mỗi ô là một cảnh khác', () => {
    for (const variant of ['peaks', 'lanterns', 'panorama'] as const) {
      const { container, unmount } = render(<RegionGallery region={NORTH} variant={variant} />);
      const labels = tiles(container).map((el) => el.getAttribute('aria-label'));
      expect(labels, variant).toHaveLength(TILE_COUNT[variant]);
      expect(new Set(labels).size, variant).toBe(labels.length);
      unmount();
    }
  });

  // "Mỗi miền BẮT BUỘC có gallery riêng — khác BỐ CỤC chứ không chỉ khác số ô" là
  // ràng buộc user chốt. Peaks và lanterns nay CÙNG 6 ô, nên số ô một mình không
  // còn phân biệt được ba biến thể; móc cấu trúc mới là thứ canh được.
  it('mỗi biến thể dựng đúng MỘT hình khối, không lẫn sang hình của biến thể khác', () => {
    const MARKERS = {
      peaks: '[data-peak-column]',
      lanterns: '[data-gallery-scroll]',
      panorama: '[data-panorama-lead]',
    } as const;
    for (const variant of ['peaks', 'lanterns', 'panorama'] as const) {
      const { container, unmount } = render(<RegionGallery region={NORTH} variant={variant} />);
      for (const [owner, selector] of Object.entries(MARKERS)) {
        const found = container.querySelectorAll(selector).length;
        if (owner === variant) expect(found, `${variant}/${owner}`).toBeGreaterThan(0);
        else expect(found, `${variant}/${owner}`).toBe(0);
      }
      unmount();
    }
  });
});

describe('RegionGallery — ô là nút mở lightbox', () => {
  it('mỗi ô là <button> có tên khả truy cập gọi tên cảnh', () => {
    render(<RegionGallery region={NORTH} variant="peaks" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    const first = t.regions.north.galleryTiles[0]!;
    const button = screen.getByRole('button', { name: t.galleryLightbox.open(first) });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  // Ô có `overflow-hidden` (gradient phải bị bo góc cắt), nên vòng focus VẼ RA
  // NGOÀI sẽ bị chính ô cắt mất — bàn phím tab qua gallery mà không thấy mình
  // đang ở đâu. `-outline-offset` kéo vòng vào TRONG ô.
  it('vòng focus vẽ INSET — ô có overflow-hidden nên vòng ngoài bị cắt', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    expect(tiles(container)).toHaveLength(TILE_COUNT.peaks);
    for (const tile of tiles(container)) {
      expect(tile.className).toMatch(/(^|\s)focus-visible:-outline-offset-2(\s|$)/);
      expect(tile.className).toContain('overflow-hidden');
    }
  });

  it('zoom hover có guard motion-reduce ở CẢ transition lẫn scale', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    expect(tiles(container)).toHaveLength(TILE_COUNT.lanterns);
    for (const tile of tiles(container)) {
      const inner = tile.firstElementChild?.className ?? '';
      expect(inner).toContain('group-hover:scale-105');
      expect(inner).toContain('motion-reduce:transition-none');
      expect(inner).toContain('motion-reduce:group-hover:scale-100');
    }
  });

  it('bấm ô thứ ba mở lightbox ở ĐÚNG ảnh đó', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="peaks" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    const third = t.regions.north.galleryTiles[2]!;
    await openTile(user, t.galleryLightbox.open(third));
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
  });

  it('lightbox nói bằng copy của TRANG VÙNG, không copy của trang tour', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="panorama" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    const first = t.regions.north.galleryTiles[0]!;
    await openTile(user, t.galleryLightbox.open(first));
    expect(screen.getByText(t.galleryLightbox.dialogTitle)).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: t.galleryLightbox.close })).toBeInTheDocument();
  });

  it('chú thích trong lightbox nêu cảnh của ĐÚNG ô đang xem', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="panorama" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    const second = t.regions.north.galleryTiles[1]!;
    await openTile(user, t.galleryLightbox.open(second));
    // Đúng MỘT lần: nhãn ở chú thích, không lặp lại làm `aria-label` của ô ảnh
    // trong dialog — ô đó là `decorative` chính vì thế.
    expect(screen.getAllByText(second)).toHaveLength(1);
  });

  it('mũi tên phải/trái đổi ảnh', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="lanterns" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    await openTile(user, t.galleryLightbox.open(t.regions.north.galleryTiles[1]!));
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
  });

  it('KHÔNG cuộn vòng: nút vô hiệu ở hai đầu', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="panorama" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    await openTile(user, t.galleryLightbox.open(t.regions.north.galleryTiles[0]!));
    expect(screen.getByRole('button', { name: t.galleryLightbox.previous })).toBeDisabled();
    const next = screen.getByRole('button', { name: t.galleryLightbox.next });
    await user.click(next);
    await user.click(next);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it('Escape đóng lightbox', async () => {
    const user = userEvent.setup();
    render(<RegionGallery region={NORTH} variant="peaks" />);
    // biome-ignore lint/style/noNonNullAssertion: galleryTiles của north là hằng 6 mục
    await openTile(user, t.galleryLightbox.open(t.regions.north.galleryTiles[0]!));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('RegionGallery — hình khối của peaks', () => {
  // Đường viền TRÊN của dải là thứ gợi dãy núi, nên ba cột phải có ba khoảng lệch
  // KHÁC nhau. Ba cột cùng một offset là ba cột thẳng hàng, tức mất hẳn hình.
  it('dựng ba cột với ba khoảng lệch dọc khác nhau', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const columns = [...container.querySelectorAll('[data-peak-column]')];
    expect(columns).toHaveLength(3);
    const offsets = columns.map((el) => scale(el.className, 'sm:pt'));
    expect(new Set(offsets).size).toBe(3);
  });

  // Lỗi user nêu ở 5k: *"lệch quá nhẹ nên đọc ra một lưới, không ra dãy núi"*.
  // Chênh lệch chiều cao trong hàng trên phải MẠNH, không chỉ khác nhau.
  it('hàng trên chênh chiều cao MẠNH — ô cao nhất gấp ≥1.5 lần ô thấp nhất', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const top = tiles(container)
      .filter((el) => el.dataset.peakRow === '0')
      .map((el) => scale(el.className, 'sm:h'));
    expect(top).toHaveLength(3);
    expect(Math.max(...top) / Math.min(...top)).toBeGreaterThanOrEqual(1.5);
  });

  it('ô CAO NHẤT của hàng trên nằm ở cột GIỮA', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const top = tiles(container).filter((el) => el.dataset.peakRow === '0');
    const heights = top.map((el) => scale(el.className, 'sm:h'));
    expect(heights.indexOf(Math.max(...heights))).toBe(1);
  });

  // "Hàng dưới lệch pha với hàng trên": nếu cột giữa cao nhất ở CẢ HAI hàng thì
  // dải chỉ là một cột phình ra giữa một lưới, không phải một đường chân trời.
  it('ô CAO NHẤT của hàng dưới KHÔNG ở cột giữa — hai hàng lệch pha', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const bottom = tiles(container).filter((el) => el.dataset.peakRow === '1');
    const heights = bottom.map((el) => scale(el.className, 'sm:h'));
    expect(heights).toHaveLength(3);
    expect(heights.indexOf(Math.max(...heights))).not.toBe(1);
  });

  // Bất biến hình: đáy dải THẲNG trong khi đỉnh dải RĂNG CƯA. Nếu cả hai mép đều
  // so le thì dải đọc thành một khảm xếp lỗi chứ không thành đường chân trời. Cột
  // nào sửa chiều cao thì phải sửa `sm:pt-*` bù lại đúng số đó — trước đây luật
  // này chỉ nằm trong comment và không có gì canh.
  it('ba cột cao BẰNG NHAU (pad + ô trên + gap + ô dưới) — đáy dải thẳng', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const columns = [...container.querySelectorAll<HTMLElement>('[data-peak-column]')];
    const gap = scale(columns[0]?.className ?? '', 'sm:gap');
    expect(gap).not.toBeNaN();
    const totals = columns.map((column) => {
      const heights = [...column.querySelectorAll<HTMLElement>('[data-gallery-tile]')].map((el) =>
        scale(el.className, 'sm:h'),
      );
      return scale(column.className, 'sm:pt') + heights.reduce((a, b) => a + b, 0) + gap;
    });
    expect(new Set(totals).size, `totals=${totals.join(',')}`).toBe(1);
  });
});

/**
 * ⚠️ Bốn khẳng định của bản trước ĐÃ CHẾT cùng cơ chế cũ (Task 5o) — chúng được SUY
 * LẠI ở đây, không bị xoá cho xanh:
 *
 *  1. *"có snap, và trả wheel về cho Lenis"* — `data-lenis-prevent` làm điều NGƯỢC
 *     LẠI cơ chế mới (dải chạy VÌ trang cuộn, nên wheel phải về cho trang), và snap
 *     tranh với phép ghi `scrollLeft` từng khung hình. Cả hai thành khẳng định VẮNG.
 *  2. *"âm lề bleed khớp đúng padding từng bậc"* — khung sticky đã rộng bằng viewport
 *     nên không còn gì để bleed. Thứ còn phải canh là gutter của dải khớp gutter của
 *     header, tức ô đầu vẫn thẳng hàng với khối tiêu đề.
 *  3. *"mỗi ô là điểm snap"* — theo (1).
 *  4. *"mỗi biến thể dựng đúng MỘT hình khối"* dùng `[data-gallery-scroll]` làm móc
 *     của `lanterns`; móc đó GIỮ nguyên tên nên test kia còn sống.
 */
describe('RegionGallery — hình khối của lanterns', () => {
  function frame(container: HTMLElement) {
    return container.querySelector<HTMLElement>('section > .sticky');
  }

  /**
   * User yêu cầu: *"làm giống với ở trang Home chỗ mà người dùng phải cuộn để xem các
   * địa điểm … rồi loại bỏ thanh cuộn ngang nằm phía dưới"*. Khuôn ở
   * `home/gallery.tsx`: section cao 180vh bọc một khung `sticky top-0 h-screen
   * overflow-hidden`, header nằm TRONG khung nên nó đứng yên suốt hành trình.
   */
  it('dựng khung sticky trong section cao 180vh — dải chạy theo tiến độ cuộn TRANG', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('h-[180vh]');
    const sticky = frame(container);
    expect(sticky).not.toBeNull();
    expect(sticky?.className).toContain('top-0');
    expect(sticky?.className).toContain('h-screen');
    // `overflow-hidden` theo đúng khuôn Home, và ở đây nó là hàng rào chống TRÀN DỌC:
    // khung cao đúng 100vh nên nếu ô cao hơn phần còn lại thì nó sẽ đè sang khu kế
    // tiếp. (Thân trang không cuộn ngang được là nhờ `overflow-x-auto` của chính dải,
    // không nhờ lớp này — đo ở 1440/1280/768/390: `scrollWidth === clientWidth`.)
    expect(sticky?.className).toContain('overflow-hidden');
    // Và vì khung CẮT, ô phải có trần cao theo viewport — nếu không thì ở 1280×720
    // đáy ô chỉ hở 4px và một tiêu đề hai dòng là mất đáy. Đo được, không phòng xa.
    for (const tile of tiles(container)) {
      expect(tile.className).toMatch(/max-h-\[calc\(100vh-\d+rem\)\]/);
    }
    // Header phải nằm TRONG khung sticky, không ở trên nó: đó là điều làm tiêu đề
    // đứng yên trong khi dải chạy.
    const heading = screen.getByRole('heading', { level: 2 });
    expect(sticky?.contains(heading)).toBe(true);
    // Và vùng cuộn cũng ở trong khung đó.
    expect(sticky?.querySelector('[data-gallery-scroll]')).not.toBeNull();
  });

  /**
   * Vùng cuộn giữ NATIVE (`overflow-x-auto`) chứ không đổi sang `transform` như Home,
   * vì `transform` có hai lỗ mà trang vùng (SSG, ô là `<button>` mở lightbox) không
   * chịu được: JS tắt thì ô 4–6 KHÔNG BAO GIỜ tới được, và Tab bàn phím thì focus rơi
   * ra ngoài khung `overflow-hidden` nên người dùng không thấy mình đang ở đâu (WCAG
   * 2.4.11). Thanh cuộn chỉ bị ẨN, nên thứ user muốn bỏ vẫn bỏ được.
   *
   * `data-lenis-prevent` phải VẮNG: nó tồn tại để wheel cuộn DẢI thay vì trang, mà cơ
   * chế mới là *cuộn trang để dải chạy* — giữ nó lại là làm đúng điều ngược lại.
   */
  it('cuộn ngang NATIVE, thanh cuộn bị ẩn, và wheel trả về cho trang', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const scroller = container.querySelector('[data-gallery-scroll]');
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain('overflow-x-auto');
    expect(scroller?.className).toContain('scrollbar-none');
    expect(scroller?.hasAttribute('data-lenis-prevent')).toBe(false);
  });

  // Âm lề bleed biến mất cùng cơ chế cũ (khung sticky đã rộng bằng viewport). Nhưng
  // thứ nó phục vụ vẫn phải đúng: ô ĐẦU thẳng hàng với khối tiêu đề. Nên gutter của
  // dải phải khớp gutter của header ở TỪNG bậc.
  it('KHÔNG còn âm lề bleed; gutter của dải khớp gutter của header từng bậc', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const scroller = container.querySelector('[data-gallery-scroll]');
    expect(scroller?.className).not.toMatch(/(^|\s)-mx-/);
    const gutters = (className: string) =>
      Object.fromEntries(
        [...className.matchAll(/(?:^|\s)(?:(\w+):)?px-(\d+)(?=\s|$)/g)].map((m) => [
          m[1] ?? 'base',
          Number(m[2]),
        ]),
      );
    const heading = screen.getByRole('heading', { level: 2 });
    const headerBox = heading.closest('[data-gallery-header]');
    const header = gutters(headerBox?.className ?? '');
    const strip = gutters(scroller?.className ?? '');
    expect(Object.keys(header).length).toBeGreaterThan(1);
    for (const [breakpoint, value] of Object.entries(header)) {
      expect(strip[breakpoint], `gutter@${breakpoint}`).toBe(value);
    }
  });

  // Snap phải VẮNG: vị trí ngang của dải do phép ghi `scrollLeft` theo tiến độ cuộn
  // lái, và một điểm snap sẽ kéo dải về mốc gần nhất ngay sau mỗi lần ghi — hai thứ
  // tranh nhau cùng một con số. Ô vẫn rộng hẳn và vẫn `shrink-0`.
  it('ô KHÔNG snap nữa — scrollLeft và snap tranh nhau cùng một con số', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const scroller = container.querySelector('[data-gallery-scroll]');
    expect(scroller?.className).not.toMatch(/(^|\s)snap-x(\s|$)/);
    expect(tiles(container)).toHaveLength(TILE_COUNT.lanterns);
    for (const tile of tiles(container)) {
      expect(tile.className).not.toContain('snap-start');
      expect(tile.className).toContain('sm:w-[380px]');
      expect(tile.className).toContain('shrink-0');
    }
  });

  // Sợi dây đèn lồng là HÌNH của miền Trung (Hội An treo đèn so le trên một sợi dây
  // căng ngang lối) — nó phải sống qua đợt đổi cơ chế, và phải nằm TRONG vùng cuộn để
  // chạy hết bề dài dải.
  it('sợi dây đèn lồng còn nguyên — sáu đoạn treo dài ngắn xen kẽ trong dải', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const scroller = container.querySelector('[data-gallery-scroll]');
    expect(scroller?.className).toContain('border-t');
    const wires = [...(scroller?.querySelectorAll('span[aria-hidden="true"]') ?? [])];
    expect(wires).toHaveLength(TILE_COUNT.lanterns);
    expect(wires.map((w) => (w.className.includes('h-4') ? 'ngắn' : 'dài'))).toEqual([
      'ngắn',
      'dài',
      'ngắn',
      'dài',
      'ngắn',
      'dài',
    ]);
  });

  it('hai biến thể kia KHÔNG có vùng cuộn ngang và KHÔNG dùng khung sticky', () => {
    for (const variant of ['peaks', 'panorama'] as const) {
      const { container, unmount } = render(<RegionGallery region={NORTH} variant={variant} />);
      expect(container.querySelector('[data-gallery-scroll]'), variant).toBeNull();
      expect(container.querySelector('section')?.className, variant).not.toContain('h-[180vh]');
      expect(frame(container), variant).toBeNull();
      unmount();
    }
  });
});

describe('RegionGallery — hình khối của panorama', () => {
  // Bản 5k là ba ô 21/9 FULL-WIDTH chiếm ~1.695px, làm trang Nam dài 6.741px so
  // với 4.833/4.861 của hai miền kia. Bó `max-w-5xl` + gộp hai ô xuống một hàng
  // là cách cắt chiều cao đó mà ô lớn vẫn to hơn bất kỳ ô nào của bản cũ.
  it('bó trong max-w-5xl, hẹp hơn khung 7xl của phần đầu khu', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="panorama" />);
    // biome-ignore lint/style/noNonNullAssertion: test sẽ đỏ ở dòng trên nếu thiếu
    const lead = container.querySelector('[data-panorama-lead]')!;
    expect(lead.closest('.max-w-5xl')).not.toBeNull();
  });

  it('một ô LỚN trên, hai ô dưới', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="panorama" />);
    expect(container.querySelectorAll('[data-panorama-lead]')).toHaveLength(1);
    const row = container.querySelector('[data-panorama-row]');
    expect(row?.querySelectorAll('[data-gallery-tile]')).toHaveLength(2);
  });

  // Hai ô dưới KHÔNG bằng nhau: một cặp đối xứng dưới một ô lớn là đúng cái khảm
  // của trang chi tiết tour, và ba khu ảnh giống nhau thì mất phân hoá vùng. Bề
  // rộng lệch nhau còn là hình của thứ miền Nam bán — một dòng nước rẽ hai nhánh
  // không đều.
  it('hai ô dưới rộng KHÁC nhau — không phải cặp đối xứng', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="panorama" />);
    const row = container.querySelector('[data-panorama-row]');
    const spans = [...(row?.querySelectorAll<HTMLElement>('[data-gallery-tile]') ?? [])].map((el) =>
      scale(el.className, 'sm:col-span'),
    );
    expect(spans).toHaveLength(2);
    expect(spans[0]).not.toBe(spans[1]);
  });
});
