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
}

/** Ảnh chuẩn của app — cache đĩa + placeholder nền `muted` lúc tải (ADR-0047 §4). */
export function AppImage({
  source,
  width,
  height,
  alt,
  transformUrl = (src) => src,
  ...rest
}: AppImageProps) {
  const theme = useTheme();
  const uri = transformUrl(source, width);

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      style={{ width, height: height ?? width, backgroundColor: theme.colors.muted }}
      transition={200}
      {...rest}
    />
  );
}
