import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ArrowRightIcon } from 'lucide-react';
import type { MockDestination, MockRegion } from '@/mocks/types';

/**
 * Thẻ vùng của landing page `/destinations` — một trong "3 thẻ vùng" (khu 2/4
 * của spec §5.1). Mỗi thẻ mang tint riêng qua `data-region` trên gốc thẻ:
 * `tokens.css` gán `--region-primary` · `--region-surface` · `--region-on-surface`
 * cho cây con theo `[data-region='…']`, nên KHÔNG cần hex ở đây.
 *
 * Ba việc thẻ phải làm trung thực (spec §5.1 + §4.2):
 *  1. Số tour là của VÙNG (`tourCount`, đã dẫn xuất distinct ở `toursInRegion()`
 *     phía gọi) — KHÔNG cộng dồn `destinations[].tourCount`, vì một tour có thể
 *     chạm nhiều địa điểm trong cùng vùng (`ha-long-bay-cruise` chạm cả Hạ Long
 *     lẫn Ninh Bình).
 *  2. Mỗi địa điểm là LINK sang trang lọc tour CÓ THẬT (`/tours?destinations=`),
 *     không phải trang `/destinations/[region]/[place]` — trang đó không tồn tại.
 *  3. CTA vào trang vùng dùng SLUG url (`northern-vietnam`), không dùng `key`
 *     token (`north`) — hai khoá phục vụ hai việc khác nhau, xem `MockRegion`.
 */
export function RegionCard({
  region,
  destinations,
  tourCount,
}: {
  region: MockRegion;
  destinations: MockDestination[];
  tourCount: number;
}) {
  const t = messages.destinationsPage;

  return (
    <article
      data-region={region.key}
      className="relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6"
    >
      {/* Dải accent mỏng trên đầu thẻ — dùng `--region-primary`, tín hiệu tint
          đầu tiên người xem gặp trước khi đọc chữ. */}
      <span
        aria-hidden="true"
        style={{ background: 'var(--region-primary)' }}
        className="absolute inset-x-0 top-0 h-1.5"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-2xl font-medium text-foreground">{region.name}</h3>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{region.tagline}</p>
        </div>
        {/* Chip số tour — tint `--region-surface` / `--region-on-surface`. */}
        <span
          style={{ background: 'var(--region-surface)', color: 'var(--region-on-surface)' }}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap"
        >
          {t.toursLabel(tourCount)}
        </span>
      </div>

      <div>
        <p className="font-mono text-[0.625rem] tracking-widest text-muted-foreground uppercase">
          {t.placesLabel}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {destinations.map((dest) => (
            <li key={dest.slug}>
              <a
                href={`/tours?destinations=${dest.slug}`}
                className="flex items-center justify-between gap-2 text-sm text-foreground transition-colors hover:text-primary"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    style={{ background: 'var(--region-primary)' }}
                    className="size-1.5 shrink-0 rounded-full"
                  />
                  {dest.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.toursLabel(dest.tourCount)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA vùng — nền chính là `--region-primary` nên mỗi thẻ có một nút
          "màu riêng". `ButtonLink`, KHÔNG `Button render={<a/>}`: mẫu đó gắn
          `role="button"` lên anchor và đè mất role `link`. */}
      <ButtonLink
        href={`/destinations/${region.slug}`}
        style={{ background: 'var(--region-primary)' }}
        className="mt-auto w-fit text-white hover:opacity-90"
      >
        {t.exploreRegion(region.name)}
        <ArrowRightIcon aria-hidden="true" className="size-4" />
      </ButtonLink>
    </article>
  );
}
