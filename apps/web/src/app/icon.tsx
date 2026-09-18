import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/components/brand-icon';

// Favicon cho tab trình duyệt — thay `favicon.ico` mặc định của create-next-app
// (logo Vercel, có từ lúc scaffold 22/07) mà user bắt được 18/09.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<BrandIcon size={size.width} radius={7} />, size);
}
