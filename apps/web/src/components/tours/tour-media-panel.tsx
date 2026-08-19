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
  SearchIcon,
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
import {
  GALLERY_THUMB_SLOTS,
  galleryThumbs,
  heroPrice,
  visibleDepartureChips,
} from '@/lib/tour-detail';
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
 * Khối trên cùng dưới hero: gallery bên trái + panel đặt chỗ bên phải.
 *
 * Dựng bám THẲNG markup `.top` / `.gal` / `.panel` của wireframe đã duyệt
 * (`docs/design/mockups/tour-detail.src.html`) — mọi con số dưới đây trích từ đó
 * bằng máy, xem spec §2.2. Ba chỗ dễ trôi nhất, ghi lại để không ai "dọn" nhầm:
 *
 * 1. **Cột phải GHIM `443px`**, không dùng tỉ lệ `fr`. Nội dung trang là 1056 →
 *    573 | 40 | 443 và ảnh vuông ra 493 chẵn. Tỉ lệ `fr` cho số lẻ, và phần lẻ
 *    truyền xuống làm mọi đường kẻ 1px bên dưới bị khử răng cưa.
 * 2. **`.head` gom tiêu đề + sao + tóm tắt vào MỘT con** của flex `gap-20`. Để
 *    rời ra ba con thì mỗi cái ăn thêm 20px và panel cao hơn bản duyệt 48px.
 * 3. **Lưới LUÔN hai cột**, tour chưa có ảnh thì lấp `ImagePlaceholder`. Bỏ khối
 *    gallery đi là panel trôi sang cột trái và trang đọc ra khác hẳn bản duyệt.
 */
