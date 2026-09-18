import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/components/brand-icon';

// Favicon cho tab trình duyệt — admin tới 18/09 không có favicon nào. Route này
// nằm trong PUBLIC_PATHS của `admin-gate.ts`, nếu không trang login mất icon.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<BrandIcon size={size.width} radius={7} />, size);
}
