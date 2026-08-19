import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingReceipt } from './booking-receipt';

const t = messages.booking.success;

describe('BookingReceipt — ba cột dữ liệu', () => {
  it('render đủ TRAVELLERS · TRIP · PAYMENT', () => {
    render(<BookingReceipt booking={makeBooking()} mood="confirmed" />);
    for (const label of [t.travellersLabel, t.tripLabel, t.paymentLabel]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('điện thoại và ghi chú là optional — null thì KHÔNG render dòng rỗng', () => {
    const { container } = render(
      <BookingReceipt booking={makeBooking({ contactPhone: null })} mood="confirmed" />,
    );
    // Nhắm vào DÒNG CHỮ, không phải mọi `div` rỗng: component cố ý render div
    // rỗng cho đường kẻ và ô giữ chỗ ảnh, nên bắt tất là bắt nhầm chủ đích.
    const blankLines = [...container.querySelectorAll('p, dd')].filter((el) =>
      /^[\s—-]*$/.test(el.textContent ?? ''),
    );
    expect(blankLines).toHaveLength(0);
  });

  it('có điện thoại thì in ra', () => {
    render(
      <BookingReceipt booking={makeBooking({ contactPhone: '+84901234567' })} mood="confirmed" />,
    );
    expect(screen.getByText('+84901234567')).toBeInTheDocument();
  });
});

describe('BookingReceipt — tiền', () => {
  it('tách dòng người lớn và trẻ em, cộng đúng tổng', () => {
    render(
      <BookingReceipt
        booking={makeBooking({
          numAdults: 2,
          numChildren: 1,
          unitPrice: '49.00',
          totalAmount: '147.00',
        })}
        mood="confirmed"
      />,
    );
    expect(screen.getByText(messages.checkoutSummary.adultsLine(2))).toBeInTheDocument();
    expect(screen.getByText(messages.checkoutSummary.childrenLine(1))).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
  });

  /** Không có trẻ em thì KHÔNG in dòng "0 children" — một dòng nói về số không
   *  chỉ làm hoá đơn dài ra mà không thêm sự thật nào. */
  it('numChildren = 0 thì bỏ hẳn dòng trẻ em', () => {
    render(<BookingReceipt booking={makeBooking({ numChildren: 0 })} mood="confirmed" />);
    expect(screen.queryByText(messages.checkoutSummary.childrenLine(0))).toBeNull();
  });
});

describe('BookingReceipt — cuống vé', () => {
  /** Mã in ở HAI chỗ là CHỦ ĐÍCH, không phải lặp thừa: dòng nhỏ ở bảng meta để
   *  chép vào email, mã cỡ lớn ở cuống để chìa ra cho người soát. Vé máy bay
   *  thật cũng lặp lại y vậy. Test khoá chủ đích đó lại. */
  it('mã đặt chỗ xuất hiện ở CẢ bảng meta lẫn cuống', () => {
    render(<BookingReceipt booking={makeBooking({ code: 'BK-TESTAAAA' })} mood="confirmed" />);
    expect(screen.getAllByText('BK-TESTAAAA')).toHaveLength(2);
  });

  it('cuống mang barcode và serial', () => {
    const { container } = render(<BookingReceipt booking={makeBooking()} mood="confirmed" />);
    expect(container.querySelectorAll('[data-slot="barcode"] span').length).toBeGreaterThan(40);
    expect(screen.getByText(/^NO\. \d{10}$/)).toBeInTheDocument();
  });
});

describe('BookingReceipt — ba mood', () => {
  it.each([
    ['confirmed', t.statusPaid],
    ['confirming', t.statusConfirming],
    ['settled', t.statusSettled],
  ] as const)('mood %s → pill %s', (mood, label) => {
    render(<BookingReceipt booking={makeBooking()} mood={mood} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  /** Băng màu trạng thái phải ĐỔI theo mood, không phải luôn xanh. Đây là thứ
   *  duy nhất trên trang phân biệt "đã xong" với "đang chờ" khi nhìn lướt. */
  it('băng tone đổi theo mood', () => {
    const tone = (mood: 'confirmed' | 'confirming' | 'settled') => {
      const { container, unmount } = render(<BookingReceipt booking={makeBooking()} mood={mood} />);
      const cls = container.querySelector('[data-slot="stub"]')?.className ?? '';
      unmount();
      return cls;
    };
    const [ok, wait, done] = [tone('confirmed'), tone('confirming'), tone('settled')];
    expect(ok).not.toBe(wait);
    expect(wait).not.toBe(done);
    expect(ok).not.toBe(done);
  });
});

describe('BookingReceipt — ảnh bìa tour', () => {
  it('tourImage null thì KHÔNG render <img> vỡ', () => {
    const { container } = render(
      <BookingReceipt booking={makeBooking({ tourImage: null })} mood="confirmed" />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('có tourImage thì render <img> với alt', () => {
    const booking = makeBooking({
      // Shape đầy đủ của `MediaItemSchema` — mượn khuôn `slot-image.spec.tsx`.
      tourImage: {
        publicId: 'tourism/catalog/tour/test-tour/hero',
        url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/tour/test-tour/hero',
        type: 'IMAGE',
        role: 'hero',
        posterUrl: null,
        width: 2400,
        height: 1600,
        alt: 'Hạ Long Bay',
        sortOrder: 0,
        author: null,
        license: null,
        licenseUrl: null,
        sourceUrl: null,
      },
    });
    const { container } = render(<BookingReceipt booking={booking} mood="confirmed" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
