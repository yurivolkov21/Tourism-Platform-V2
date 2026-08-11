import { messages } from '@tourism/i18n';

/**
 * Header trang hộ chiếu (M1/M4): tên serif LÀM CHỦ trang giấy + "traveler
 * since". RSC thuần — dữ liệu tính sẵn ở page, component chỉ xếp chữ.
 *
 * Vòng tu sửa 11/08 từng thử đúng giải phẫu data page (hàng Zone I mở đầu +
 * caption đánh số (1)(2)… quanh tên) và bị user bác — trang đọc như form
 * hành chính, mất chất cảm xúc. Chốt lại: danh tính giữ khuôn giản dị này;
 * "đồ đạc giấy tờ" (Type/Code/Passport No. + MRZ) sống ở dải máy đọc cuối
 * section do page render. Nút Settings cũng đã RỜI tờ giấy (góp ý cùng
 * ngày): giờ ở action của `ContentHero` + menu avatar navbar — trên giấy
 * không còn control UI nào, chỉ còn giấy tờ.
 */
export function PassportHeader({ name, sinceYear }: { name: string; sinceYear: number }) {
  const t = messages.passportHome;
  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold text-balance md:text-4xl">{name}</h1>
      <p className="mt-1 text-[12.5px] tracking-[0.16em] text-muted-foreground uppercase">
        {t.since(sinceYear)}
      </p>
    </div>
  );
}
