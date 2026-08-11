import type { ReactNode } from 'react';

/**
 * Khung khu `/account` thời Hộ chiếu (spec 2026-08-11 + hai vòng góp ý user
 * 11/08):
 *
 * 1. Mỗi trang con MỞ BẰNG `ContentHero` (tái dùng hero chuẩn của site — góp
 *    ý vòng 2: đừng chế band riêng, lấy hero có sẵn cho nhất quán); hero tự
 *    lo khoảng né navbar (`pt-36`) nên layout không đệm top nữa.
 * 2. `bg-paper` phủ TRỌN khu + `min-h-dvh` (trang ngắn không lộ nền) +
 *    `-mb-32` trung hoà `mt-32` của SiteFooter (nguồn thật của "dải trắng
 *    trước footer": margin đó lộ nền body — trang public trùng màu nên vô
 *    hình, trên giấy thì hiện). KHÔNG sửa footer vì mọi trang khác dựa vào nó.
 * 3. Texture giấy nằm trong `PassportPaper` bọc phần dưới hero của từng trang
 *    (không thể ở layout — sẽ kẻ sọc lên hero tối).
 *
 * KHÔNG gọi `requireSession`/`getServerSession` ở đây — mỗi trang con tự gate
 * + fetch dữ liệu của chính nó (quyết định từ cụm A, lý do cũ vẫn đúng).
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  // `pb-20/24`: hơi thở giữa thân trang và footer (góp ý user 11/08 — bản
  // chuyển sang ContentHero từng làm rơi mất phần đệm đáy của layout cũ).
  return (
    <div className="-mb-32 flex min-h-dvh w-full flex-col bg-paper pb-20 md:pb-24">{children}</div>
  );
}
