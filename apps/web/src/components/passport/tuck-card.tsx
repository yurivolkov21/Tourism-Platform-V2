import Link from 'next/link';

/**
 * Thẻ lối vào "ngăn kẹp trong hộ chiếu" — một dòng đếm + link Open, KHÔNG
 * thumbnail (fix 11/08: dữ liệu trùng trang đích). Generic hoá từ SavedTuck
 * cũ khi trang passport cần lối vào thứ hai (My bookings — addendum §7.4);
 * rỗng thì page ẨN cả thẻ, ngăn kẹp trống không phải là tin.
 */
export function TuckCard({ heading, href, cta }: { heading: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11.5px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          {heading}
        </p>
        <Link
          href={href}
          className="text-[13px] font-semibold text-primary-emphasis hover:underline"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
