import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { voucherView } from '@/lib/voucher';
import { minutesBeforeNow, VOUCHER_NOW, voucherBooking } from '@/test/fixtures/voucher';
import { VoucherCard } from './voucher-card';

// Pháo giấy có spec riêng (một lần mỗi tab, tôn trọng reduced-motion). Ở đây chỉ hỏi thẻ CÓ
// gắn nó hay không: thay bằng một hàm ghi lại mã đơn, không vẽ gì (khuôn `vi.hoisted` như
// các spec khác của web — factory của `vi.mock` không chứa JSX).
const { celebrate } = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock('@/components/checkout/success-celebration', () => ({
  SuccessCelebration: ({ bookingCode }: { bookingCode: string }) => {
    celebrate(bookingCode);
    return null;
  },
}));

beforeEach(() => {
  celebrate.mockReset();
});

const CANCELLED_NOTICE = 'This booking was cancelled — this voucher is no longer valid.';

function renderCard(overrides: Partial<BookingDetail> = {}) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherCard booking={booking} view={view} meetingPoint={null} />);
}

describe('VoucherCard — ba khoảnh khắc của spec §2.6', () => {
  it('vừa trả: "Your day in Hà Nội is booked." và bắn pháo giấy đúng mã đơn', () => {
    renderCard({ paidAt: minutesBeforeNow(5) });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your day in Hà Nội is booked.' }),
    ).toBeInTheDocument();
    expect(celebrate).toHaveBeenCalledWith('BK-B6VCOQNW');
  });

  it('mở lại: "Your trip voucher", không pháo giấy', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your trip voucher' }),
    ).toBeInTheDocument();
    expect(celebrate).not.toHaveBeenCalled();
  });

  it('huỷ ngay sau khi trả: không pháo giấy, không mã, không mã vạch; dải hết hiệu lực ở cả hai chỗ', () => {
    const { container } = renderCard({
      status: 'CANCELLED',
      cancellation: null,
      paidAt: minutesBeforeNow(10),
      cancelledAt: minutesBeforeNow(2),
    });
    expect(celebrate).not.toHaveBeenCalled();
    expect(screen.queryByText('BK-B6VCOQNW')).toBeNull();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    // Một ở chỗ ô mã gọn (thẻ một cột), một trong mảng teal (thẻ hai cột).
    expect(screen.getAllByText(CANCELLED_NOTICE)).toHaveLength(2);
  });

  it('hai cột trong MỘT thẻ; một h2 duy nhất, không h1 (h1 là tên tour ở hero)', () => {
    const { container } = renderCard();
    const card = container.querySelector('[data-slot="voucher"]');
    expect(card?.querySelector('[data-slot="voucher-overview"]')).not.toBeNull();
    expect(card?.querySelector('[data-slot="voucher-pass"]')).not.toBeNull();
    // Hai cột chỉ khi thẻ chia đôi (`voucher-split:` — từ xl): cột phải cố định 440px
    // nên ở 768px cột trái chỉ còn 194px và cột chữ của bốn ô thông tin còn 0px (đo trên CSS
    // build thật, đợt vá sau C5).
    expect(card?.classList.contains('voucher-split:grid-cols-[minmax(0,1fr)_440px]')).toBe(true);
    expect(card?.className).not.toMatch(/(^|\s)(sm|md|lg|xl):grid-cols-/);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });
});
