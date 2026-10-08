import { Image, type ImageProps } from 'expo-image';
import { PixelRatio } from 'react-native';
import { useTheme } from './theme-provider';

export interface AppImageProps extends Omit<ImageProps, 'source' | 'style' | 'accessibilityLabel'> {
  /** URL gốc (thường là Cloudinary) — CHƯA transform. */
  source: string;
  /** Bề rộng dp cần render — truyền vào `transformUrl` để Cloudinary co ảnh đúng cỡ. */
  width: number;
  height?: number;
  alt: string;
  /**
   * Hàm build URL transform. Mặc định KHÔNG transform gì (trả nguyên `source`) —
   * `@tourism/mobile-ui` không phụ thuộc ngược `apps/mobile` (ADR-0040 §2) nên
   * không tự import `cloudinaryUrl()`; app truyền vào lúc dùng, hoặc dựng một
   * `AppImage` đã curry sẵn `transformUrl` ở tầng app nếu muốn khỏi truyền lặp lại.
   */
  transformUrl?: (source: string, width: number) => string;
  /**
   * Phủ KÍN khung cha (`100%` cả hai chiều) thay vì lấy số đo từ
   * `width`/`height`. Dùng cho ảnh nền nằm trong khung `absoluteFill` mà chiều
   * cao do khung cha quyết định — `width` vẫn dùng để dựng URL transform.
   */
  fill?: boolean;
}

/** Mật độ tối đa khi xin ảnh — trên 2x mắt không phân biệt được ở ảnh chụp. */
const MAX_IMAGE_DENSITY = 2;

/**
 * Đổi bề rộng dp ra số pixel vật lý cần xin Cloudinary. Kẹp mật độ ở 2: máy 3x
 * mà xin đủ 3x là tải gấp 2.25 lần số điểm ảnh của 2x (L2) — nặng mạng, không
 * nét hơn thấy được.
 */
export function physicalWidth(width: number, density: number): number {
  return Math.round(width * Math.min(density, MAX_IMAGE_DENSITY));
}

/** Ảnh chuẩn của app — cache đĩa + placeholder nền `muted` lúc tải (ADR-0055 §4). */
export function AppImage({
  source,
  width,
  height,
  alt,
  transformUrl = (src) => src,
  fill = false,
  ...rest
}: AppImageProps) {
  const theme = useTheme();
  // Cloudinary co ảnh về ĐÚNG số pixel yêu cầu — truyền thẳng `width` (đơn vị
  // dp) là xin ảnh 1 pixel vật lý cho mỗi dp, trong khi máy thật vẽ 2-3 pixel
  // vật lý/dp. Kết quả: ảnh đủ để lấp khung nhưng mờ hẳn trên màn hình mật độ
  // cao — đúng triệu chứng phản hồi 27/09 (avatar mờ trên máy thật, Jest
  // không bắt được vì mock không chạy trên màn hình thật). Nhân theo
  // `PixelRatio.get()` trước khi build URL — sửa Ở ĐÂY (một chỗ) là mọi
  // `AppImage` trong app nét lại, không riêng avatar. Nơi gọi chỉ truyền dp,
  // đừng tự nhân thêm.
  const uri = transformUrl(source, physicalWidth(width, PixelRatio.get()));

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      style={
        fill
          ? { width: '100%', height: '100%', backgroundColor: theme.colors.muted }
          : { width, height: height ?? width, backgroundColor: theme.colors.muted }
      }
      contentFit="cover"
      transition={200}
      {...rest}
    />
  );
}
