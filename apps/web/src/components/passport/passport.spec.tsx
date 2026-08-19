import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingAccordion } from './booking-accordion';
import { PassportCard } from './passport-card';
import { StampPages } from './stamp-pages';
import { VisaStamp } from './visa-stamp';

// jsdom không có IntersectionObserver — component nay bọc `RevealItem` (motion
// `whileInView`, nhóm motion 3 — 19/08). Stub CỤC BỘ theo quy ước đã ghi ở
// `reveal-item.spec.tsx`/`gallery.spec.tsx`: dời lên vitest.setup.ts là gãy
// test ở file khác.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Spec gộp cho bộ component passport (T4) — mỗi component vài ca hành vi,
// KHÔNG chụp markup: assert thứ user thấy (chữ, href, trạng thái class).

describe('PassportCard', () => {
  const CARD_PROPS = {
    name: 'Bosco Wong',
    email: 'bosco@example.com',
    sinceYear: 2026,
    passportNo: 'TV214306',
    mrz: [
      'P<TRVWONG<<BOSCO<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
      'TV214306<0TRV2601010<3601017<<<<<<<<<<<<<<08',
    ] as [string, string],
  };

  // Khung data page (addendum §7.4): thông tin tài khoản đứng đầu — tên,
  // email, số hộ chiếu nhóm, since, MRZ trong khung; phone ẩn khi null.
  it('hiện đủ danh tính: tên heading, email, số hộ chiếu nhóm, since, MRZ', () => {
    render(<PassportCard {...CARD_PROPS} phone="+84 912 345 678" />);
    expect(screen.getByRole('heading', { name: 'Bosco Wong' })).toBeInTheDocument();
    expect(screen.getByText('bosco@example.com')).toBeInTheDocument();
    expect(screen.getByText('TV 214 306')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('+84 912 345 678')).toBeInTheDocument();
    expect(screen.getByText(/P<TRVWONG<<BOSCO/)).toBeInTheDocument();
  });

  it('phone null → ẩn trọn dòng Phone (fetch phụ hỏng không để ô trống)', () => {
    render(<PassportCard {...CARD_PROPS} phone={null} />);
    expect(screen.queryByText(/^Phone$/i)).not.toBeInTheDocument();
  });
});

