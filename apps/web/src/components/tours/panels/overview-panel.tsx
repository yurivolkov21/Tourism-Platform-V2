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
 * Tab 1 — dải dữ kiện + mô tả + điểm nhấn.
 *
 * Dải dữ kiện theo mẫu card đã chốt (header có icon + nhãn, gạch ngăn, thân
 * chứa giá trị): mỗi card chỉ nói MỘT con số lấy thẳng từ dữ liệu. Bản wireframe
 * còn có một dòng mô tả dưới mỗi giá trị ("Day four is a buffer morning…") —
 * đã BỎ, vì `TourDetailSchema` không có trường nào chứa câu đó và bịa ra thì
 * mỗi tour phải viết tay một câu.
 *
 * Card chỉ render khi CÓ dữ liệu: `difficulty` nullable trong contract,
 * `suitableFor` có thể rỗng. Lưới `auto-fit` nên 3 hay 4 card đều cân hàng,
 * không chừa ô trống — ở bề ngang 1104 với 4 card ra đúng 264px mỗi card.
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
  /** Link nội trang (hash) mở tab khác — chỉ gắn khi thật sự có chỗ để tới. */
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="text-sm leading-[20px] font-medium text-foreground">{label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm leading-[20px] font-medium">{value}</p>
        {link ? (
          <a
            href={link.href}
            className="mt-auto inline-flex items-center gap-1 text-xs leading-[16px] font-medium text-primary-emphasis hover:underline"
          >
            <ArrowRightIcon className="size-2.5 shrink-0" aria-hidden="true" />
            {link.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function OverviewPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  const nights = tour.durationDays - 1;

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
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
          link={{ href: '#itinerary', label: t.tabs.itinerary }}
        />
        <FactCard
          icon={<UsersIcon aria-hidden="true" />}
          label={t.facts.groupSize}
          value={t.groupSize(tour.maxGroupSize)}
        />
        {tour.difficulty ? (
          <FactCard
            icon={<SignalIcon aria-hidden="true" />}
            label={t.facts.difficulty}
            value={messages.toursPage.difficultyLabels[tour.difficulty]}
            link={{ href: '#good-to-know', label: t.tabs.goodToKnow }}
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

      {tour.summary ? (
        <p className="mt-7 max-w-3xl text-sm leading-[23px] text-muted-foreground">
          {tour.summary}
        </p>
      ) : null}

      {tour.highlights.length > 0 ? (
        <ul className="mt-5 flex max-w-3xl flex-col gap-2.5">
          {tour.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-sm leading-[23px]">
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
