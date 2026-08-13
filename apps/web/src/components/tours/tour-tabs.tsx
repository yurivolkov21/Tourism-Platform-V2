'use client';

import { messages } from '@tourism/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

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

function tabFromHash(hash: string): TabKey | null {
  const clean = hash.replace(/^#/, '');
  return TAB_ORDER.find((key) => TAB_HASH[key] === clean) ?? null;
}

export function TourTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const t = messages.tourDetail.tabs;
  const [value, setValue] = useState<TabKey>(TAB_ORDER[0]);

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
      {/* `.tablist { display:flex; gap:24px; height:40px; border-bottom:1px }`.
          Chiều cao phải khai qua CHÍNH biến thể mà lớp gốc dùng
          (`group-data-horizontal/tabs:h-10`): lớp gốc của TabsList khai
          `…:h-8`, mà tailwind-merge không dedupe được hai lớp khác tiền tố biến
          thể — viết `h-10` trần thì 32px của thư viện vẫn thắng. */}
      <TabsList
        variant="line"
        className="w-full gap-6 rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-10"
      >
        {TAB_ORDER.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
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

      {TAB_ORDER.map((key) => (
        <TabsContent
          key={key}
          value={key}
          keepMounted
          data-narrow={NARROW_PANES.has(key) ? 'true' : undefined}
          // `.pane { margin-top:24px; font-size:14px; line-height:23px }`
          className={`mt-6 text-sm leading-[23px] ${NARROW_PANES.has(key) ? 'max-w-3xl' : ''}`}
        >
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