describe('StampPages', () => {
  // Trang visa mở (vòng 11/08 tối) — tem theo TỪNG CHUYẾN: hai chuyến cùng
  // nơi là HAI con dấu khác tháng; dấu ghost viền đứt cho chuyến sắp tới.
  it('mỗi chuyến một dấu (trùng nơi vẫn hai dấu), ghost nét đứt, dáng theo data', () => {
    render(
      <StampPages
        stamps={[
          {
            key: 'BK-A',
            label: 'HẠ LONG BAY',
            month: 'May 2026',
            shape: 'round',
            rotationDeg: -6,
            size: 'md',
            ink: 0,
            driftY: 0,
            overlap: false,
          },
          {
            key: 'BK-B',
            label: 'HẠ LONG BAY',
            month: 'Jul 2026',
            shape: 'oval',
            rotationDeg: 4,
            size: 'lg',
            ink: 1,
            driftY: 2,
            overlap: true,
          },
          {
            key: 'BK-C',
            label: 'HỘI AN',
            month: 'Sep 2026',
            shape: 'square',
            rotationDeg: 2,
            size: 'sm',
            ink: 0,
            driftY: 1,
            overlap: false,
            ghost: true,
          },
        ]}
        caption="1 of our 19 destinations — the map is turning jade."
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Đi lại cùng nơi → HAI dấu HẠ LONG BAY cùng tồn tại, khác tháng.
    expect(screen.getAllByText('HẠ LONG BAY')).toHaveLength(2);
    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
    // Dấu thật: mực stamp-ink + xoay theo data + dấu sau lấn mép dấu trước.
    expect(items[0]?.className).toContain('stamp-ink');
    expect(items[0]).toHaveStyle({ transform: 'rotate(-6deg)' });
    expect(items[1]?.className).toContain('-ml-4');
    // Dấu ghost: viền đứt + sr-only "next stamp", KHÔNG mực stamp-ink.
    expect(items[2]?.className).toContain('border-dashed');
    expect(items[2]?.className).not.toContain('stamp-ink');
    expect(screen.getByText('next stamp')).toBeInTheDocument();
    expect(screen.getByText(/turning jade/)).toBeInTheDocument();
  });
});

describe('VisaStamp', () => {
  it('mỗi status đúng chữ mộc, màu mực theo tone (success/warning/muted)', () => {
    const CASES = [
      { status: 'PAID', tone: 'success', text: 'CONFIRMED', cls: 'text-success' },
      { status: 'PENDING', tone: 'warning', text: 'AWAITING PAYMENT', cls: 'text-warning' },
      { status: 'CANCELLED', tone: 'muted', text: 'CANCELLED', cls: 'text-muted-foreground' },
      { status: 'REFUNDED', tone: 'destructive', text: 'REFUNDED', cls: 'text-muted-foreground' },
      {
        status: 'PARTIALLY_REFUNDED',
        tone: 'destructive',
        text: 'PARTLY REFUNDED',
        cls: 'text-muted-foreground',
      },
    ] as const;
    for (const c of CASES) {
      const { unmount } = render(<VisaStamp status={c.status} tone={c.tone} />);
      const el = screen.getByText(c.text);
      expect(el.className).toContain(c.cls);
      unmount();
    }
  });
});

describe('BookingAccordion', () => {
  // Thay JourneyRow (vòng 12/08 — accordion xổ-inline theo pattern coupon
  // user tham khảo): CÙNG bộ luật trạng thái, nhưng `today` là PROP chuỗi
  // UTC truyền từ server — không fake timer. Row đầu mở sẵn nên panel
  // (action + lưới chi tiết) hiện ngay trong test một booking.
  const TODAY = '2026-08-15';
  const one = (over: Partial<Parameters<typeof makeBooking>[0]> = {}) => (
    <BookingAccordion bookings={[makeBooking(over)]} today={TODAY} />
  );

  it('PAID tương lai → đếm ngược ở meta, panel có View details + badge Paid, KHÔNG Pay now', () => {
    render(one({ departureStartDate: '2026-08-27', departureEndDate: '2026-08-29' }));
    expect(screen.getByText(/In 12 days/)).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TESTAAAA',
    );
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument();
  });

  it('PAID đang trên đường → "Ends …" thay đếm ngược', () => {
    render(one({ departureStartDate: '2026-08-14', departureEndDate: '2026-08-16' }));
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
  });

  // Biên đóng (kế thừa fix 11/08): kết thúc ĐÚNG HÔM NAY vẫn "đang đi" —
  // so CHUỖI ngày UTC, không lệ thuộc giờ-trong-ngày của máy.
  it('PAID kết thúc ĐÚNG HÔM NAY vẫn "đang đi", chưa mời Review', () => {
    render(one({ departureStartDate: '2026-08-13', departureEndDate: '2026-08-15' }));
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review →' })).not.toBeInTheDocument();
  });

  it('PAID đã đi xong → link Review anchor #review + View voucher', () => {
    render(one({ departureStartDate: '2026-07-21', departureEndDate: '2026-07-23' }));
    expect(screen.getByRole('link', { name: 'Review →' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TESTAAAA#review',
    );
    expect(screen.getByRole('link', { name: 'View voucher' })).toHaveAttribute(
      'href',
      '/checkout/success?code=BK-TESTAAAA',
    );
  });

  it('PENDING chưa đi → nút Pay now + badge Awaiting payment', () => {
    render(
      one({
        status: 'PENDING',
        departureStartDate: '2026-08-27',
        departureEndDate: '2026-08-29',
      }),
    );
    expect(screen.getByRole('link', { name: 'Pay now' })).toBeInTheDocument();
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('CANCELLED → badge Cancelled, chỉ còn View details (không Pay now/voucher)', () => {
    render(
      one({
        status: 'CANCELLED',
        departureStartDate: '2026-08-27',
        departureEndDate: '2026-08-29',
      }),
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View voucher' })).not.toBeInTheDocument();
  });

  it('REFUNDED đã qua ngày → không mời Review', () => {
    render(
      one({
        status: 'REFUNDED',
        departureStartDate: '2026-07-21',
        departureEndDate: '2026-07-23',
      }),
    );
    expect(screen.queryByRole('link', { name: 'Review →' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toBeInTheDocument();
  });
});
