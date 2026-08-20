import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuccessCelebration } from './success-celebration';

// Mock canvas-confetti global — spec này kiểm LOGIC bắn (một lần, đúng
// mood, tôn trọng reduced-motion), không kiểm canvas thật (jsdom không vẽ).
const fire = vi.fn();
vi.mock('canvas-confetti', () => ({ default: (opts: unknown) => fire(opts) }));

/**
 * vitest.setup của web mock matchMedia trả `reduce` MẶC ĐỊNH (chống
 * AnimatePresence treo) — spec này cần điều khiển theo từng test nên đè lại.
 */
function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

// requestAnimationFrame đồng bộ theo HẠN NGẠCH khung: vòng bắn dựa Date.now()
// nên cho chạy thật là đệ quy 3 giây — mỗi render chỉ cần MỘT khung để khẳng
// định "có bắn từ hai mép". Test render lần hai thì nạp thêm bằng allowFrames.
let rafAllowance = 0;
function allowFrames(n: number) {
  rafAllowance = n;
}
function stubRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    if (rafAllowance > 0) {
      rafAllowance -= 1;
      cb(0);
    }
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
}

beforeEach(() => {
  fire.mockReset();
  sessionStorage.clear();
  allowFrames(1);
  stubRaf();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SuccessCelebration', () => {
  it('bắn side cannons từ HAI mép (origin x=0 và x=1) khi được phép', () => {
    mockMatchMedia(false);
    render(<SuccessCelebration bookingCode="BK-1" />);
    const origins = fire.mock.calls.map(([opts]) => opts.origin.x);
    expect(origins).toContain(0);
    expect(origins).toContain(1);
  });

  it('chỉ bắn MỘT lần mỗi booking — remount (CheckoutAutoRefresh) không nổ lại', () => {
    mockMatchMedia(false);
    const first = render(<SuccessCelebration bookingCode="BK-1" />);
    const callsAfterFirst = fire.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    first.unmount();
    allowFrames(1); // có khung sẵn sàng — vẫn không được bắn vì guard theo mã
    render(<SuccessCelebration bookingCode="BK-1" />);
    expect(fire.mock.calls.length).toBe(callsAfterFirst);
  });

  it('booking KHÁC vẫn được bắn (guard theo mã, không phải toàn cục)', () => {
    mockMatchMedia(false);
    const first = render(<SuccessCelebration bookingCode="BK-1" />);
    first.unmount();
    const before = fire.mock.calls.length;
    allowFrames(1);
    render(<SuccessCelebration bookingCode="BK-2" />);
    expect(fire.mock.calls.length).toBeGreaterThan(before);
  });

  it('prefers-reduced-motion → KHÔNG bắn và KHÔNG ghi khoá đã-bắn', () => {
    mockMatchMedia(true);
    render(<SuccessCelebration bookingCode="BK-1" />);
    expect(fire).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('confetti:BK-1')).toBeNull();
  });

  it('không render DOM riêng — canvas do canvas-confetti tự quản', () => {
    mockMatchMedia(false);
    const { container } = render(<SuccessCelebration bookingCode="BK-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
