import type { Href } from 'expo-router';

/** Phần `router` mà `backToTourDates` cần — cùng nếp `LeaveAuthNavigator`. */
export interface LeaveBookingNavigator {
  dismissTo(href: Href): void;
  replace(href: Href): void;
}

/**
 * B9 "Choose another date": rời cụm đặt tour về ĐÚNG trang tour đã mở cụm, mở lại ở tab Dates.
 *
 * Cụm đặt tour là Stack riêng lồng trong stack gốc, nên `replace` gọi từ trong cụm dựng một trang
 * tour THỨ HAI đè lên trang cũ — phải back hai lần mới ra (cùng loại lỗi R3 mà `leaveAuthTo` sửa
 * cho Sign in). `dismissTo` gỡ cả cụm và dừng ở trang tour cũ; `replace` sau đó thay trang ấy
 * bằng bản mới, vì trang tour chỉ đọc `tab` lúc mount và còn giữ đợt vừa hết ghế. Bản mới mở tab
 * Dates, chưa chọn đợt nào, và đọc lại ghế.
 */
export function backToTourDates(nav: LeaveBookingNavigator, tourSlug: string): void {
  nav.dismissTo(`/tours/${tourSlug}`);
  nav.replace(`/tours/${tourSlug}?tab=dates`);
}
