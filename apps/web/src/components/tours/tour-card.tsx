import { messages } from '@tourism/i18n';
import { StarIcon } from 'lucide-react';
import { SlotImage } from '@/components/slot-image';
import type { TourCardVM } from '@/lib/api/tours';
import { discountPercent, formatMoney, routeChain } from '@/lib/tours';

/**
 * Card tour DỌC cho lưới gợi ý "You might also like" ở cuối trang chi tiết.
 * (Listing dùng `TourListCard` hàng ngang — hai chỗ, hai việc khác nhau.)
 *
 * NĂM BĂNG, MỘT THỨ TỰ ĐỌC. Mỗi băng trả lời đúng một câu, theo thứ tự người ta
 * hỏi: ở đâu → cái gì → dài bao lâu, nặng không → bao nhiêu + tin được không.
 * Bản trước có sáu băng cộng bốn thứ trôi nổi (eyebrow chuyên mục, hàng 3 chip,
 * rating bị `ml-auto` đẩy ra cuối hàng chip, footer có viền, nút tim) — mắt không
 * biết đọc từ đâu.
 *
 * KHÔNG khung, KHÔNG nền card, KHÔNG đường kẻ chân: bài học vòng 4 của listing —
 * gốc rễ cảm giác "trống hoác" là CÁI KHUNG, không phải số phần tử bên trong. Khu
 * gợi ý này nằm ngay dưới bảng đợt có viền và rail booking có viền; thêm khung nữa
 * là bốn thứ có viền xếp liên tiếp trong một màn hình.
 *
 * ẢNH nối dây 18/08: trước đó file này vẽ `ImagePlaceholder` VÔ ĐIỀU KIỆN dù
 * `TourCardVM` đã mang `cover` — đúng lỗi `destination-tile.tsx` từng mắc, và
 * lần này nặng hơn vì `TourCard` dùng ở NĂM chỗ: khu gợi ý cuối trang tour,
 * `region-tours`, `region-day-trips`, tab đánh giá, và lưới đã lưu. User phát
 * hiện bằng mắt ở trang vùng. Bài học lặp lại: nối được dây ở MỘT component
 * không có nghĩa mọi component cùng loại đã được nối — phải rà theo dữ liệu
 * (`grep` chỗ nào nhận VM có `cover` mà vẫn vẽ ô giữ chỗ), không rà theo trang.
 *
 * Chip giảm giá đổi từ `bg-destructive` sang token `sale`: hai thứ có ngữ nghĩa
 * đối lập (xoá/nguy hiểm ≠ khuyến mãi) và `TourListCard` đã dùng `sale` từ
 * 17/08 — để lệch thì hai thẻ tour cùng sản phẩm hiện hai sắc đỏ khác nhau.
 *
 * KHÔNG nút tim: wishlist chưa nối (contract có `wishlist.check` batch, UI chưa
 * dùng). Một cái tim không làm gì là hứa thứ sản phẩm không giữ — cùng lý do nút
 * "Report a broken link" bị bỏ khỏi trang 404.
 *
 * SÁU TRƯỜNG, tất cả đều có trong `TourCardSchema` nên card KHÔNG rỗng khi gắn
 * API: chuỗi chặng · title · durationDays · difficulty · giá (+ giá gạch, −N%) ·
 * rating. Cố tình bỏ `category` (ở slot này nó gần như hằng số vì `relatedTours()`
 * ưu tiên cùng chuyên mục nên nó thường trùng tour vừa xem), `maxGroupSize` (thông
 * tin lúc quyết, đã có ở hero + rail trang chi tiết), `summary` (2 dòng văn xuôi
 * tranh chỗ với tiêu đề, lại nullable nên giữ chỗ = khoảng trống chết),
 * `isFeatured` (tranh chỗ với chip giảm giá — sự thật về giá thắng nhãn tiếp thị).
 */

/**
 * Dải chặng hiện 2 chặng đầu, phần dư gộp thành "+N".
 *
 * Vì sao cắt ở tầng DỮ LIỆU chứ không để CSS `overflow` cắt: cắt bằng CSS thì
 * người đọc thấy chuỗi đứt giữa và không biết còn bao nhiêu chặng nữa. "+2" nói
 * thẳng điều đó. Tên các chặng bị gộp vẫn nằm trong DOM dạng `sr-only` nên trình
 * đọc màn hình không mất thông tin nào.
 */
