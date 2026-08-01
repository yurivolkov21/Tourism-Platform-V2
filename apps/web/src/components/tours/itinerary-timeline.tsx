import { messages } from '@tourism/i18n';
import { MapPinIcon } from 'lucide-react';
import type { ItineraryDayVM } from '@/lib/api/tours';

/**
 * Timeline dọc, MỞ HẾT — không accordion. Mô tả từng ngày của contract v2 ngắn
 * (text thuần ≤2000, không Markdown như Nexora), giấu sau accordion thì trang
 * chỉ còn một cột tiêu đề và người đọc phải bấm 8 lần để biết chuyến đi có gì.
 *
 * Đường kẻ dọc dựng bằng một `<span>` `flex-1 w-px` nằm dưới ô số, KHÔNG bằng
 * pseudo-element tính chiều cao: flex tự kéo nó đúng phần còn lại của mục, nên
 * mục có mô tả dài hay chỉ có tiêu đề đều nối liền mạch.
 */
export function ItineraryTimeline({
  days,
  meetingPoint,
}: {
  days: ItineraryDayVM[];
  /** Điểm hẹn gắn vào Day 1 — nó là thông tin của NGÀY ĐẦU, không phải của cả
      tour. `null` thì không render thẻ nào. */
  meetingPoint: string | null;
}) {
  const t = messages.tourDetail;

  return (
    <ol className="mt-6">
      {days.map((day, index) => {
        const isLast = index === days.length - 1;

        return (
          <li key={day.dayNumber} className="flex gap-5">
            {/* Rail trái: ô số + đường kẻ nối xuống mục sau. */}
            <div className="flex flex-col items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background font-mono text-xs tabular-nums text-primary">
                {/* Số hiện ra ở dạng gọn "01"; trình đọc màn hình nghe câu đủ
                    "Day 1" vì nghe trần "01" thì không biết đó là số gì. */}
                <span className="sr-only">{t.itinerary.dayLabel(day.dayNumber)}</span>
                <span aria-hidden="true">{String(day.dayNumber).padStart(2, '0')}</span>
              </span>
              {!isLast ? <span aria-hidden="true" className="w-px flex-1 bg-border" /> : null}
            </div>

            <div className={isLast ? 'min-w-0 pb-0' : 'min-w-0 pb-8'}>
              <h3 className="font-heading text-lg leading-snug font-medium text-foreground">
                {day.title}
              </h3>

              {/* description null → CHỈ hiện tiêu đề. Không chèn placeholder,
                  không bỏ mục: nhịp dọc của timeline vẫn phải đều.

                  `whitespace-pre-line`: mô tả API là text thuần (không
                  Markdown) nhưng biên tập vẫn dùng `\n` để tách từng mốc giờ
                  ("07:30 — …\n12:00 — …"). Mặc định trình duyệt gộp mọi
                  whitespace kể cả `\n` thành một dấu cách, dồn cả lịch trình
                  thành một dòng dài. KHÔNG parse chuỗi này thành danh sách
                  (luật cứng — regex đoán định dạng là hack `tour-detail-
                  derive.ts` của Nexora đã bị loại): chỉ đổi CSS để giữ nguyên
                  xuống dòng đã có sẵn trong dữ liệu. */}
              {day.description ? (
                <p className="mt-1.5 max-w-[68ch] text-pretty whitespace-pre-line text-muted-foreground">
                  {day.description}
                </p>
              ) : null}

              {index === 0 && meetingPoint ? (
                <p className="mt-3 inline-flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t.itinerary.meetAt(meetingPoint)}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
