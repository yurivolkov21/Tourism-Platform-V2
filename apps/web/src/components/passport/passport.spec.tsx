import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { DotMap } from './dot-map';
import { JourneyRow } from './journey-row';
import { PassportCard } from './passport-card';
import { StampRow } from './stamp-row';
import { VisaStamp } from './visa-stamp';

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

describe('StampRow', () => {
  it('render đúng số tem, xoay theo data, tem thật mang mực stamp-ink, ghost nét đứt cuối dãy', () => {
    render(
      <StampRow
        stamps={[
          { label: 'HỘI AN', month: 'Jun 2026', shape: 'round', rotationDeg: -6 },
          { label: 'HẠ LONG BAY', month: 'Jul 2026', shape: 'square', rotationDeg: 4 },
          { label: '?', month: '', shape: 'round', rotationDeg: 3, ghost: true },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveStyle({ transform: 'rotate(-6deg)' });
    expect(screen.getByText('HỘI AN')).toBeInTheDocument();
    // Tem thật: bộ tròn/vuông gốc + lớp mực nhiễu `.stamp-ink` (tu sửa 11/08).
    expect(items[0]?.className).toContain('rounded-full');
    expect(items[0]?.className).toContain('stamp-ink');
    expect(items[1]?.className).toContain('rounded-2xl');
    // Tem ghost: nhãn "?" + sub "next stamp" (copy i18n), style dashed/mờ.
    expect(screen.getByText('next stamp')).toBeInTheDocument();
    expect(items[2]?.className).toContain('border-dashed');
  });
});

describe('DotMap', () => {
  // aria-hidden (fix 11/08): lưới chấm là trang trí, `figcaption` mới là nội
  // dung thật — `getAllByRole('listitem')` không còn thấy gì nên query thẳng
  // DOM bằng `querySelectorAll`.
  it('mỗi dot đúng trạng thái màu: visited đầy, upcoming mờ, còn lại muted', () => {
    const { container } = render(
      <DotMap
        dots={[
          {
            slug: 'ha-long-bay',
            region: 'north',
            visited: true,
            upcoming: false,
            name: 'Hạ Long Bay',
          },
          { slug: 'hoi-an', region: 'central', visited: false, upcoming: true, name: 'Hội An' },
          { slug: 'can-tho', region: 'south', visited: false, upcoming: false, name: 'Cần Thơ' },
        ]}
        caption="2 of our 19 destinations — the map is turning jade."
      />,
    );
    const dots = container.querySelectorAll('li');
    expect(dots[0]?.className).toContain('bg-primary');
    expect(dots[0]?.className).not.toContain('opacity-40');
    expect(dots[1]?.className).toContain('opacity-40');
    expect(dots[2]?.className).toContain('bg-muted');
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

describe('JourneyRow', () => {
  // Đóng băng đồng hồ: 15/08/2026 — cùng mốc với passport.spec.ts.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('PAID tương lai → đếm ngược + View, chấm primary', () => {
    render(
      <JourneyRow
        booking={makeBooking({ departureStartDate: '2026-08-27', departureEndDate: '2026-08-29' })}
      />,
    );
    expect(screen.getByText(/In 12 days/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View →' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TESTAAAA',
    );
  });

  it('PAID đang trên đường → "Ends …" thay đếm ngược', () => {
    render(
      <JourneyRow
        booking={makeBooking({ departureStartDate: '2026-08-14', departureEndDate: '2026-08-16' })}
      />,
    );
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
  });

  // RED trước fix 11/08: kết thúc ĐÚNG HÔM NAY, xét ở giờ THẬT buổi tối
  // (không phải nửa đêm mà `beforeEach` đóng băng) — so `Date` cũ coi
  // midnight-của-endDate < giờ-thật-buổi-tối là true → hiện nhầm Review dù
  // chuyến chưa chắc đã kết thúc trong ngày. Luật mới so CHUỖI ngày UTC.
  it('PAID kết thúc ĐÚNG HÔM NAY (giờ thật buổi tối) vẫn "đang đi", chưa phải Review', () => {
    vi.setSystemTime(new Date('2026-08-15T20:00:00.000Z'));
    render(
      <JourneyRow
        booking={makeBooking({ departureStartDate: '2026-08-13', departureEndDate: '2026-08-15' })}
      />,
    );
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review →' })).not.toBeInTheDocument();
  });

  it('PAID đã đi xong → động từ Review anchor #review', () => {
    render(
      <JourneyRow
        booking={makeBooking({ departureStartDate: '2026-07-21', departureEndDate: '2026-07-23' })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Review →' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TESTAAAA#review',
    );
  });

  it('PENDING chưa đi → Pay now, KHÔNG phải View', () => {
    render(
      <JourneyRow
        booking={makeBooking({
          status: 'PENDING',
          departureStartDate: '2026-08-27',
          departureEndDate: '2026-08-29',
        })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Pay now →' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View →' })).not.toBeInTheDocument();
  });

  it('CANCELLED → chữ trạng thái hiện trong meta, động từ về View', () => {
    render(
      <JourneyRow
        booking={makeBooking({
          status: 'CANCELLED',
          departureStartDate: '2026-08-27',
          departureEndDate: '2026-08-29',
        })}
      />,
    );
    expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View →' })).toBeInTheDocument();
    // PENDING quá hạn KHÔNG mời trả tiền — nhưng ở đây là CANCELLED: không Pay now.
    expect(screen.queryByRole('link', { name: 'Pay now →' })).not.toBeInTheDocument();
  });

  it('REFUNDED → chấm giảm cấp (muted), không Review dù đã qua ngày', () => {
    render(
      <JourneyRow
        booking={makeBooking({
          status: 'REFUNDED',
          departureStartDate: '2026-07-21',
          departureEndDate: '2026-07-23',
        })}
      />,
    );
    expect(screen.queryByRole('link', { name: 'Review →' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View →' })).toBeInTheDocument();
  });
});
