'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarXIcon, InfoIcon, type LucideIcon, StarIcon, TicketIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Lightbox } from '@/components/media/lightbox';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
import { GALLERY_THUMB_SLOTS, galleryThumbs, visibleDepartureChips } from '@/lib/tour-detail';
import { discountPercent, formatMoney, formatTicketDate, tourGallery } from '@/lib/tours';

type PolicyKind = TourDetailVM['policies'][number]['kind'];

/** Icon theo `PolicyKind` — enum ĐÓNG (`CANCELLATION`/`BOOKING`/`GENERAL`) nên
    map cứng ở đây an toàn, không cần nhánh mặc định. */
const POLICY_ICON: Record<PolicyKind, LucideIcon> = {
  CANCELLATION: CalendarXIcon,
  BOOKING: TicketIcon,
  GENERAL: InfoIcon,
};

/**
 * Khối trên cùng dưới hero: gallery 7 thumb (trái) + panel đặt chỗ (phải,
 * ghim 443px — spec §2.1, KHÔNG dùng tỉ lệ `1.4fr/1fr` vì nó chia 1104 ra số
 * lẻ và làm đường kẻ 1px lệch pixel ở cả trang bên dưới).
 *
 * Đọc đợt khởi hành qua `useDepartureSelection()` (context), KHÔNG qua
 * `tour.departures`: cùng khuôn với `BookingRailConnected`/`DepartureStripConnected`
 * — ba nơi đọc chung một trạng thái "đợt đang chọn" nên phải chung một nguồn.
 */
