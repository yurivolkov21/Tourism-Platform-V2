import { messages } from '@tourism/i18n';
import { CheckIcon, ClockIcon, HeartIcon, SignalIcon, UsersIcon } from 'lucide-react';
import { RevealItem } from '@/components/motion/reveal-item';
import { FactCard } from '@/components/tours/fact-card';
import type { TourDetailVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';

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
        <RevealItem enter="rise" delay={0 * STAGGER.grid} className="h-full">
          <FactCard
            icon={<ClockIcon aria-hidden="true" />}
            label={t.facts.duration}
            note={tour.factDurationNote}
            // Chỉ ghép "N nights" khi tour dài hơn một ngày — tour trong ngày mà
            // ghi "1 day · 0 nights" là nói một thứ vô nghĩa.
            value={
              nights > 0
                ? `${t.durationValue(tour.durationDays)} · ${t.facts.nights(nights)}`
                : t.durationValue(tour.durationDays)
            }
            link={{ href: '#itinerary', label: t.facts.seeItinerary }}
          />
        </RevealItem>
        <RevealItem enter="rise" delay={1 * STAGGER.grid} className="h-full">
          <FactCard
            icon={<UsersIcon aria-hidden="true" />}
            label={t.facts.groupSize}
            note={tour.factGroupSizeNote}
            value={t.facts.groupSizeValue(tour.maxGroupSize)}
          />
        </RevealItem>
        {tour.difficulty ? (
          <RevealItem enter="rise" delay={2 * STAGGER.grid} className="h-full">
            <FactCard
              icon={<SignalIcon aria-hidden="true" />}
              label={t.facts.difficulty}
              note={tour.factDifficultyNote}
              value={messages.toursPage.difficultyLabels[tour.difficulty]}
              link={{ href: '#good-to-know', label: t.facts.howDemanding }}
            />
          </RevealItem>
        ) : null}
        {tour.suitableFor.length > 0 ? (
          <RevealItem enter="rise" delay={3 * STAGGER.grid} className="h-full">
            <FactCard
              icon={<HeartIcon aria-hidden="true" />}
              label={t.facts.goodFor}
              note={tour.factGoodForNote}
              value={tour.suitableFor.map((type) => messages.travellerTypes[type]).join(' · ')}
            />
          </RevealItem>
        ) : null}
      </div>

      {/* Wireframe có HAI đoạn mô tả; contract chỉ có `summary` (một đoạn, ≤500
          ký tự). Đoạn thứ hai của bản duyệt là văn bịa cho demo — không dựng.
          KHÁC với bốn câu `fact*Note` phía trên: những câu đó nay có cột thật
          (ADR-0023), còn đoạn văn thứ hai thì không. */}
      {tour.summary ? <p className="mt-7 max-w-3xl text-muted-foreground">{tour.summary}</p> : null}

      {tour.highlights.length > 0 ? (
        // Highlights vào như MỘT khối (không stagger từng dòng): danh sách 4–6 câu
        // ngắn, từng dòng nối nhau thì đọc ra như đang tải chậm.
        <RevealItem enter="rise" delay={STAGGER.grid} className="mt-5">
          <ul className="flex max-w-3xl flex-col gap-2.5">
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
        </RevealItem>
      ) : null}
    </div>
  );
}
