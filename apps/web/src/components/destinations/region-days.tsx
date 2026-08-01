import { messages } from '@tourism/i18n';
import { MoveRightIcon } from 'lucide-react';
import Link from 'next/link';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { RevealItem } from '@/components/motion/reveal-item';
import type { TourCardVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';
import { SIGNATURE_BAND_BG } from '@/lib/region-theme';

/** Dưới ngưỡng này thì khu KHÔNG dựng. Tiêu đề hứa "một buổi sáng, một cuối tuần,
    HAY một tuần" — với một nhóm duy nhất thì lời hứa đó trống, và khu đọc thành
    một danh sách tour thứ hai đứng cạnh lưới tour thật. Đây cũng là lý do khu này
    là khu RIÊNG của miền Bắc: Trung có bốn chuyến cùng một ngày → một nhóm. */
const MIN_BRACKETS = 2;

/**
 * Ba lối vào theo thời lượng, thứ tự ngắn → dài.
 *
 * `short` bắt `<= 1` chứ không `=== 1`: `durationDays` 0 là dữ liệu hỏng có thật
 * khi gắn API, và ba điều kiện rời nhau sẽ để nó rơi ra ngoài CẢ BA nhóm — chuyến
 * biến mất khỏi trang mà không có gì báo. Ba vị từ ở đây phủ kín mọi số.
 *
 * Ranh giới 1 · 2–3 · ≥4 KHÔNG phải chia đều cho đẹp: nó là cách người ta thật sự
 * xếp lịch — một ngày rảnh, một cuối tuần, hay một tuần phép.
 */
const BRACKETS = [
  { key: 'short', holds: (days: number) => days <= 1 },
  { key: 'weekend', holds: (days: number) => days >= 2 && days <= 3 },
  { key: 'long', holds: (days: number) => days >= 4 },
] as const;

/**
 * Khu "Bạn có mấy ngày?" — CHỈ miền Bắc dựng.
 *
 * ⚠️ Đây là bản THAY THẾ cho khu phổ ngày × độ khó mà user bác thẳng: *"khách du
 * lịch vào trang này để tham khảo xem những gì đặc sắc có ở miền bắc, nhưng ập vào
 * mặt là một cái đồ thị. Đây là trang giao diện web cho người dùng xem chứ đâu
 * phải dashboard báo cáo dành cho admin."* Khu này nói CÙNG một sự thật (miền Bắc
 * là vùng duy nhất trải 1–8 ngày) bằng ngôn ngữ khách du lịch: bạn có mấy ngày, và
 * đây là những chuyến vừa với số ngày đó.
 *
 * Vì vậy: **không trục, không thanh tỉ lệ, không mốc số, không ô có chiều dài tỉ
 * lệ với dữ liệu.** Ba thẻ chỉ có chữ và link — `region-days.spec.tsx` canh rằng
 * không có `role="meter"`/`role="progressbar"` và không style inline nào đặt
 * `width`/`height`. Nếu về sau ai thấy cần "hình hoá" khu này thì đó chính là cái
 * bẫy vừa bị bác lần thứ ba.
 *
 * Truyền vào phải là **chuyến RIÊNG của vùng** (`ownToursInRegion`): tour xuyên
 * vùng `north-to-south-classic` dài 12 ngày, và nó sẽ nhảy vào nhóm "một tuần trên
 * đường" của cả ba miền — quảng cáo cho miền Bắc một hành trình mà phần lớn thời
 * gian ở nơi khác.
 *
 * Nhóm được LỌC ngay tại đây thay vì nhận mảng đã chia sẵn: mỗi thẻ tự khai số
 * chuyến của nó, nên phép đếm và phép lọc phải ở CÙNG một chỗ — tách ra hai tầng
 * là mở đường cho nhãn "3 trips" đứng trên một danh sách 2 dòng.
 */
export function RegionDays({ tours }: { tours: readonly TourCardVM[] }) {
  const t = messages.regionPage.days;

  // `durationDays` tăng dần trong từng nhóm, và `[...tours]` vì `sort` sửa tại chỗ
  // — sắp thẳng mảng props là sửa dữ liệu của nơi gọi.
  const sorted = [...tours].sort((a, b) => a.durationDays - b.durationDays);

  const groups = BRACKETS.map((bracket) => ({
    key: bracket.key,
    copy: t.brackets[bracket.key],
    tours: sorted.filter((tour) => bracket.holds(tour.durationDays)),
    // Nhóm rỗng BỎ HẲN thẻ (lọc ngay dưới) — in "0 trips" là một ô trống nói rằng
    // vùng này không có gì cho bạn, và đó là ô người đọc nhìn kỹ nhất.
  })).filter((group) => group.tours.length > 0);

  if (groups.length < MIN_BRACKETS) return null;

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
          {/* Cascade header (Task 5m) — xem `motion/reveal-header.tsx`. Chỉ trượt
              `y`: `region-days.spec.tsx` canh rằng không `[style]` nào đặt
              `width`/`height`, và một transform không đụng tới hai thuộc tính đó. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.heading}
          </RevealHeading>
          <RevealLede className="mt-2 text-lg text-pretty text-muted-foreground">
            {t.subtitle}
          </RevealLede>
        </div>

        {/* `auto-fit` chứ không `lg:grid-cols-3` cố định: số nhóm dựng được là dữ
            liệu (một vùng có thể chỉ có hai nhóm), và ba cột cứng để lại một ô
            trống ở cuối hàng. */}
        <ul className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-x-10 gap-y-12 sm:mt-16">
          {groups.map((group, i) => (
            <li key={group.key} data-bracket={group.key}>
              {/* ── Chữ ký miền BẮC: trồi lên theo `y`, nối tiếp trái→phải (Task 5n) ──
                  Nhịp nằm trên `RevealItem` chứ không trên `<li>`: `li` phải giữ
                  `data-bracket` trơ cho `region-days.spec.tsx`, và `border-t` phải đi
                  CÙNG nội dung — một vạch đứng im trên ba thẻ đang trồi lên thì đọc
                  thành hai mảnh rời.
                  `region-days.spec.tsx` canh rằng không `[style]` nào đặt
                  `width`/`height`; một transform không đụng tới hai thuộc tính đó. */}
              <RevealItem
                enter="rise"
                delay={i * STAGGER.grid}
                className="border-t border-border pt-6"
              >
                {/* Số chuyến ĐỨNG TRÊN tiêu đề và ở cỡ nhỏ nhất của thẻ: nó là ngữ
                    cảnh, không phải điểm so sánh giữa ba thẻ. Đặt nó to ngang tiêu
                    đề là mời người đọc so ba con số với nhau — tức là đọc thẻ như
                    một cột của biểu đồ. */}
                <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  {t.tripCount(group.tours.length)}
                </span>
                <h3 className="mt-2 font-heading text-2xl font-medium text-balance text-foreground">
                  {group.copy.title}
                </h3>
                {/* ── Hợp đồng SỐ DÒNG (Task 5o) ──
                    Câu này là phần tử DUY NHẤT của thẻ đổi số dòng theo bề ngang, và
                    ngay dưới nó là một `border-t`: lệch một dòng ở đây tức hai thẻ
                    cạnh nhau có VẠCH NGANG ở hai độ cao khác nhau. Đo ở 768 (hai thẻ
                    một hàng) trước khi vá: "Out after breakfast, back before dark."
                    chiếm 1 dòng còn thẻ bên cạnh chiếm 2, và danh sách chuyến tụt
                    **24px**.
                    Chỉ GIỮ CHỖ, KHÔNG `line-clamp`: đây là một câu biên tập ngắn
                    trong hộp rộng gấp đôi thẻ chuyến-một-ngày nên không có gì để cắt,
                    mà kẹp dòng thì một bản dịch dài hơn sẽ mất chữ — đổi một lỗi hình
                    thành một lỗi nội dung. `region-day-trips.tsx` clamp vì hộp ở đó
                    hẹp 233px và tiêu đề tour tới từ API, không có trần. */}
                <p data-bracket-body className="mt-2 min-h-[2lh] text-pretty text-muted-foreground">
                  {group.copy.body}
                </p>

                {/* Tên chuyến THẬT, mỗi tên một link. Đây là thứ khu này tồn tại để
                    đưa ra: không phải "miền Bắc trải 1–8 ngày" như một con số, mà
                    "đây là chuyến bạn đi được với số ngày bạn có". */}
                <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
                  {group.tours.map((tour) => (
                    <li key={tour.slug}>
                      <Link
                        href={`/tours/${tour.slug}`}
                        className="group flex items-baseline gap-2 text-pretty text-foreground transition-colors hover:text-primary"
                      >
                        <MoveRightIcon
                          aria-hidden="true"
                          className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-colors group-hover:text-primary"
                        />
                        {tour.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </RevealItem>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
