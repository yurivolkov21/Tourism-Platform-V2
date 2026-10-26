import { BookingCodeSchema, isAllowedAppReturnUrl, withAppReturnParams } from '@tourism/contract';

/**
 * Đích của trang `/checkout/app-return` (ADR-0062): URL app mobile kèm mã đơn và kết quả cổng.
 * Không tin query string — `to` phải qua đúng luật của contract mà API đã dùng lúc dựng URL, mã
 * đơn phải đúng khuôn. Sai bất cứ gì thì `null`: trang hiện lời báo, không chuyển đi đâu.
 */
export function appReturnTarget(params: {
  to?: string;
  code?: string;
  status?: string;
}): string | null {
  const { to, code, status } = params;
  if (to === undefined || !isAllowedAppReturnUrl(to)) return null;
  const parsed = code === undefined ? null : BookingCodeSchema.safeParse(code);
  if (!parsed?.success) return null;
  return withAppReturnParams(to, parsed.data, status === 'cancelled' ? 'cancelled' : 'success');
}
