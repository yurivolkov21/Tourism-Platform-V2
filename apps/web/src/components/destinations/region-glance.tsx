import { messages } from '@tourism/i18n';
import type { RegionGlance } from '@/lib/regions';
import { formatMoney } from '@/lib/tours';

/**
 * Rail "at a glance" của trang vùng — nằm TRONG hero (quyết định 1 của user
 * 29/07), không phải một băng riêng bên dưới. Vì thế nó render trên nền
 * `--region-hero` bên trong scope `dark` của hero, và dùng cặp token theo-theme
 * (`text-foreground` / `text-muted-foreground`) như mọi nội dung hero khác.
 *
 * ĐÚNG BA mục, và đó là toàn bộ hợp đồng: giá "từ" · phổ độ khó · chuyên mục.
 * Số tour và khoảng số ngày CỐ TÌNH không có mặt — `regionGlance()` đã giải
 * thích vì sao (đo trên mock: 6/6/6 tour và 1–12 ngày ở cả ba vùng, nên hai con
 * số đó là trang trí chứ không phân biệt được vùng nào với vùng nào). Số tour
 * chuyển sang eyebrow khu TRIPS, nơi nó là ngữ cảnh.
 *
 * Nhãn độ khó lấy từ `messages.toursPage.difficultyLabels` — KHÔNG khai bảng
 * nhãn thứ hai (`TourCard` từng mắc đúng lỗi này). Tiền đi qua `formatMoney`,
 * không tự format.
 */
export function RegionGlanceBar({ glance, currency }: { glance: RegionGlance; currency: string }) {
  const t = messages.regionPage.glance;
  const difficultyLabels = messages.toursPage.difficultyLabels;

  // Phổ độ khó: `difficulties` đã được `regionGlance()` sắp theo bậc tăng dần
  // nên đầu/cuối mảng chính là hai đầu của phổ. Một bậc thì in một chữ — "Easy →
  // Easy" là nói dối về một khoảng không tồn tại. Mảng rỗng (mọi tour có
  // `difficulty` null — nhánh có thật khi gắn API) thì bỏ hẳn cặp dt/dd.
  const first = glance.difficulties[0];
  const last = glance.difficulties[glance.difficulties.length - 1];
  const difficultyText =
    first === undefined || last === undefined
      ? null
      : first === last
        ? difficultyLabels[first]
        : t.difficultyRange(difficultyLabels[first], difficultyLabels[last]);

  return (
    // Hàng ngang cuộn được ở hẹp (`overflow-x-auto` + item `shrink-0`), xuống
    // dòng ở rộng. `border-t` là vạch tách rail khỏi khối tiêu đề hero.
    <dl className="mt-10 flex gap-x-12 gap-y-6 overflow-x-auto border-t border-border pt-6 md:flex-wrap md:overflow-x-visible">
      <div className="shrink-0">
        <dt className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
          {t.fromLabel}
        </dt>
        <dd className="mt-2 font-heading text-xl font-semibold text-foreground tabular-nums">
          {formatMoney(glance.fromPrice, currency)}
        </dd>
      </div>

      {difficultyText === null ? null : (
        <div className="shrink-0">
          <dt className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
            {t.difficultyLabel}
          </dt>
          <dd className="mt-2 text-foreground">{difficultyText}</dd>
        </div>
      )}

      <div className="shrink-0">
        <dt className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
          {t.categoriesLabel}
        </dt>
        {/* Nối bằng ` · ` — cùng dấu phân cách `TourCard` dùng cho hàng
            duration · difficulty, nên hai nơi đọc như một hệ. */}
        <dd className="mt-2 text-foreground">
          {glance.categories.map((category) => category.name).join(' · ')}
        </dd>
      </div>
    </dl>
  );
}
