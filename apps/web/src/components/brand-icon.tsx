import theme from '@tourism/tokens/theme';
import { LOGO_MARK } from '@/components/logo';

/**
 * Màu của icon lấy từ `@tourism/tokens/theme` chứ không viết hex tay (CLAUDE.md
 * luật 6): `ImageResponse` vẽ ra PNG ở phía server nên không đọc được biến CSS
 * của `tokens.css`, và bản JS của token là nguồn duy nhất cùng giá trị với nó.
 * Thiếu token thì ném lúc build — một favicon sai màu âm thầm tệ hơn build đỏ.
 */
function tokenColor(name: string): string {
  const value = theme.colors.light[name];
  if (!value) throw new Error(`@tourism/tokens thiếu màu "${name}"`);
  return value;
}

/**
 * Favicon Nexora (user chọn 18/09): hai viên kim cương của logo màu sáng trên ô
 * vuông nền primary — đọc rõ trên cả thanh tab sáng lẫn tối, khác logo navbar
 * (viên trước màu mực tối, chìm hẳn trên tab tối).
 *
 * Đây là JSX cho `ImageResponse` (satori): chỉ flexbox và style inline. Viên
 * sau mờ đi để giữ nhịp hai tông của logo gốc.
 */
export function BrandIcon({ size, radius }: { size: number; radius: number }) {
  const markWidth = Math.round(size * 0.72);
  // 33/46 = tỉ lệ viewBox của mark.
  const markHeight = Math.round((markWidth * 33) / 46);
  const ink = tokenColor('primary-foreground');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokenColor('primary'),
        borderRadius: radius,
      }}
    >
      {/* Vẽ ra PNG chứ không vào DOM; `aria-hidden` cho khớp `Logo` và luật a11y của Biome. */}
      <svg aria-hidden="true" width={markWidth} height={markHeight} viewBox={LOGO_MARK.viewBox}>
        <path d={LOGO_MARK.back} fill={ink} fillOpacity={0.55} />
        <path d={LOGO_MARK.front} fill={ink} />
      </svg>
    </div>
  );
}
