import { messages } from '@tourism/i18n';
import Link from 'next/link';

/**
 * "Ngăn kẹp trong hộ chiếu" (M1) — chỉ còn ĐẾM (không thumbnail): fix 11/08
 * bỏ hàng ảnh vì nó là dữ liệu trùng lặp trang saved đầy đủ, một dòng đếm +
 * link Open đã đủ mời khách sang xem. Rỗng thì page ẨN cả khối (không render
 * component này) — ngăn kẹp trống không phải là tin.
 */
export function SavedTuck({ total }: { total: number }) {
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
    </div>
  );
}
