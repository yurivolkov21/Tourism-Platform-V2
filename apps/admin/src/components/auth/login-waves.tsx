'use client';

import { theme } from '@tourism/tokens/theme';
import GradientWaves from '@tourism/ui/components/GradientWaves';
import { useEffect, useState } from 'react';

/**
 * Nền trang login = component **GradientWaves của React Bits** (user chốt
 * 20/08 — cài qua registry shadcn `@react-bits/GradientWaves-TS-TW` vào
 * `@tourism/ui`, WebGL/ogl). Wrapper này chỉ làm ba việc:
 *
 * 1. Mang `'use client'` (file registry không có directive — trang login là
 *    server component).
 * 2. Nhuộm màu theo TOKEN (component đòi hex → lấy từ bản hex sinh sẵn của
 *    `@tourism/tokens/theme`, không hardcode tay): chân trời paper, thân
 *    sóng primary, bọt sóng card.
 * 3. Tôn trọng `prefers-reduced-motion`: speed = 0 (một khung tĩnh).
 *
 * Các thông số còn lại GIỮ ĐÚNG mặc định trong panel Customize trên
 * reactbits.dev (ảnh user gửi 20/08) — muốn tinh chỉnh thì sửa cụm hằng này,
 * tên hằng khớp 1-1 với nhãn trên panel.
 */
const c = theme.colors.light;

const CUSTOMIZE = {
  speed: 0.4,
  amplitude: 2.5,
  waveScale: 0.6,
  waveRatio: 0.9,
  swell: 35,
  turbulence: 20,
  tilt: 1.11,
  zoom: 1,
  height: 5.5, // Horizon Height
  fogDepth: 15,
  detail: 'medium' as const,
  brightness: 1,
  opacity: 1,
  parallaxStrength: 0.5,
  grain: true,
  grainIntensity: 0.05,
} as const;

export function LoginWaves() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Mức BOLD — user chấm 20/08 sau vòng so đậm/nhạt. Bài học ĐO TỪ SHADER:
  // `alpha = fogDepth/dist` nên vùng xa TRONG SUỐT (lộ nền trắng của trang;
  // demo gốc "đậm" vì nền TỐI) — độ rõ đến từ TĂNG fogDepth (nới vùng đặc
  // màu) + crest mang secondary thay vì trắng, không phải từ brightness.
  return (
    <GradientWaves
      {...CUSTOMIZE}
      horizonColor={c.primary}
      waveColor={c.ink}
      crestColor={c.secondary}
      fogDepth={28}
      amplitude={3.2}
      speed={reducedMotion ? 0 : CUSTOMIZE.speed}
      mouseInteraction={!reducedMotion}
    />
  );
}