const VISIBLE_STOPS = 2;

export function TourCard({ tour }: { tour: TourCardVM }) {
  const t = messages.toursPage;
  const chain = routeChain(tour.destinations);
  const stops = chain.slice(0, VISIBLE_STOPS);
  const hiddenStops = chain.slice(VISIBLE_STOPS);
  // `priceFrom` (19/08): giá "from" THẬT = đợt rẻ nhất sắp tới (API tính), không
  // còn `basePrice` — card từng nói "from $129" trong khi chi tiết có đợt $119.
  // Giá gạch vẫn là neo tour: cùng quy tắc `resolveDepartureAnchors` ở chi tiết.
  // `?? basePrice`: field mới (additive) — API deploy SAU web, hoặc API dev chạy
  // bản build cũ, thì card vẫn ra số thay vì vỡ trang /tours vì một field.
  const from = tour.priceFrom ?? tour.basePrice;
  const discount = discountPercent(from, tour.compareAtPrice);

  return (
    // `data-tour-card` là móc cho luật transition-delay theo chặng trong
    // globals.css; `group` là móc cho các biến thể group-hover của Tailwind.
    <article data-tour-card className="group relative flex flex-col gap-2.5">
      {/* ── 1 · Ảnh. Thứ DUY NHẤT được đặt lên nó là chip giảm giá. ── */}
      <div className="relative overflow-hidden rounded-xl">
        {/* Nhãn ảnh là tên destination chính, KHÔNG phải tour.title — title đã là
            <h3> ngay dưới, lặp lại là trình đọc màn hình đọc hai lần. */}
        <SlotImage
          image={tour.cover}
          label={chain[0]?.name}
          className="aspect-16/10 w-full transition-transform duration-700 ease-out group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        />
        {discount !== null ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-sale px-2 py-0.5 text-xs font-medium text-sale-foreground">
            −{discount}%
          </span>
        ) : null}
      </div>

      {/* ── 2 · DẢI CHẶNG — phần tử ký tên của card. ──
          Chấm ĐẶC cho điểm đến chính là tín hiệu duy nhất; bản trước còn thêm một
          vòng sáng `box-shadow` quanh nó — tín hiệu thứ hai cho cùng một thứ, và
          nó toả ra ngoài nên bị `overflow-hidden` cắt mất mép trái ở chấm đầu.
          `-ml-0.5 pl-0.5`: nội dung đẩy vào 2px cho chấm có chỗ thở, hộp vẫn
          thẳng lề với tiêu đề bên dưới. */}
      <p className="-ml-0.5 flex items-center gap-1.5 overflow-hidden pl-0.5 font-mono text-[0.625rem] tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase">
        {stops.map((dest, i) => (
          <span key={dest.slug} className="flex shrink-0 items-center gap-1.5">
            {i > 0 ? (
              // Đường nối và chấm sáng lần lượt từ chặng đầu ra chặng cuối.
              // --leg-index quyết định thứ tự; xem luật [data-leg] ở globals.css.
              <span
                aria-hidden="true"
                data-leg
                style={{ '--leg-index': i * 2 - 1 } as React.CSSProperties}
                className="h-px w-5 shrink-0 bg-border group-hover:bg-primary group-focus-within:bg-primary"
              />
            ) : null}
            {dest.isPrimary ? (
              <span
                aria-hidden="true"
                className="size-[0.4375rem] shrink-0 rounded-full bg-primary"
              />
            ) : (
              <span
                aria-hidden="true"
                data-leg
                style={{ '--leg-index': i * 2 } as React.CSSProperties}
                className="size-[0.4375rem] shrink-0 rounded-full border-[1.25px] border-muted-foreground opacity-75 group-hover:scale-125 group-hover:border-primary group-hover:opacity-100 group-focus-within:scale-125 group-focus-within:border-primary group-focus-within:opacity-100"
              />
            )}
            <span className={dest.isPrimary ? 'text-foreground' : undefined}>{dest.name}</span>
          </span>
        ))}

        {hiddenStops.length > 0 ? (
          <>
            <span
              aria-hidden="true"
              data-leg
              style={{ '--leg-index': VISIBLE_STOPS * 2 - 1 } as React.CSSProperties}
              className="h-px w-5 shrink-0 bg-border group-hover:bg-primary group-focus-within:bg-primary"
            />
            <span aria-hidden="true" className="shrink-0 opacity-80">
              {t.moreStops(hiddenStops.length)}
            </span>
            {/* Tên chặng bị gộp — chỉ cho trình đọc màn hình, để "+2" không làm
                mất thông tin. Tên địa danh là DỮ LIỆU nên không đi qua i18n. */}
            <span className="sr-only">{hiddenStops.map((dest) => dest.name).join(', ')}</span>
          </>
        ) : null}
      </p>

      {/* ── 3 · Tiêu đề. Lora, hợp đồng 2 dòng. ──
          Gạch chân nằm trên <span> BỌC CHỮ, không trên <h3>: h3 là hộp hai dòng
          (`min-h-[2lh]`) nên gạch ở đáy hộp sẽ rơi cách chữ một dòng khi tiêu đề
          chỉ có một dòng. Đúng cách PostCard của /blog làm.
          Đổi màu tiêu đề KHÔNG nằm trong motion-safe: nó là phản hồi trạng thái,
          không phải hoạt cảnh, nên người tắt chuyển động vẫn cần thấy. */}
      <h3 className="min-h-[2lh] overflow-hidden font-heading text-lg leading-snug font-medium text-foreground transition-colors duration-300 group-hover:text-primary-emphasis group-focus-within:text-primary-emphasis [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
        {/* `after:absolute after:inset-0` biến cả card thành vùng bấm mà vẫn chỉ có
            MỘT link, và link đó có nội dung thật nên tên khả truy cập là tiêu đề
            (một <a> rỗng chỉ mang aria-label bị Biome chặn, đúng lý). Đây là cùng
            thủ thuật TourListCard đang dùng. Không phần tử tương tác nào khác trên
            card → cảm ứng hoạt động y hệt desktop. */}
        <a href={`/tours/${tour.slug}`} className="after:absolute after:inset-0">
          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-left-bottom bg-no-repeat bg-[length:0%_1px] group-hover:bg-[length:100%_1px] group-focus-within:bg-[length:100%_1px] motion-safe:transition-[background-size] motion-safe:duration-300">
            {tour.title}
          </span>
        </a>
      </h3>

      {/* ── 4 · Hình dạng chuyến đi — MỘT CÂU, không phải hàng chip. Nhờ vậy không
          còn bài toán "ba chip bị overflow-hidden xén ngang chữ" mà card ngang
          phải chặn bằng MAX_CHIPS. ── */}
      <p className="text-sm text-muted-foreground">
        {t.durationValue(tour.durationDays)}
        {tour.difficulty ? ` · ${t.difficultyLabels[tour.difficulty]}` : null}
      </p>

      {/* ── 5 · Hàng chân: tiền trái, uy tín phải, cùng baseline. Không đường kẻ. ── */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-baseline gap-1.5">
          <span className="font-heading text-xl font-semibold text-foreground tabular-nums">
            {formatMoney(from, tour.currency)}
          </span>
          {tour.compareAtPrice ? (
            <span className="text-sm text-price-compare tabular-nums line-through">
              {formatMoney(tour.compareAtPrice, tour.currency)}
            </span>
          ) : (
            <span className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
              {t.perPerson}
            </span>
          )}
        </span>

        {/* ratingAvg null = CHƯA AI đánh giá, khác hẳn 0 điểm. Nhãn chữ thay vì
            "0.0" hay 5 sao rỗng — cả hai đều là nói dối về dữ liệu. */}
        {tour.ratingAvg === null ? (
          <span className="text-xs text-muted-foreground">{t.notRated}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <StarIcon className="size-3.5 fill-rating text-rating" aria-hidden="true" />
            <span className="font-medium text-foreground">{tour.ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({tour.ratingCount.toLocaleString('en-US')})
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
