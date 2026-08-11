import { messages } from '@tourism/i18n';
import Link from 'next/link';

/**
 * "Ngăn kẹp trong hộ chiếu" (M1) — bản thu gọn của Saved: 3 thumbnail + đếm
 * tổng + link Open sang trang saved đầy đủ. Rỗng thì page ẨN cả khối (không
 * render component này) — ngăn kẹp trống không phải là tin.
 */
export function SavedTuck({
  items,
  total,
}: {
  items: Array<{ slug: string; title: string; image: string | null }>;
  total: number;
}) {
  const t = messages.passportHome;
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11.5px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          {t.savedHeading(total)}
        </p>
        <Link
          href="/account/saved"
          className="text-[13px] font-semibold text-primary-emphasis hover:underline"
        >
          {t.savedOpen}
        </Link>
      </div>
      <ul className="mt-2.5 flex gap-2">
        {items.slice(0, 3).map((item) => (
          <li key={item.slug}>
            {item.image ? (
              // biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa cấu hình remotePatterns — tiền lệ trip-card/checkout-summary).
              <img
                src={item.image}
                alt={item.title}
                className="h-[42px] w-14 rounded-lg object-cover"
              />
            ) : (
              <span aria-hidden="true" className="block h-[42px] w-14 rounded-lg bg-muted" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
