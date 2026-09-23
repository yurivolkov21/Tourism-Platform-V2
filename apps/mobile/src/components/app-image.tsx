import { type AppImageProps, AppImage as BaseAppImage } from '@tourism/mobile-ui';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

export type { AppImageProps };

/**
 * `AppImage` đã gắn sẵn `cloudinaryUrl()` làm `transformUrl` — dùng bản này
 * trong `apps/mobile`, ĐỪNG dùng thẳng bản từ `@tourism/mobile-ui` (mặc định
 * không transform gì, tải nguyên ảnh gốc, không cảnh báo). `@tourism/mobile-ui`
 * không tự import `cloudinaryUrl()` để giữ ranh giới phụ thuộc một chiều
 * (ADR-0040 §2) — chỗ ghép này chính là tầng app đứng ra ghép hộ.
 */
export function AppImage(props: Omit<AppImageProps, 'transformUrl'>) {
  return <BaseAppImage {...props} transformUrl={cloudinaryUrl} />;
}
