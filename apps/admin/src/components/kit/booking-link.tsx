import Link from 'next/link';

/**
 * Link chéo sang `/bookings/[code]` — một cách vẽ mã booking cho MỌI bảng
 * và drawer vùng admin (vòng vá review F8: bảng cancellations, bảng
 * payment events và drawer payment events từng chép cùng một `<Link>` với
 * cùng chuỗi class ba lần; đổi kiểu link ở một chỗ là hai chỗ kia lệch).
 *
 * `code` null → in `fallback` mờ (event không gắn booking, booking không
 * còn). Href derive từ code ngay tại đây — VM không cần mang thêm một field
 * `bookingHref` chỉ để nói lại điều `bookingCode` đã nói.
 */
export function BookingLink({
  code,
  fallback,
  href,
}: {
  code: string | null;
  /** Chữ thay ô trống khi không có booking; bắt buộc để nơi gọi không quên ca null. */
  fallback: string;
  /**
   * Đích tuỳ chọn: bảng `/bookings` truyền href MANG bộ lọc đang xem (vòng
   * đi–về không nhả filter); mặc định là đường trần từ `code`. Thêm ở vòng vá
   * review 05/09 để ô Code của `/bookings` thôi là bản chép thứ hai của link này.
   */
  href?: string;
}) {
  if (!code) return <span className="text-xs text-muted-foreground">{fallback}</span>;
  return (
    <Link
      href={href ?? `/bookings/${code}`}
      className="font-medium text-foreground underline-offset-4 hover:underline"
    >
      {code}
    </Link>
  );
}
