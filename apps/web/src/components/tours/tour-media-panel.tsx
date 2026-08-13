'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Rating } from '@tourism/ui/components/reui/rating';
import { cn } from '@tourism/ui/lib/utils';
import {
  CalendarXIcon,
  CheckIcon,
  HeartIcon,
  InfoIcon,
  type LucideIcon,
  TicketIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { Lightbox } from '@/components/media/lightbox';
import { useDepartureSelection } from '@/components/tours/departure-selection';
import { useWishlist, WishlistProvider } from '@/components/tours/wishlist-store';
import type { TourDetailVM } from '@/lib/api/tours';
import { GALLERY_THUMB_SLOTS, galleryThumbs, visibleDepartureChips } from '@/lib/tour-detail';
import { discountPercent, formatChipDate, formatMoney, tourGallery } from '@/lib/tours';

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

  // Nhãn ô lớn là ĐIỂM ĐẾN chính, không phải tên tour — tên tour đã là H1 ngay
  // bên phải. Cùng quy ước `primaryLabel` mà gallery cũ dùng.
  const destinationLabel =
    tour.destinations.find((d) => d.isPrimary)?.name ?? tour.destinations[0]?.name;

  const departure = departures.find((d) => d.id === selectedId);
  const discount = discountPercent(tour.basePrice, tour.compareAtPrice);

  return (
    // Lưới LUÔN hai cột `1fr 443px`, có ảnh hay chưa cũng vậy — đó là bố cục đã
    // duyệt, và nó chia 1104 ra đúng 621|40|443. Tour chưa có ảnh thì khối trái
    // lấp bằng `ImagePlaceholder` theo đúng chính sách static-first của repo,
    // KHÔNG bỏ khối đi: bỏ đi là panel đặt chỗ trôi sang cột trái và trang đọc
    // ra khác hẳn bản thiết kế.
    <div data-media-layout="split" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_443px]">
      <div data-slot="tour-gallery" className="flex items-start gap-4">
        <ul className="flex w-16 shrink-0 flex-col gap-2">
          {lead
            ? thumbs.map((photo, i) => {
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
              })
            : // Ô trống KHÔNG bấm được và không mang nhãn "photo": nó là chỗ
              // dành sẵn, không phải ảnh. Xem test "không bịa số ảnh".
              Array.from({ length: GALLERY_THUMB_SLOTS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ô trống thuần trang trí, không mang dữ liệu và không bao giờ sắp lại thứ tự
                <li key={`slot-${i}`} data-slot="thumb-placeholder">
                  <ImagePlaceholder className="size-16 rounded-[10px] border" />
                </li>
              ))}
        </ul>

        {lead ? (
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
        ) : (
          <ImagePlaceholder
            label={destinationLabel}
            className="aspect-square min-w-0 flex-1 rounded-[10px] border"
          />
        )}
      </div>

      {/* Panel: mọi con số dưới đây ĐO TỪ wireframe đã duyệt (`.panel` và các
          lớp con của nó trong `docs/design/mockups/tour-detail.src.html`), không
          phải ước lượng. Khối `head` gom tiêu đề + sao + tóm tắt vào MỘT con của
          flex gap-20 — để rời ra ba con thì mỗi cái ăn thêm 20px và panel cao
          hơn bản duyệt 48px. */}
      <div className="flex flex-col gap-5">
        <p className="flex items-center gap-2 font-mono text-[11px] leading-[14px] tracking-[0.12em] text-muted-foreground uppercase">
          {tour.category.name}
        </p>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[26px] leading-8 font-medium tracking-[-0.3px] text-foreground">
            {tour.title}
          </h1>

          {/* ratingAvg null = CHƯA AI đánh giá, khác 0 điểm — cùng luật với TourHero. */}
          {tour.ratingAvg === null ? (
            <p className="text-sm leading-[20px] text-muted-foreground">{t.notRated}</p>
          ) : (
            <div className="flex items-center gap-2">
              <Rating
                rating={tour.ratingAvg}
                size="sm"
                className="gap-0"
                starClassName="size-3.5"
                aria-label={t.reviews.ratingLabel(tour.ratingAvg)}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {tour.ratingAvg.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                ({t.reviewCount(tour.ratingCount)})
              </span>
            </div>
          )}

          {tour.summary ? (
            <p className="line-clamp-2 text-sm leading-[23px] text-pretty text-muted-foreground">
              {tour.summary}
            </p>
          ) : null}
        </div>

        {/* Giá 20/28 w600 màu `--price`; giá gạch 14px `--price-compare`; badge
            cao 20 nền `--destructive`. Hàng canh center, hai con số canh baseline
            bên trong — canh baseline cho cả badge sẽ làm badge tụt vài pixel. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-baseline gap-2">
            <span className="text-xl leading-7 font-semibold text-price tabular-nums">
              {formatMoney(tour.basePrice, tour.currency)}
            </span>
            {tour.compareAtPrice ? (
              <>
                <span className="sr-only">
                  {t.wasPrice(formatMoney(tour.compareAtPrice, tour.currency))}
                </span>
                <span
                  aria-hidden="true"
                  className="text-sm text-price-compare tabular-nums line-through"
                >
                  {formatMoney(tour.compareAtPrice, tour.currency)}
                </span>
              </>
            ) : null}
          </span>
          {discount !== null ? (
            <span className="inline-flex h-5 items-center rounded-full bg-destructive px-2 text-xs leading-4 font-medium text-white">
              {t.mediaPanel.percentOff(discount)}
            </span>
          ) : null}
        </div>

        <div aria-hidden="true" className="h-px bg-border" />

        {departure ? (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm leading-[20px] font-medium text-foreground">
                  {t.mediaPanel.selectDeparture}
                </p>
                {departures.length > 0 ? (
                  <button
                    type="button"
                    onClick={openAllDates}
                    className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    {t.mediaPanel.allDates(departures.length)}
                  </button>
                ) : null}
              </div>

              {/* Ô ngày cao 52, lưới 4 cột gap 8, đệm trên 4 — số của wireframe.
                  Viền `--input`, KHÔNG `--border`: `input` là ranh giới điều
                  khiển, cân để đạt 3:1 (WCAG 1.4.11) — `border` chỉ trang trí. */}
              <div className="grid grid-cols-4 gap-2 pt-1">
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
                        'relative flex h-13 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-input bg-card text-center transition-colors hover:border-primary/60',
                        selected &&
                          'border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]',
                      )}
                    >
                      <span className="font-mono text-sm leading-none font-medium text-foreground tabular-nums">
                        {formatChipDate(d.startDate)}
                      </span>
                      <span
                        className={cn(
                          'text-[11px]',
                          limited ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {t.mediaPanel.seatsLeft(d.seatsLeft)}
                      </span>
                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground"
                        >
                          <CheckIcon className="size-2.5" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hai nút xếp dọc cách 8 — `.btns{display:grid;gap:8px}` của
                wireframe. `Button` (native <button>), KHÔNG `ButtonLink`:
                `ButtonLink` cố tình giữ `role="link"` cho điều hướng thuần, còn
                CTA này là một HÀNH ĐỘNG (bắt đầu đặt chỗ) nên role="button" mới
                đúng ngữ nghĩa — điều hướng qua `router.push()`. */}
            <div className="grid gap-2">
              <Button
                className="h-9 w-full rounded-sm"
                onClick={() => router.push(`/tours/${tour.slug}/book`)}
              >
                <TicketIcon />
                {t.mediaPanel.reserve(departure.seatsLeft)}
              </Button>
              {/* Suspense bọc ĐÚNG cái nút, không bọc cả trang: `WishlistProvider`
                  đọc `useSearchParams()`, mà trang này là SSG nên Next bắt buộc
                  phải có boundary. Bọc rộng hơn là đẩy toàn bộ nội dung trang ra
                  khỏi HTML tĩnh — đúng thứ ADR-0022 cấm. Fallback giữ chiều cao
                  36 để bố cục không nhảy. */}
              <Suspense fallback={<div aria-hidden="true" className="h-9" />}>
                <WishlistProvider tourIds={[tour.id]}>
                  <WishlistButton tourId={tour.id} tourTitle={tour.title} />
                </WishlistProvider>
              </Suspense>
            </div>
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
            {tour.policies.map((policy) => {
              const Icon = POLICY_ICON[policy.kind];
              return (
                <a
                  key={policy.title}
                  href="#good-to-know"
                  className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-card px-2 py-3 text-center text-foreground transition-colors hover:border-input"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {/* leading 14 = line-height `normal` của 12px trong wireframe;
                      `leading-4` (16) làm thẻ cao 64 thay vì 62. */}
                  <span className="text-xs leading-[14px]">{policy.title}</span>
                </a>
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

/**
 * Nút "Wishlist" dưới Reserve — bản wireframe có nó, panel cũ thiếu.
 *
 * Dùng CHUNG `useWishlist()` với nút tim ở card listing, nên nó lưu thật chứ
 * không phải nút trang trí. Không có `WishlistProvider` bao ngoài thì KHÔNG
 * render — cùng luật `WishlistHeart` đã chốt: "một cái tim không làm gì là hứa
 * thứ sản phẩm không giữ".
 */
function WishlistButton({ tourId, tourTitle }: { tourId: string; tourTitle: string }) {
  const wishlist = useWishlist();
  if (!wishlist) return null;
  const wished = wishlist.isWished(tourId);
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-full rounded-sm"
      aria-pressed={wished}
      aria-label={messages.toursPage.wishlistLabel(tourTitle)}
      onClick={() => wishlist.toggle(tourId)}
    >
      <HeartIcon className={wished ? 'fill-current text-primary-emphasis' : undefined} />
      {messages.tourDetail.mediaPanel.wishlist}
    </Button>
  );
}
