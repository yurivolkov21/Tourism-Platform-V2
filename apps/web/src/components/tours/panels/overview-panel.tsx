import { messages } from '@tourism/i18n';
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  HeartIcon,
  SignalIcon,
  UsersIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TourDetailVM } from '@/lib/api/tours';

/**
 * Một card dữ kiện — dựng bám `.fcard` / `.fcard-h` / `.fcard-b` của wireframe:
 * header có icon + nhãn và một đường kẻ ngăn, thân chứa giá trị và (nếu có) một
 * link nhỏ đẩy xuống đáy bằng `margin-top:auto`.
 *
 * ⚠️ THIẾU SO VỚI WIREFRAME — CÓ CHỦ Ý: bản duyệt còn một dòng mô tả dưới mỗi
 * giá trị ("Day four is a buffer morning — coffee and a late drop-off…").
 * `TourDetailSchema` KHÔNG có trường nào chứa câu đó, và bịa ra thì mỗi tour
 * phải viết tay bốn câu. Hệ quả đo được: card cao ~110 thay vì 197 của bản duyệt.
 * Muốn đóng khoảng này thì phải mở contract (ghi trong sổ nợ), không phải sửa CSS.
 */
function FactCard({
  icon,
  label,
  value,
  link,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** Chỉ gắn khi thật sự có chỗ để tới — link chết còn tệ hơn không có link. */
  link?: { href: string; label: string };
}) {
  return (
    <div
      data-testid="fact-card"
      className="flex flex-col overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="text-sm leading-[20px]">{label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm leading-[20px] font-medium text-foreground">{value}</p>
        {link ? (
          <a
            href={link.href}
            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary-emphasis hover:underline"
          >
            <ArrowRightIcon className="size-3 shrink-0" aria-hidden="true" />
            {link.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tab 1 — dải bốn card dữ kiện, mô tả, rồi danh sách điểm nhấn.
 *
 * Lưới `.facts`: 4 cột đều, gap 16 → ở bề ngang 1056 ra đúng 252px mỗi card.
 * Dùng `repeat(4,minmax(0,1fr))` như wireframe chứ KHÔNG `auto-fit`: `auto-fit`
 * làm 3 card giãn ra 341 và hàng card đổi nhịp mỗi khi một tour thiếu dữ liệu.
 */
export function OverviewPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  const nights = tour.durationDays - 1;

  return (
    <div>
      <div data-slot="facts" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FactCard
          icon={<ClockIcon aria-hidden="true" />}
          label={t.facts.duration}
          // Chỉ ghép "N nights" khi tour dài hơn một ngày — tour trong ngày mà
          // ghi "1 day · 0 nights" là nói một thứ vô nghĩa.
          value={
            nights > 0
              ? `${t.durationValue(tour.durationDays)} · ${t.facts.nights(nights)}`
              : t.durationValue(tour.durationDays)
          }
          link={{ href: '#itinerary', label: t.facts.seeItinerary }}
        />
        <FactCard
          icon={<UsersIcon aria-hidden="true" />}
          label={t.facts.groupSize}
          value={t.facts.groupSizeValue(tour.maxGroupSize)}
        />
        {tour.difficulty ? (
          <FactCard
            icon={<SignalIcon aria-hidden="true" />}
            label={t.facts.difficulty}
            value={messages.toursPage.difficultyLabels[tour.difficulty]}
            link={{ href: '#good-to-know', label: t.facts.howDemanding }}
          />
        ) : null}
        {tour.suitableFor.length > 0 ? (
          <FactCard
            icon={<HeartIcon aria-hidden="true" />}
            label={t.facts.goodFor}
            value={tour.suitableFor.map((type) => messages.travellerTypes[type]).join(' · ')}
          />
        ) : null}
      </div>

      {/* Wireframe có HAI đoạn mô tả; contract chỉ có `summary` (một đoạn, ≤500
          ký tự). Đoạn thứ hai của bản duyệt là văn bịa cho demo — không dựng. */}
      {tour.summary ? <p className="mt-7 max-w-3xl text-muted-foreground">{tour.summary}</p> : null}

      {tour.highlights.length > 0 ? (
        <ul className="mt-5 flex max-w-3xl flex-col gap-2.5">
          {tour.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2.5">
              <CheckIcon
                className="mt-1 size-3.5 shrink-0 text-primary-emphasis"
                aria-hidden="true"
              />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
