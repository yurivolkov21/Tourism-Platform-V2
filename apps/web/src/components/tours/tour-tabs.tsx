'use client';

import { messages } from '@tourism/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tourism/ui/components/tabs';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/**
 * Vỏ 5 tab của trang chi tiết tour (ADR-0022) — thay lưới `rail · main ·
 * booking` cũ, trong đó `rail` là mục lục dính `OnThisPage`.
 *
 * HAI ràng buộc của ADR, cả hai đều KHÔNG phải sở thích:
 *
 * 1. **Render đủ 5 panel, chỉ ẩn đi** (`keepMounted` của Base UI đặt thuộc tính
 *    `hidden` chứ không tháo khỏi cây). Trang này là SSG và nằm trong sitemap;
 *    kiểu tab "chỉ mount panel đang mở" sẽ khiến lịch trình — nội dung chính
 *    của một tour — biến mất khỏi HTML mà crawler nhận được.
 * 2. **Đồng bộ hash URL.** Trang cũ có mục lục trỏ `#itinerary`, `#departures`…
 *    Chuyển sang tab là gãy hết anchor đó nếu không đồng bộ, và mất luôn khả
 *    năng gửi link tới đúng phần.
 *
 * Ghi hash bằng `replaceState`, KHÔNG phải gán `location.hash`: gán trực tiếp
 * đẩy một mục vào lịch sử mỗi lần đổi tab, người dùng xem hết 5 tab rồi bấm
 * Back sẽ phải bấm 5 lần mới rời được trang.
 */
const TAB_ORDER = ['overview', 'itinerary', 'departures', 'reviews', 'goodToKnow'] as const;

type TabKey = (typeof TAB_ORDER)[number];

/** Khoá tab → mảnh hash trên URL. Tách bảng riêng vì `goodToKnow` (camelCase
    của i18n) không thể là hash — hash phải đọc được và gõ tay được. */
const TAB_HASH: Record<TabKey, string> = {
  overview: 'overview',
  itinerary: 'itinerary',
  departures: 'departures',
  reviews: 'reviews',
  goodToKnow: 'good-to-know',
};

function tabFromHash(hash: string): TabKey | null {
  const clean = hash.replace(/^#/, '');
  const found = TAB_ORDER.find((key) => TAB_HASH[key] === clean);
  return found ?? null;
}

export function TourTabs({ panels }: { panels: Record<TabKey, ReactNode> }) {
  const t = messages.tourDetail.tabs;
  const [value, setValue] = useState<TabKey>(TAB_ORDER[0]);

  // Đọc hash trong effect chứ không lúc khởi tạo state: component render cả ở
  // phía server (RSC bọc client island), nơi `window` không tồn tại. Hash lạ
  // rơi về tab đầu — không để trang trống vì một anchor gõ sai.
  useEffect(() => {
    function syncFromHash() {
      const fromHash = tabFromHash(window.location.hash);
      if (fromHash) setValue(fromHash);
    }
    syncFromHash();
    // Nghe `hashchange` chứ không chỉ đọc một lần lúc mount: các link trong
    // trang trỏ `#itinerary`, `#good-to-know` (thẻ policy ở panel đặt chỗ, link
    // trong card dữ kiện) phải mở được đúng tab. Không có listener này thì URL
    // đổi mà tab đứng yên — người dùng bấm rồi thấy không có gì xảy ra.
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  function onValueChange(next: unknown) {
    const key = next as TabKey;
    setValue(key);
    window.history.replaceState(null, '', `#${TAB_HASH[key]}`);
  }

  return (
    <Tabs value={value} onValueChange={onValueChange} className="mt-12 gap-0">
      {/* `w-full` + `flex-1` trên từng trigger: mẫu ReUI chia đều chiều ngang
          cho các tab. Viền đáy nằm ở LIST để đường kẻ chạy hết bề ngang, còn
          gạch chân của tab đang mở vẽ bằng `after` trên trigger. */}
      <TabsList
        variant="line"
        className="h-10 w-full gap-6 rounded-none border-b border-border bg-transparent p-0"
      >
        {TAB_ORDER.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="relative h-[38px] flex-1 rounded-none px-0 pt-0.5 pb-3 text-sm leading-[20px] font-medium text-muted-foreground data-selected:bg-transparent data-selected:text-foreground data-selected:shadow-none data-selected:after:absolute data-selected:after:inset-x-0 data-selected:after:-bottom-px data-selected:after:h-0.5 data-selected:after:bg-primary"
          >
            {t[key]}
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_ORDER.map((key) => (
        <TabsContent key={key} value={key} keepMounted className="mt-6">
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
