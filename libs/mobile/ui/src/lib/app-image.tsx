import { Image, type ImageProps } from 'expo-image';
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

/** Ảnh chuẩn của app — cache đĩa + placeholder nền `muted` lúc tải (ADR-0047 §4). */
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
  const uri = transformUrl(source, width);

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
