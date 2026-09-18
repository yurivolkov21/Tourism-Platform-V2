import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/components/brand-icon';

// Icon màn hình chính iOS. Góc vuông (radius 0) vì iOS tự cắt bo góc theo mặt
// nạ của nó — bo sẵn thì thành hai lớp bo lệch nhau.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={size.width} radius={0} />, size);
}
