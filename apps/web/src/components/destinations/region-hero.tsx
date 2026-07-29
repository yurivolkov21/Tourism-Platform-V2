import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ChevronRightIcon } from 'lucide-react';
import { RegionTile } from '@/components/destinations/region-tile';
import { regionTheme } from '@/lib/region-theme';
import type { MockRegion } from '@/mocks/types';

/**
 * Hero trang vùng — ảnh (ở đây là `RegionTile`) phủ toàn khu, scrim tối chồng
 * lên, nội dung nép đáy trái. Port thẳng `region-hero.tsx` của Nexora.
 *
 * ⚠️ KHÔNG dùng khuôn `bg-hero` + `<div className="dark contents">` như 4 hero
 * khác của repo, và đây là khác biệt CÓ CHỦ Ý chứ không phải bỏ sót: nền của khu
 * này không phải token theo-theme mà là một ô gradient phủ scrim — nó tối ở CẢ
 * hai theme. Chữ vì thế dùng `text-on-media`, token CỐ ĐỊNH đúng cặp với scrim.
 * Đặt `text-foreground` vào đây là chữ tàng hình ở một trong hai theme, và đặt
 * class `dark` vào đây là kéo nguyên bảng màu tối vào một khu vốn đã tối.
 *
 * `heroMinH` và `scrim` đến từ `regionTheme(key)` — mỗi vùng một "mood": Bắc cao
 * hơn và scrim đặc hơn, hai vùng kia thấp và nhẹ.
 *
 * `tagline` vào bằng PROP (page truyền từ `messages.regionPage.regions[key]`)
 * chứ component không tự tra i18n theo khoá vùng — mọi component khác của cụm
 * đều nhận dữ liệu qua prop, và như thế mới test được với fixture.
 */
export function RegionHero({ region, tagline }: { region: MockRegion; tagline: string }) {
  const theme = regionTheme(region.key);

  return (
    <section className={cn('relative isolate flex items-end overflow-hidden', theme.heroMinH)}>
      {/* `decorative`: nhãn ô sẽ là TÊN VÙNG, mà `<h1>` ngay dưới cũng là tên
          vùng — để `role="img"` ở đây là trình đọc màn hình đọc "Northern Vietnam"
          hai lần liền. Ô này là nền, không mang thông tin nào riêng. */}
      <RegionTile label={region.name} decorative className="absolute inset-0 -z-10 rounded-none" />
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 -z-10 bg-linear-to-t', theme.scrim)}
      />

      {/* Padding trên rộng hơn dưới: navbar trong suốt nằm đè lên đầu khu này. */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-36 pb-12 text-on-media md:px-16 md:pb-16 lg:px-24 xl:px-32">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-sm text-on-media/80"
        >
          <a href="/" className="transition-colors hover:text-on-media">
            Home
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <a href="/destinations" className="transition-colors hover:text-on-media">
            {messages.regionPage.backToAll}
          </a>
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          <span aria-current="page">{region.name}</span>
        </nav>

        <h1 className="mt-6 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance md:text-5xl">
          {region.name}
        </h1>

        {/* `tagline` chứ KHÔNG phải `intro`: intro là đoạn dẫn của khu ngay bên
            dưới, in cả hai chỗ là lặp nguyên một câu trên cùng một màn hình.
            Nguồn là `messages.regionPage.regions[key].tagline` (luật 7: copy
            user-facing tập trung ở `@tourism/i18n`) — bản mock từng có field
            `tagline` riêng, nó đã bị GỠ để không còn hai nguồn cho một câu. */}
        <p className="mt-4 max-w-2xl text-lg text-pretty text-on-media/85">{tagline}</p>
      </div>
    </section>
  );
}
