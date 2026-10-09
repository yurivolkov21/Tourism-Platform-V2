import { expect, it, vi } from 'vitest';

/**
 * canvas-confetti chỉ được tải khi pháo giấy THẬT SỰ bắn (review P7C mục 18): import tĩnh kéo thư
 * viện vào chunk của trang voucher cho mọi lần mở — voucher mở lại, đơn đã huỷ, khách bật giảm
 * chuyển động — trong khi chỉ khoảnh khắc vừa trả mới bắn.
 *
 * File riêng vì `vi.mock` gọi factory MỘT lần cho mỗi sổ module của một file spec: phép thử "nạp
 * component không kéo thư viện theo" cần một sổ chưa từng bắn — spec chính bắn ngay ở ca đầu.
 */
const { loaded } = vi.hoisted(() => ({ loaded: vi.fn() }));
vi.mock('canvas-confetti', () => {
  loaded();
  return { default: vi.fn() };
});

it('nạp SuccessCelebration không kéo canvas-confetti theo — thư viện chỉ tải khi bắn', async () => {
  await import('./success-celebration');
  expect(loaded).not.toHaveBeenCalled();
});