export function TourMediaPanel({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  const router = useRouter();
  const { departures, selectedId, select, openAllDates } = useDepartureSelection();

  const [openAt, setOpenAt] = useState<number | null>(null);

  // Hero lên đầu, loại VIDEO/avatar/body — API chỉ sort theo sortOrder+role, KHÔNG
  // tự đưa hero lên đầu hay lọc video, nên vẫn phải qua hàm này (ADR-0020).
  const photos = tourGallery(tour.media);
  const { thumbs, hiddenCount } = galleryThumbs(photos, GALLERY_THUMB_SLOTS);
  const hasPhotos = photos.length > 0;

  // Nhãn ô lớn khi chưa có ảnh là ĐIỂM ĐẾN chính, không phải tên tour — tên tour
  // đã là H1 ngay bên phải.
  const destinationLabel =
    tour.destinations.find((d) => d.isPrimary)?.name ?? tour.destinations[0]?.name;

  const departure = departures.find((d) => d.id === selectedId);

  // Giá và badge giảm đi theo ĐỢT ĐANG CHỌN. Wireframe để hàng giá là HTML tĩnh
  // (nó chỉ là mock), nhưng `effectivePrice = priceOverride ?? basePrice` là giá
  // khách thật sự trả và mỗi đợt một khác — `BookingRail` đã bám đúng từ đầu,
  // panel phải nói cùng con số với nó và với nhãn trên nút Reserve.
  // Chưa chọn đợt (mọi đợt hết chỗ) → cùng con số với hero (`heroPrice`), không
  // phải base/neo tour trần — sweep giá 19/08.
  const fallback = heroPrice(tour);
  const shownPrice = departure?.effectivePrice ?? fallback.price;
  const shownCompareAt = departure ? departure.compareAtPrice : fallback.compareAtPrice;
  const discount = discountPercent(shownPrice, shownCompareAt);

  // Lightbox mở được cả khi chưa có ảnh: khi đó nó trưng đúng số Ô ẢNH người
  // dùng đang nhìn thấy (7 placeholder), không phải một con số bịa.
  const lightboxCount = hasPhotos ? photos.length : GALLERY_THUMB_SLOTS;

  return (
    <div data-slot="tour-top" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_443px]">
      {/* ── .gal ── */}
      <div data-slot="tour-gallery" className="flex items-start gap-4">
        <ul className="flex w-16 shrink-0 flex-col gap-2">
          {(hasPhotos ? thumbs : Array.from({ length: GALLERY_THUMB_SLOTS })).map((photo, i) => {
            const isLastVisible = i === (hasPhotos ? thumbs.length : GALLERY_THUMB_SLOTS) - 1;
            const key = hasPhotos ? (photo as (typeof thumbs)[number]).publicId : `slot-${i}`;
            return (
              <li key={key} data-slot={hasPhotos ? 'thumb' : 'thumb-placeholder'}>
                <button
                  type="button"
                  onClick={() => setOpenAt(i)}
                  aria-label={t.gallery.openPhoto(i + 1, lightboxCount)}
                  className="group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-sm border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {hasPhotos ? (
                    <Image
                      src={(photo as (typeof thumbs)[number]).url}
                      alt={(photo as (typeof thumbs)[number]).alt ?? ''}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <ImagePlaceholder className="size-full" />
                  )}
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

        {/* `.main-img` — vuông, radius md, viền 1px, nền muted. Nhãn "N photos"
            ở góc dưới-phải CHỈ hiện khi có ảnh thật. */}
        <button
          type="button"
          onClick={() => setOpenAt(0)}
          aria-label={t.mediaPanel.openGallery}
          className="relative aspect-square min-w-0 flex-1 cursor-pointer overflow-hidden rounded-md border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {hasPhotos && photos[0] ? (
            <>
              <Image
                src={photos[0].url}
                alt={photos[0].alt ?? ''}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                priority
                className="object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-overlay px-3 py-1.5 text-xs leading-none font-medium text-on-media"
              >
                <SearchIcon className="size-3.5" />
                {t.mediaPanel.photoCount(photos.length)}
              </span>
            </>
          ) : (
            <ImagePlaceholder label={destinationLabel} className="size-full" />
          )}
        </button>
      </div>

      {/* ── .panel — flex-col gap 20, ĐÚNG 7 con ── */}
      <div className="flex flex-col gap-5">
        <p className="flex items-center gap-2 font-mono text-[11px] leading-[14px] tracking-[0.12em] text-muted-foreground uppercase">
          {tour.category.name}
        </p>

        {/* .head */}
        <div className="flex flex-col gap-2">
          {/* `<p>`, KHÔNG phải `<h1>` (rà 19/08 đo được 2 `<h1>`/trang): tiêu đề
              tài liệu đã là `<h1>` của `TourHero` ngay trên; đây là lặp lại bằng
              mắt ở đầu khối ảnh+đặt chỗ. Hai `<h1>` là hai "tiêu đề cấp một" với
              trình đọc màn hình — cùng lỗi đã vá ở receipt 19/08. Giữ nguyên lớp
              chữ nên không đổi một pixel. */}
          <p className="font-heading text-[26px] leading-8 font-medium tracking-[-0.3px] text-foreground">
            {tour.title}
          </p>

          {/* ratingAvg null = CHƯA AI đánh giá, khác 0 điểm — cùng luật TourHero. */}
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

        {/* .price-row — hàng canh center, hai con số canh baseline bên trong.
            Canh baseline cho cả badge sẽ làm badge tụt vài pixel. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-baseline gap-2">
            <span className="text-xl leading-7 font-semibold text-price tabular-nums">
              {formatMoney(shownPrice, tour.currency)}
            </span>
            {shownCompareAt ? (
              <>
                <span className="sr-only">
                  {t.wasPrice(formatMoney(shownCompareAt, tour.currency))}
                </span>
                <span
                  aria-hidden="true"
                  className="text-sm text-price-compare tabular-nums line-through"
                >
                  {formatMoney(shownCompareAt, tour.currency)}
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
            {/* .sec */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm leading-[20px] font-medium text-foreground">
                  {t.mediaPanel.selectDeparture}
                </p>
                <button
                  type="button"
                  onClick={openAllDates}
                  className="cursor-pointer text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  {t.mediaPanel.allDates(departures.length)}
                </button>
              </div>

              {/* .dates — 4 cột đều, gap 8, đệm trên 4; ô cao 52, viền `--input`
                  (ranh giới điều khiển, cân để đạt 3:1 — `--border` chỉ trang trí). */}
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
                        'relative flex h-13 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-sm border border-input bg-card text-center transition-colors hover:border-primary/60',
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
                          className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                        >
                          <CheckIcon className="size-2.5" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* .btns — hai nút xếp dọc cách 8. `Button` (native <button>), KHÔNG
                `ButtonLink`: đây là HÀNH ĐỘNG (bắt đầu đặt chỗ) nên `role="button"`
                mới đúng ngữ nghĩa; điều hướng qua `router.push()`. */}
            <div className="grid gap-2">
              <Button
                className="h-9 w-full rounded-sm"
                onClick={() => router.push(`/tours/${tour.slug}/book`)}
              >
                <TicketIcon />
                {t.mediaPanel.reserve(departure.seatsLeft)}
              </Button>
              {/* Suspense bọc ĐÚNG cái nút: `WishlistProvider` đọc
                  `useSearchParams()` mà trang này là SSG. Bọc rộng hơn là đẩy cả
                  nội dung trang ra khỏi HTML tĩnh — đúng thứ ADR-0022 cấm. */}
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
            <ButtonLink className="h-9 w-full rounded-sm" href={`/tours/${tour.slug}/enquire`}>
              {t.booking.ask}
            </ButtonLink>
          </>
        )}

        {/* .trust — sinh từ `policies[]`, không hardcode. Bấm sang tab Good to
            know nơi có `policy.body` đầy đủ. */}
        {tour.policies.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2">
            {tour.policies.map((policy) => {
              const Icon = POLICY_ICON[policy.kind];
              return (
                <a
                  key={policy.kind}
                  href="#good-to-know"
                  className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-3 text-center text-foreground transition-colors hover:border-input"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-xs leading-[14px]">{policy.title}</span>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>

      <Lightbox
        count={lightboxCount}
        openAt={openAt}
        onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
        onNavigate={setOpenAt}
        dialogTitle={t.gallery.dialogTitle}
        counterLabel={t.gallery.counter}
        closeLabel={t.gallery.close}
        previousLabel={t.gallery.previous}
        nextLabel={t.gallery.next}
        caption={(index) => (hasPhotos ? (photos[index]?.alt ?? null) : null)}
        // Bật thu/phóng CHỈ ở trang tour (nợ A12). Trang vùng dùng chung
        // component nhưng chưa đặt hàng tính năng này — thêm hai nút không ai
        // yêu cầu là tự ý nới phạm vi.
        zoom={{
          inLabel: t.gallery.zoomIn,
          outLabel: t.gallery.zoomOut,
          valueLabel: t.gallery.zoomLevel,
          toggleLabel: t.gallery.zoomToggle,
        }}
        renderMedia={(index) => {
          const photo = photos[index];
          return (
            <div className="relative aspect-16/10 w-full overflow-hidden rounded-md bg-muted">
              {photo ? (
                <Image
                  src={photo.url}
                  alt={photo.alt ?? ''}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <ImagePlaceholder label={destinationLabel} className="size-full" />
              )}
            </div>
          );
        }}
      />
    </div>
  );
}

/**
 * Nút "Wishlist" dưới Reserve — bản wireframe có nó (`.btn.ghost`).
 *
 * Dùng CHUNG `useWishlist()` với nút tim ở card listing nên nó lưu thật. Không có
 * `WishlistProvider` bao ngoài thì KHÔNG render — cùng luật `WishlistHeart` đã
 * chốt: "một cái tim không làm gì là hứa thứ sản phẩm không giữ".
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
