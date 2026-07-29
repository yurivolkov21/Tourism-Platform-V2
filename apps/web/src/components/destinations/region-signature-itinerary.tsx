import { messages } from '@tourism/i18n';
import { ArrowRightIcon } from 'lucide-react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import type { MockItineraryDay } from '@/mocks/types';

/**
 * Biến thể Signature "itinerary" — timeline DỌC theo ngày, hiện chỉ miền Bắc dùng.
 * Thay cho biến thể `stats` cũ: bốn con số đã lên hero, giữ chúng ở đây nữa là in
 * cùng một dải hai lần trên một trang.
 *
 * Miền Trung cũng là timeline đánh số, và đó là đánh đổi đã nói rõ với user
 * (29/07). Hai khu không đọc thành một vì HÌNH khác hẳn: đây là cột DỌC 8 chặng
 * theo NGÀY, kia là ba cột NGANG theo THỜI KỲ. Nếu sau này ai định "gộp cho gọn",
 * đọc lại câu này trước.
 *
 * Dữ liệu là itinerary của MỘT tour có thật trong vùng (chuyến dài nhất riêng của
 * vùng — xem `longestTourInRegion`), không phải văn bản gõ tay trong i18n: dòng
 * ghi công dưới cùng dẫn thẳng sang trang tour đó, nên nội dung phải khớp.
 */
export function RegionSignatureItinerary({
  eyebrow,
  heading,
  body,
  points,
  tour,
  days,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  points: readonly string[];
  tour: { slug: string; title: string };
  days: readonly MockItineraryDay[];
}) {
  const t = messages.regionPage;

  return (
    <section
      style={{ background: 'color-mix(in oklch, var(--region-surface), var(--background) 88%)' }}
      className="w-full px-4 py-20 md:px-16 md:py-24 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` (quy ước toàn site, 21 component dùng) thay cho eyebrow
              `font-mono` tự chế port từ Nexora. Nó dùng `text-foreground`, KHÔNG
              `--region-primary`: token vùng KHÔNG đổi theo theme, nên tô nó lên chữ
              là một trong hai theme sẽ hỏng — đúng lỗi đã đo ở
              `region-signature-timeline.tsx` (1.31:1 ở dark). Màu vùng ở khu này chỉ
              đi vào CHẤM TRẠM và chấm đầu dòng, nơi nó là hình khối chứ không phải
              chữ. Eyebrow trên nền phớt này đo được 13.22:1 light / 10.02:1 dark. */}
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {heading}
          </h2>
          <p className="mt-2 text-lg text-pretty text-muted-foreground">{body}</p>

          {/* `points` rỗng thì bỏ hẳn `<ul>` — một danh sách không mục vẫn ăn
              `mt-8` (32px) và để lại một khoảng hở không ai giải thích được. */}
          {points.length > 0 ? (
            <ul className="mt-8 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-foreground">
                  <span
                    aria-hidden="true"
                    style={{ background: 'var(--region-primary)' }}
                    className="mt-2 size-2 shrink-0 rounded-full"
                  />
                  <span className="text-pretty">{point}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <ol className="mt-14 sm:mt-16">
          {days.map((day, index) => {
            const isFirst = index === 0;
            const isLast = index === days.length - 1;
            // Chấm ĐẶC ở chặng đầu và chặng cuối, rỗng ở giữa: hai đầu là điểm
            // xuất phát và điểm kết, phần giữa là đường đi. Đây là thứ duy nhất
            // phân biệt các chặng nên nó phải là hình, không phải màu chữ.
            const dotStyle =
              isFirst || isLast
                ? { background: 'var(--region-primary)', borderColor: 'var(--region-primary)' }
                : { borderColor: 'var(--region-primary)' };

            return (
              // Ba cột ở sm+ (`nhãn ngày | rail | thân`), hai cột ở khổ nhỏ. Không
              // cần `col-start`: nhãn ngày `display:none` ở khổ nhỏ nên nó rời hẳn
              // khỏi lưới và hai ô còn lại tự lùi về cột 1–2.
              <li
                key={day.dayNumber}
                className="grid grid-cols-[auto_1fr] gap-x-4 sm:grid-cols-[6.5rem_auto_1fr] sm:gap-x-5"
              >
                {/* Nhãn ngày ẩn ở khổ nhỏ: cột 6.5rem ăn gần nửa bề ngang điện
                    thoại. Ở đó nó chuyển xuống ngay trên tiêu đề chặng. */}
                <span className="hidden pt-1 text-right font-mono text-xs tracking-widest text-muted-foreground uppercase sm:block">
                  {t.dayLabel(day.dayNumber)}
                </span>

                {/* Rail: chấm trạm + đường dọc chạy tiếp xuống mục sau. `flex-1`
                    để đường tự kéo đúng phần còn lại của mục, dù mục có mô tả dài
                    hay chỉ có mỗi tiêu đề. */}
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    style={dotStyle}
                    className="mt-1.5 size-3 shrink-0 rounded-full border-2 bg-background"
                  />
                  {!isLast ? <span aria-hidden="true" className="w-px flex-1 bg-border" /> : null}
                </div>

                <div className={isLast ? 'min-w-0 pb-0' : 'min-w-0 pb-9'}>
                  <span className="block font-mono text-xs tracking-widest text-muted-foreground uppercase sm:hidden">
                    {t.dayLabel(day.dayNumber)}
                  </span>
                  <h3 className="font-heading text-xl leading-snug font-medium text-foreground">
                    {day.title}
                  </h3>
                  {/* `description` là nullable — null thì bỏ hẳn đoạn, KHÔNG in
                      "null" và KHÔNG chèn chữ giữ chỗ. Hai chặng của
                      `northern-highlands-loop` đang đúng nhánh này. */}
                  {day.description ? (
                    <p className="mt-1.5 max-w-[68ch] text-pretty text-muted-foreground">
                      {day.description}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Ghi công: itinerary trên là của MỘT tour có thật, không phải hành trình
            chung của vùng. Link sang trang tour đó — trang CÓ THẬT. */}
        <a
          href={`/tours/${tour.slug}`}
          className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t.itineraryNote(tour.title)}
          <ArrowRightIcon
            className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            aria-hidden="true"
          />
        </a>
      </div>
    </section>
  );
}
