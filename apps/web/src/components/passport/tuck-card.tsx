import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import Link from 'next/link';

/**
 * Thẻ lối vào "ngăn kẹp trong hộ chiếu" — một dòng đếm + link Open, KHÔNG
 * thumbnail (fix 11/08: dữ liệu trùng trang đích). Generic hoá từ SavedTuck
 * cũ; rỗng thì page ẨN cả thẻ, ngăn kẹp trống không phải là tin.
 *
 * Lên khung Frame 12/08 (góp ý user: đồng bộ ngôn ngữ khung với khối giấy
 * tờ booking + khối review) — thẻ card trơn cũ thay bằng ring + panel.
 */
export function TuckCard({ heading, href, cta }: { heading: string; href: string; cta: string }) {
  return (
    <Frame className="w-full">
      <FramePanel className="px-5 py-4">
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
      </FramePanel>
    </Frame>
  );
}
