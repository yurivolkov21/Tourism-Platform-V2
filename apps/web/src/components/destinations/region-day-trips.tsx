import { messages } from '@tourism/i18n';
import Link from 'next/link';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';
import { formatMoney } from '@/lib/tours';
import type { MockTourCard } from '@/mocks/types';

/** Dưới ngưỡng này thì khu KHÔNG dựng. Một "dải" một phần tử không phải dải — nó
    là một card lạc lõng, và tiêu đề "1 of these trips fit in a single day" thì
    vừa sai ngữ pháp vừa không nói được điều gì về vùng. */
const MIN_TRIPS = 2;

/**
 * Khu MỞ ĐẦU của miền Trung — dải các chuyến gói gọn trong MỘT ngày.
 *
 * Vì sao chỉ miền Trung dựng: đo 29/07, chuyến riêng của Trung là 1, 1, 1, 1, 6 —
 * **bốn trên năm** nằm gọn trong một ngày. Bắc chỉ có một chuyến như vậy (dưới
 * ngưỡng, khu tự ẩn) và Nam có hai. Đây là sự thật riêng của vùng, không phải
 * một khuôn đem áp cho đủ ba trang. Bản đồ vùng→khu ở `regionTheme().openWith`.
 *
 * Khu này LỌC LẤY `durationDays === 1` ngay tại đây thay vì nhận mảng đã lọc sẵn:
 * tiêu đề tự khai một con số ("4 of these trips…") nên phép đếm và phép lọc phải
 * ở CÙNG một chỗ. Tách ra hai tầng là mở đường cho tiêu đề nói một số mà lưới
 * bên dưới vẽ một số khác — đúng họ lỗi mà `regionGlance()` đi tránh.
 *
 * Truyền vào nên là **chuyến RIÊNG của vùng** (`ownToursInRegion`) cho khớp với
 * khu phổ; trên mock hiện tại hai định nghĩa cho cùng kết quả vì chuyến xuyên
 * vùng dài 12 ngày nên đằng nào cũng rụng ở bộ lọc một-ngày.
 */
export function RegionDayTrips({ tours }: { tours: readonly MockTourCard[] }) {
  const t = messages.regionPage.dayTrips;
  const dayTrips = tours.filter((tour) => tour.durationDays === 1);

  if (dayTrips.length < MIN_TRIPS) return null;

  return (
    <section
      style={{ background: SIGNATURE_BAND_BG }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` là `text-foreground`, KHÔNG tô `--primary` — trên
              băng phớt này primary đo 3.03:1 ở dark, dưới ngưỡng 4.5 chữ nhỏ. */}
          <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.heading(dayTrips.length)}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{t.subtitle}</p>
        </div>

        {/* `auto-fit` chứ không `lg:grid-cols-4` cố định: số chuyến một ngày là
            dữ liệu, không phải hằng. Bốn cột cứng để lại hai ô trống khi vùng chỉ
            có hai chuyến, và ép chữ xuống quá hẹp khi có sáu. */}
        <ul className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 sm:mt-14 sm:gap-5">
          {dayTrips.map((tour) => (
            <li key={tour.slug} data-day-trip={tour.slug}>
              {/* `bg-muted` chứ không `bg-background/60`: đo 29/07 trên nền băng
                  thì `background/60` chỉ tách được **1.05:1 light / 1.11:1 dark**
                  — ô gần như tan vào băng và chỉ còn cái viền giữ hình. `muted`
                  cho 1.10 / 1.29, cân nhất trong các token bề mặt của bảng màu
                  (đo cả `card` 1.15/1.03 và `background` 1.09/1.19), và ở CẢ HAI
                  theme nó lệch cùng một hướng "xám hơn băng" nên đọc ra một panel
                  lồng. Không token bề mặt nào của bảng này chạm 3:1 với băng —
                  đó là đặc tính bảng màu, không phải lỗi của khu; thứ ĐỊNH DANH ô
                  là chữ trong nó (13.30 / 11.81), không phải mảng nền. */}
              <Link
                href={`/tours/${tour.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-muted p-5 transition-colors hover:border-foreground/30"
              >
                <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  {tour.category.name}
                </span>
                {/* `flex-1` để giá luôn tụt xuống đáy ô dù tiêu đề dài ngắn khác
                    nhau — hàng giá đọc thành một dòng ngang, không so le. */}
                <span className="mt-3 flex-1 font-heading text-lg font-medium text-pretty text-foreground group-hover:text-primary">
                  {tour.title}
                </span>
                {/* KHÔNG in "1 day" ở đây: cả khu đã là "chuyến một ngày", lặp
                    lại trên từng ô là in cùng một sự thật năm lần. */}
                <span className="mt-4 text-sm font-medium text-foreground">
                  {formatMoney(tour.basePrice, tour.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
