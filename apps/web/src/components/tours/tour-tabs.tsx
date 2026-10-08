'use client';

import { messages } from '@tourism/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { revealScrollLeft, scrollEdges } from '@/lib/scroll-strip';

/**
 * Vỏ 5 tab của trang chi tiết tour — dựng bám `.tabs` / `.tablist` / `.tab` /
 * `.pane` của wireframe đã duyệt; số đo trích bằng máy, xem spec §2.3.
 *
 * HAI ràng buộc của [ADR-0022], cả hai đều KHÔNG phải sở thích:
 *
 * 1. **Render đủ 5 panel, chỉ ẩn đi** (`keepMounted` của Base UI đặt thuộc tính
 *    `hidden` chứ không tháo khỏi cây). Trang này là SSG và nằm trong sitemap;
 *    kiểu tab "chỉ mount panel đang mở" sẽ khiến lịch trình — nội dung chính của
 *    một tour — biến mất khỏi HTML mà crawler nhận được.
 * 2. **Đồng bộ hash URL.** Trang cũ có mục lục trỏ `#itinerary`, `#departures`…
 *    Chuyển sang tab là gãy hết anchor đó nếu không đồng bộ, và mất luôn khả
 *    năng gửi link tới đúng phần.
 *
 * Ghi hash bằng `replaceState`, KHÔNG gán `location.hash`: gán trực tiếp đẩy một
 * mục vào lịch sử mỗi lần đổi tab, người dùng xem hết 5 tab rồi bấm Back sẽ phải
 * bấm 5 lần mới rời được trang.
 *
 * **Dưới 640px dải tab cuộn NGANG trong hàng của nó** (chốt với user 08/10).
 * Wireframe chỉ vẽ desktop: năm tab cộng bốn khe cần 430px, mà ở viewport 375
 * khung chỉ còn 279px (thân trang đệm `px-12`). Dải tràn ra x=402 và kéo cả
 * trang cuộn ngang được. Bỏ khe hay hạ chữ xuống 12px cũng không vừa (334px và
 * ~286px). Nên dưới 640px dải thành vùng cuộn native, thanh cuộn ẩn, mép nào
 * còn tab bị che thì mép đó mờ dần, và tab đang mở luôn được cuộn ra khỏi vùng
 * mờ. Từ 640px trở lên không lớp nào đổi: 5 tab chia đều, 192px ở khung 1056.
 *
 * Các số đo trên là lúc thân trang còn đệm `px-12` ở mọi khổ. Từ G26 đệm 48 chỉ
 * áp từ `lg`, dưới `md` là `px-4`, nên khung ở 375 rộng 343px (đo lại 08/10):
 * dải 429px vẫn thiếu 86px, vẫn phải cuộn.
 */
const TAB_ORDER = ['overview', 'itinerary', 'departures', 'reviews', 'goodToKnow'] as const;

type TabKey = (typeof TAB_ORDER)[number];

/** Khoá tab → mảnh hash trên URL. Tách bảng riêng vì `goodToKnow` (camelCase của
    i18n) không thể là hash — hash phải đọc được và gõ tay được. */
const TAB_HASH: Record<TabKey, string> = {
  overview: 'overview',
  itinerary: 'itinerary',
  departures: 'departures',
  reviews: 'reviews',
  goodToKnow: 'good-to-know',
};

/** `.pane.narrow` của wireframe chỉ gắn cho MỘT tab: lịch trình là văn xuôi theo
    mốc giờ, đọc hết bề ngang 1056 thì dòng dài quá tầm mắt. Bốn tab còn lại là
    thẻ và bảng — chúng cần trọn bề ngang. */
const NARROW_PANES: ReadonlySet<TabKey> = new Set<TabKey>(['itinerary']);

/** Bề rộng vùng mờ ở mép dải khi cuộn. PHẢI khớp `2rem` trong hai lớp
    `mask-*-from-[calc(100%-2rem)]` của `TabsList` bên dưới: tab đang mở được
    cuộn ra khỏi đúng vùng ấy, lệch nhau thì tab dừng lại vẫn còn mờ một mép. */
const EDGE_FADE_PX = 32;