export function TourMediaPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  const router = useRouter();
  const { departures, selectedId, select, openAllDates } = useDepartureSelection();

  const [openAt, setOpenAt] = useState<number | null>(null);

  // Hero lên đầu, loại VIDEO/avatar/body — cùng luật `tourGallery()` đã chạy ở
  // TourGallery cũ (ADR-0020): API chỉ sort theo sortOrder+role, KHÔNG tự đưa
  // hero lên đầu hay lọc video, nên vẫn phải qua hàm này dù nguồn là API thật.
  const photos = tourGallery(tour.media);
  const { thumbs, hiddenCount } = galleryThumbs(photos, GALLERY_THUMB_SLOTS);
  const lead = photos[0];

  const departure = departures.find((d) => d.id === selectedId);
  const discount = discountPercent(tour.basePrice, tour.compareAtPrice);

  return (
    // Không có ảnh thì KHÔNG giữ lưới hai cột: một con duy nhất trong
    // `1fr 443px` rơi vào cột TRÁI và để trống 443px bên phải — trang đọc ra như
    // đang hỏng chứ không phải như một tour chưa có ảnh. Nhánh này đang chạy
    // thật (bảng `MediaAsset` còn rỗng trên DB dev), không phải phòng xa.
    <div
      data-media-layout={lead ? 'split' : 'single'}
      className={lead ? 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_443px]' : 'grid max-w-2xl gap-10'}
    >
      {lead ? (
        <div data-slot="tour-gallery" className="flex items-start gap-4">
          <ul className="flex w-16 shrink-0 flex-col gap-2">
            {thumbs.map((photo, i) => {
              const isLastVisible = i === thumbs.length - 1;
              return (
                <li key={photo.publicId}>
                  <button
                    type="button"
                    onClick={() => setOpenAt(i)}
                    aria-label={t.gallery.openPhoto(i + 1, photos.length)}
                    className="group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Image
                      src={photo.url}
                      alt={photo.alt ?? ''}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                    {isLastVisible && hiddenCount > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center bg-overlay text-xs leading-[16px] font-medium text-on-media"
                      >
                        {t.mediaPanel.morePhotos(hiddenCount)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => setOpenAt(0)}
            aria-label={t.mediaPanel.openGallery}
            className="relative aspect-square min-w-0 flex-1 cursor-pointer overflow-hidden rounded-[10px] border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Image
              src={lead.url}
              alt={lead.alt ?? ''}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
              className="object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute right-3 bottom-3 rounded-full bg-overlay px-2.5 py-1 text-xs leading-[16px] font-medium text-on-media"
            >
              {t.mediaPanel.photoCount(photos.length)}
            </span>
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        <p className="font-mono text-xs leading-[16px] tracking-widest text-muted-foreground uppercase">
          {tour.category.name}
        </p>

        <h1 className="font-heading text-3xl leading-[36px] font-medium text-balance text-foreground">
          {tour.title}
        </h1>

        {/* ratingAvg null = CHƯA AI đánh giá, khác 0 điểm — cùng luật với TourHero. */}
        {tour.ratingAvg === null ? (
          <p className="text-sm leading-[20px] text-muted-foreground">{t.notRated}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm leading-[20px]">
            <StarIcon className="size-4 shrink-0 fill-rating text-rating" aria-hidden="true" />
            <span className="font-medium text-foreground">{tour.ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">{t.reviewCount(tour.ratingCount)}</span>
          </p>
        )}

        {tour.summary ? (
          <p className="line-clamp-2 text-sm leading-[20px] text-pretty text-muted-foreground">
            {tour.summary}
          </p>
        ) : null}

        {/* Hàng ngoài canh center (giá + badge); hai con số bên trong canh
            baseline. Canh baseline cho cả badge sẽ làm badge tụt vài pixel. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-baseline gap-2">
            <span className="font-heading text-3xl leading-[36px] font-semibold text-foreground tabular-nums">
              {formatMoney(tour.basePrice, tour.currency)}
            </span>
            {tour.compareAtPrice ? (
              <>
                <span className="sr-only">
                  {t.wasPrice(formatMoney(tour.compareAtPrice, tour.currency))}
                </span>
                <span
                  aria-hidden="true"
                  className="text-sm leading-[20px] text-price-compare tabular-nums line-through"
                >
                  {formatMoney(tour.compareAtPrice, tour.currency)}
                </span>
              </>
            ) : null}
          </span>
          {discount !== null ? (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-xs leading-[16px] font-medium text-white">
              −{discount}%
            </span>
          ) : null}
        </div>

        <div aria-hidden="true" className="border-t border-border" />

        {departure ? (
          <>
            <div>
              <p className="text-sm leading-[20px] font-medium text-foreground">
                {t.mediaPanel.selectDeparture}
              </p>

              {/* Viền `--input`, KHÔNG `--border`: `input` là ranh giới điều
                  khiển, cân để đạt 3:1 (WCAG 1.4.11) — `border` chỉ trang trí. */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {visibleDepartureChips(departures, selectedId ?? null).map((d) => {
                  const selected = d.id === selectedId;
                  const limited = d.seatsLeft <= 3;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => select(d.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-input px-1 py-2 text-center transition-colors hover:border-primary/60',
                        selected && 'border-primary bg-primary/10',
                      )}
                    >
                      <span className="font-mono text-xs leading-[16px] tracking-wide text-foreground">
                        {formatTicketDate(d.startDate)}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] leading-[14px]',
                          limited ? 'font-medium text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {t.mediaPanel.seatsLeft(d.seatsLeft)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {departures.length > 0 ? (
                <button
                  type="button"
                  onClick={openAllDates}
                  className="mt-3 cursor-pointer text-sm leading-[20px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {t.mediaPanel.allDates(departures.length)}
                </button>
              ) : null}
            </div>

            {/* `Button` (native <button>), KHÔNG `ButtonLink`: `ButtonLink` cố
                tình giữ `role="link"` (xem doc comment của nó) cho điều hướng
                thuần, còn CTA này là một HÀNH ĐỘNG (bắt đầu đặt chỗ) nên
                role="button" đúng ngữ nghĩa — điều hướng qua `router.push()`. */}
            <Button
              size="lg"
              className="w-full rounded-sm"
              onClick={() => router.push(`/tours/${tour.slug}/book`)}
            >
              {t.mediaPanel.reserve(departure.seatsLeft)}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm leading-[20px] text-muted-foreground">{t.departures.none}</p>
            <ButtonLink size="lg" className="w-full rounded-sm" href="/contact">
              {t.booking.ask}
            </ButtonLink>
          </>
        )}

        {/* Ba thẻ sinh từ `tour.policies` — KHÔNG hardcode chữ. `auto-fit` để
            tour có 1–2 policy vẫn cân hàng thay vì để trống một ô. */}
        {tour.policies.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
            {tour.policies.map((policy) => {
              const Icon = POLICY_ICON[policy.kind];
              return (
                <div key={policy.title} className="flex items-start gap-2 rounded-lg border p-3">
                  <Icon className="size-4 shrink-0 text-primary-emphasis" aria-hidden="true" />
                  <p className="text-xs leading-[16px] text-foreground">{policy.title}</p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {lead ? (
        <Lightbox
          count={photos.length}
          openAt={openAt}
          onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
          onNavigate={setOpenAt}
          dialogTitle={t.gallery.dialogTitle}
          counterLabel={t.gallery.counter}
          closeLabel={t.gallery.close}
          previousLabel={t.gallery.previous}
          nextLabel={t.gallery.next}
          caption={(index) => photos[index]?.alt ?? null}
          renderMedia={(index) => {
            const photo = photos[index];
            return (
              <div className="relative aspect-16/10 w-full overflow-hidden rounded-lg bg-muted">
                {photo ? (
                  <Image
                    src={photo.url}
                    alt={photo.alt ?? ''}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
            );
          }}
        />
      ) : null}
    </div>
  );
}
