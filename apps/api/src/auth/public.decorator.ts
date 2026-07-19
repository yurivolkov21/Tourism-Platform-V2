import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu route KHÔNG cần đăng nhập (ADR-0003).
 *
 * `AuthGuard` chạy toàn cục nên mặc định của repo này là **fail-closed**:
 * im lặng nghĩa là CẦN auth. Chỉ gắn `@Public()` khi đã trả lời được câu
 * "vì sao khách ẩn danh phải gọi được endpoint này?" — và ghi lý do vào
 * comment ngay tại chỗ gắn.
 *
 * Gắn được ở cả class lẫn method (method thắng — xem `getAllAndOverride`).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
