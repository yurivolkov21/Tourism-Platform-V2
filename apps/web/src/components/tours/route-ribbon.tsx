import { messages } from '@tourism/i18n';
import { MapPinIcon } from 'lucide-react';
import { routeChain } from '@/lib/tours';
import type { MockDestinationLink } from '@/mocks/types';

/**
 * Chuỗi chặng của tour: chấm nối bằng gạch, tên dưới mỗi chấm, mỗi tên là link
 * lọc listing theo địa danh đó.
 *
 * VÌ SAO CÓ NÓ: contract không có field ảnh nào và cũng không có bản đồ, trong
 * khi sản phẩm thật đều cho khách thấy tour đi qua đâu (G Adventures vẽ map;
 * Intrepid rút về `Start: Ho Chi Minh City` / `End: Hanoi`). Đây là bản rút gọn
 * TRUNG THỰC của thứ đó: vector sinh từ `destinations[]` thật, không phải hình
 * minh hoạ tự vẽ.
 *
 * VÌ SAO KHÔNG CÓ NHÃN "START"/"END": `destinations[]` là bảng join M:N — "các
 * nơi tour đi qua", primary đứng đầu theo `routeChain`. Nó KHÔNG phải hành trình
 * có điểm đầu điểm cuối theo thời gian. Gắn Start/End vào là bịa ra ý nghĩa mà
 * dữ liệu không có; thứ tự thời gian nằm ở `itinerary[]`, không nằm ở đây.
 *
 * Gạch nối rộng CỐ ĐỊNH, không `flex-1`: chia đều khoảng trống sẽ ngụ ý các
 * chặng cách nhau bằng nhau, mà ta không biết điều đó. Rộng cố định thì hàng
 * hugs nội dung và cuộn ngang gọn trên mobile.
 */
export function RouteRibbon({
  destinations,
  className,
}: {
  destinations: MockDestinationLink[];
  className?: string;
}) {
  const chain = routeChain(destinations);
  const first = chain[0];

  // Không có địa danh nào: không render gì. Contract cho phép mảng rỗng về mặt
  // kiểu, dù mock nào cũng có ít nhất một.
  if (!first) return null;

  // MỘT địa danh: không vẽ sơ đồ. Một chấm đơn độc trên một đường kẻ là sơ đồ
  // của thứ không phải hành trình — nó trông như lỗi render. Nói thẳng nó ở đâu.
  if (chain.length === 1) {
    return (
      <p className={className}>
        <a
          href={`/tours?destinations=${first.slug}`}
          aria-label={messages.tourDetail.route.viewTours(first.name)}
          className="inline-flex items-center gap-2 font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          <MapPinIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {messages.tourDetail.route.single(first.name)}
        </a>
      </p>
    );
  }

  return (
    // data-lenis-prevent: Lenis (smooth scroll toàn site) chặn wheel trên cả tài
    // liệu, nên lăn chuột trong vùng cuộn lồng lại cuộn TRANG CHÍNH. Thuộc tính
    // này trả wheel về cho vùng cuộn bên trong. Thanh cuộn 4px màu primary của
    // site cứ để hiện — nó là dấu hiệu "còn chặng nữa bên phải".
    <div data-lenis-prevent className={className}>
      <ol
        aria-label={messages.tourDetail.route.label}
        className="flex items-start overflow-x-auto pb-1"
      >
        {chain.map((dest, i) => (
          <li key={dest.slug} className="flex shrink-0 items-start">
            {/* Gạch nối đứng TRƯỚC chấm (trừ chấm đầu) nên nó luôn nằm giữa hai
                chặng. mt-[0.3125rem] = nửa chiều cao chấm size-2.5, để gạch cắt
                đúng tâm chấm thay vì tâm cả cột (cột còn có tên bên dưới). */}
            {i > 0 ? (
              <span aria-hidden="true" className="mt-[0.3125rem] h-px w-8 bg-border sm:w-12" />
            ) : null}

            <a
              href={`/tours?destinations=${dest.slug}`}
              aria-label={messages.tourDetail.route.viewTours(dest.name)}
              className="group flex flex-col items-center gap-2 px-2"
            >
              <span
                aria-hidden="true"
                className={
                  dest.isPrimary
                    ? // Chặng chính: chấm ĐẶC + vòng ngoài. Cùng thứ bậc mà card
                      // listing đã dạy bằng chữ (primary in đậm) — chỉ là bản
                      // cỡ hero của cùng sự thật đó.
                      'size-2.5 shrink-0 rounded-full bg-primary ring-2 ring-primary/25'
                    : 'size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/60 bg-transparent transition-colors group-hover:border-foreground'
                }
              />
              <span
                className={
                  dest.isPrimary
                    ? 'font-mono text-xs tracking-widest text-foreground uppercase'
                    : 'font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors group-hover:text-foreground'
                }
              >
                {dest.name}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