function tabFromHash(hash: string): TabKey | null {
  const clean = hash.replace(/^#/, '');
  return TAB_ORDER.find((key) => TAB_HASH[key] === clean) ?? null;
}

/**
 * Mép nào của dải còn tab bị che, tính lại mỗi khi dải cuộn hoặc đổi kích thước.
 * ResizeObserver theo dõi cả dải LẪN từng tab: font nạp xong làm tab rộng ra
 * trong khi dải giữ nguyên kích thước, chỉ theo dõi dải là bỏ lỡ.
 */
function useStripEdges(ref: RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const sync = () => {
      const next = scrollEdges(list);
      // Giữ object cũ khi không đổi: `scroll` bắn liên tục trong lúc vuốt, mỗi
      // object mới là một lần render thừa.
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    sync();
    list.addEventListener('scroll', sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(list);
    for (const tab of Array.from(list.children)) observer.observe(tab);
    return () => {
      list.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [ref]);

  return edges;
}

export function TourTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const t = messages.tourDetail.tabs;
  const [value, setValue] = useState<TabKey>(TAB_ORDER[0]);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLElement | null>>>({});
  const edges = useStripEdges(listRef);
  const overflowing = edges.start || edges.end;

  // Tab đang mở luôn lộ ra khỏi vùng mờ: vào trang bằng `#good-to-know` ở điện
  // thoại thì tab ấy nằm ngoài khung. Cộng thẳng vào `scrollLeft` chứ không gọi
  // `scrollIntoView`: cái sau tự chọn cả trục dọc nên có thể kéo cả trang (cùng
  // lý do ở `region-gallery.tsx`). Cuộn mượt hay nhảy thẳng do CSS quyết
  // (`motion-safe:scroll-smooth`), nên máy bật giảm chuyển động thì nhảy thẳng.
  // Dải không tràn (desktop) thì phép tính trả về đúng vị trí cũ, không gán gì.
  useEffect(() => {
    const list = listRef.current;
    const tab = tabRefs.current[value];
    if (!list || !tab) return;
    const box = list.getBoundingClientRect();
    const item = tab.getBoundingClientRect();
    // Vị trí màn hình của tab đã trừ phần dải cuộn mất; cộng lại để ra toạ độ
    // trong hệ cuộn.
    const itemStart = item.left - box.left + list.scrollLeft;
    const next = revealScrollLeft({
      scrollLeft: list.scrollLeft,
      scrollWidth: list.scrollWidth,
      clientWidth: list.clientWidth,
      itemStart,
      itemEnd: itemStart + item.width,
      fade: EDGE_FADE_PX,
    });
    if (next !== list.scrollLeft) list.scrollLeft = next;
  }, [value]);

  // Đọc hash trong effect chứ không lúc khởi tạo state: component render cả ở
  // phía server (RSC bọc client island), nơi `window` không tồn tại. Hash lạ rơi
  // về tab đầu — không để trang trống vì một anchor gõ sai.
  useEffect(() => {
    function syncFromHash() {
      const fromHash = tabFromHash(window.location.hash);
      if (fromHash) setValue(fromHash);
    }
    syncFromHash();
    // Nghe `hashchange` chứ không chỉ đọc một lần lúc mount: link trong trang
    // trỏ `#itinerary`, `#good-to-know` (thẻ policy ở panel đặt chỗ, link trong
    // card dữ kiện) phải mở được đúng tab. Không có listener này thì URL đổi mà
    // tab đứng yên — người dùng bấm rồi thấy không có gì xảy ra.
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  function onValueChange(next: unknown) {
    const key = next as TabKey;
    setValue(key);
    window.history.replaceState(null, '', `#${TAB_HASH[key]}`);
  }

  return (
    // `.tabs { margin-top: 48px }`
    <Tabs value={value} onValueChange={onValueChange} className="mt-12 gap-0">
      {/* Vỏ này CHỈ có việc dưới 640px: mang đường kẻ đáy thay cho `TabsList`.
          Lúc ấy dải là vùng cuộn có mask mờ mép, mà mask làm mờ mọi thứ vẽ trên
          phần tử, kể cả viền của chính nó. Kẻ đáy dời ra vỏ thì đường kẻ chạy
          nét suốt bề ngang, chỉ chữ ở mép là mờ. Từ 640px trở lên vỏ không có
          viền nào, bố cục y như trước khi có nó. */}
      <div className="border-border max-sm:border-b">
        {/* `.tablist { display:flex; gap:24px; height:40px; border-bottom:1px }`.
            Chiều cao phải khai qua CHÍNH biến thể mà lớp gốc dùng
            (`group-data-horizontal/tabs:h-10`): lớp gốc của TabsList khai
            `…:h-8`, mà tailwind-merge không dedupe được hai lớp khác tiền tố
            biến thể — viết `h-10` trần thì 32px của thư viện vẫn thắng.

            Dưới 640px (`max-sm:`, xem JSDoc đầu file):
              • `overflow-x-auto` + `scrollbar-none`: cuộn native, thanh cuộn
                ẩn. Tab giữ `flex-1` nên khung đủ rộng thì vẫn chia đều, thiếu
                chỗ thì co về đúng bề rộng chữ và dải cuộn.
              • `justify-start`: lớp gốc có `justify-center`, mà nội dung căn
                giữa trong vùng cuộn tràn đều HAI phía. Phần tràn bên trái nằm
                ở toạ độ âm, `scrollLeft` không với tới: đo 08/10 ở 375,
                Overview nằm ở x=−75 và mất hẳn. Khung đủ rộng thì tab `flex-1`
                đã lấp kín hàng, nên căn trái không đổi gì.
              • `border-b-0` + cao 39px: kẻ đáy dời ra vỏ ngoài (39 + 1 = 40,
                vẫn đúng chiều cao `.tablist`). Cao khai qua cùng tiền tố biến
                thể với `h-10`, cùng lý do như trên.
              • `items-start`: tab 38px căn giữa khung 39px sẽ lệch xuống 0,5px,
                đẩy gạch chân (`bottom:-1px`) lấn 0,5px qua mép khung và bị vùng
                cuộn cắt mất. Căn sát trên thì gạch chân nằm 37–39, chạm đúng
                đường kẻ của vỏ như wireframe.
              • mask mờ 2rem ở mép nào có `data-overflow-*`: hook đặt thuộc tính
                theo vị trí cuộn, chỉ mép còn tab bị che mới mờ.
              • `motion-safe:scroll-smooth`: lệnh cuộn tab đang mở ra (effect ở
                trên) trượt mượt; máy bật giảm chuyển động thì nhảy thẳng.
            `data-lenis-prevent` chỉ gắn khi dải tràn, như `route-ribbon.tsx`:
            gắn vô điều kiện thì desktop mất cuộn mượt mỗi lần lăn chuột qua
            dải, dù dải chẳng có gì để cuộn. */}
        <TabsList
          ref={listRef}
          variant="line"
          data-overflow-start={edges.start ? '' : undefined}
          data-overflow-end={edges.end ? '' : undefined}
          data-lenis-prevent={overflowing ? '' : undefined}
          className="w-full gap-6 rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-10 max-sm:items-start max-sm:justify-start max-sm:overflow-x-auto max-sm:scrollbar-none max-sm:border-b-0 max-sm:group-data-horizontal/tabs:h-[39px] max-sm:motion-safe:scroll-smooth max-sm:data-[overflow-start]:mask-l-from-[calc(100%-2rem)] max-sm:data-[overflow-end]:mask-r-from-[calc(100%-2rem)]"
        >
          {TAB_ORDER.map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              // Effect cuộn tab đang mở ra cần đo đúng phần tử của tab ấy.
              ref={(element: HTMLElement | null) => {
                tabRefs.current[key] = element;
              }}
              // `.tab`: flex:1 · h38 · pad 2px 0 12px · 14/20 w500 · muted →
              // foreground khi mở.
              //
              // GẠCH CHÂN DÙNG LUÔN `::after` CỦA THƯ VIỆN, chỉ sửa hai thứ, và
              // phải sửa BẰNG ĐÚNG TIỀN TỐ BIẾN THỂ mà thư viện dùng:
              //   • vị trí: thư viện đặt `group-data-horizontal/tabs:after:bottom-[-5px]`
              //     (gạch trôi hẳn 5px dưới list vì biến thể `line` gốc không có
              //     viền đáy). Wireframe muốn gạch NẰM TRÙNG lên đường kẻ nối dài
              //     giữa 5 tab → `bottom:-1px`.
              //   • màu: thư viện dùng `after:bg-foreground` (gần đen); wireframe
              //     dùng `--primary`.
              // Viết `data-selected:after:*` như bản trước là KHÔNG ăn:
              // tailwind-merge không dedupe hai lớp khác tiền tố biến thể nên bản
              // của thư viện vẫn thắng — cùng lớp lỗi với chiều cao của `TabsList`.
              // Không cần tự bật/tắt: thư viện đã lo bằng
              // `…data-active:after:opacity-100`.
              className="relative h-[38px] flex-1 gap-0 rounded-none px-0 pt-0.5 pb-3 text-sm leading-[20px] font-medium text-muted-foreground after:bg-primary data-selected:bg-transparent data-selected:text-foreground data-selected:shadow-none group-data-horizontal/tabs:after:bottom-[-1px]"
            >
              {t[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {TAB_ORDER.map((key) => (
        <TabsContent
          key={key}
          value={key}
          keepMounted
          data-narrow={NARROW_PANES.has(key) ? 'true' : undefined}
          // `.pane { margin-top:24px; font-size:14px; line-height:23px }`
          // `animate-pane-in`: keyframe ở globals.css, khởi động lại mỗi lần
          // panel thôi `hidden` (nhóm motion 1, 19/08).
          className={`animate-pane-in mt-6 text-sm leading-[23px] ${NARROW_PANES.has(key) ? 'max-w-3xl' : ''}`}
        >
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
