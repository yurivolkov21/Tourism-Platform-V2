import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateRange } from '@/lib/tours';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingReceipt } from './booking-receipt';

// jsdom không có IntersectionObserver — hoá đơn nay "in ra" từng khối bằng
// `RevealItem` (motion `whileInView`, nhóm motion 4 — 19/08). Stub CỤC BỘ theo
// quy ước đã ghi ở `reveal-item.spec.tsx`/`gallery.spec.tsx`.
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

const t = messages.booking.success;

/**
 * Đơn mà hoá đơn thật sự nhận: CHƯA TRẢ (`paidAt` null) — đơn đã trả mở voucher ở
 * `/checkout/success` và được `/checkout/cancel` chuyển sang đó (`cancelPageRedirect`). Mặc định
 * là đơn PENDING khách về trước webhook (tâm trạng `confirming`).
 */
const unpaid = (overrides: Partial<BookingDetail> = {}) =>
  makeBooking({ status: 'PENDING', paidAt: null, ...overrides });

describe('BookingReceipt — ba cột dữ liệu', () => {
  it('render đủ TRAVELLERS · TRIP · PAYMENT', () => {
    render(<BookingReceipt booking={unpaid()} mood="confirming" />);
    for (const label of [t.travellersLabel, t.tripLabel, t.paymentLabel]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('điện thoại và ghi chú là optional — null thì KHÔNG render dòng rỗng', () => {
    const { container } = render(
      <BookingReceipt booking={unpaid({ contactPhone: null })} mood="confirming" />,
    );
    // Nhắm vào DÒNG CHỮ, không phải mọi `div` rỗng: component cố ý render div
    // rỗng cho đường kẻ và ô giữ chỗ ảnh, nên bắt tất là bắt nhầm chủ đích.
    const blankLines = [...container.querySelectorAll('p, dd')].filter((el) =>
      /^[\s—-]*$/.test(el.textContent ?? ''),
    );
    expect(blankLines).toHaveLength(0);
  });

  it('có điện thoại thì in ra', () => {
    render(<BookingReceipt booking={unpaid({ contactPhone: '+84901234567' })} mood="confirming" />);
    expect(screen.getByText('+84901234567')).toBeInTheDocument();
  });
});

describe('BookingReceipt — tiền', () => {
  it('tách dòng người lớn và trẻ em, cộng đúng tổng', () => {
    render(
      <BookingReceipt
        booking={unpaid({
          numAdults: 2,
          numChildren: 1,
          unitPrice: '49.00',
          totalAmount: '147.00',
        })}
        mood="confirming"
      />,
    );
    expect(screen.getByText(messages.checkoutSummary.adultsLine(2))).toBeInTheDocument();
    expect(screen.getByText(messages.checkoutSummary.childrenLine(1))).toBeInTheDocument();
    expect(screen.getByText('$147')).toBeInTheDocument();
  });

  /** Đơn giá có xu (giá khuyến mãi) thì đơn giá, dòng và tổng đều đủ hai số lẻ (review P7 06/10). */
  it('đơn giá có xu: đơn giá, hai dòng và tổng in đủ hai số lẻ', () => {
    render(
      <BookingReceipt
        booking={unpaid({
          numAdults: 2,
          numChildren: 2,
          unitPrice: '45.24',
          totalAmount: '180.96',
        })}
        mood="confirming"
      />,
    );
    expect(screen.getByText('$45.24')).toBeInTheDocument();
    expect(screen.getAllByText('$90.48')).toHaveLength(2);
    expect(screen.getByText('$180.96')).toBeInTheDocument();
  });

  /** Không có trẻ em thì KHÔNG in dòng "0 children" — một dòng nói về số không
   *  chỉ làm hoá đơn dài ra mà không thêm sự thật nào. */
  it('numChildren = 0 thì bỏ hẳn dòng trẻ em', () => {
    render(<BookingReceipt booking={unpaid({ numChildren: 0 })} mood="confirming" />);
    expect(screen.queryByText(messages.checkoutSummary.childrenLine(0))).toBeNull();
  });
});

describe('BookingReceipt — cuống vé', () => {
  /** Mã in ở HAI chỗ là CHỦ ĐÍCH, không phải lặp thừa: dòng nhỏ ở bảng meta để
   *  chép vào email, mã cỡ lớn ở cuống để khách trả tiếp hay hỏi đơn. Vé máy bay
   *  thật cũng lặp lại y vậy. Test khoá chủ đích đó lại. */
  it('mã đặt chỗ xuất hiện ở CẢ bảng meta lẫn cuống', () => {
    render(<BookingReceipt booking={unpaid({ code: 'BK-TESTAAAA' })} mood="confirming" />);
    expect(screen.getAllByText('BK-TESTAAAA')).toHaveLength(2);
  });
});

/**
 * "Departed" từ NGÀY KHỞI HÀNH theo lịch Việt Nam — cùng nghĩa với giai đoạn
 * `departed` của admin (ADR-0046: ngày đi ≤ hôm nay), một chữ một nghĩa trên cả
 * sản phẩm. Bản cũ neo NGÀY VỀ và so nửa đêm UTC với giờ thật: suốt chuyến
 * nhiều ngày voucher vẫn ghi "Departs", rồi đổi chữ lúc 07:00 giờ VN ngày về.
 */
describe('BookingReceipt — cuống nói "Departs" hay "Departed"', () => {
  const trip = unpaid({ departureStartDate: '2026-09-01', departureEndDate: '2026-09-05' });
  const dates = formatDateRange('2026-09-01', '2026-09-05');

  // Chỉ giả `Date`: hoá đơn có motion, không cần đụng tới timer của nó.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('giây cuối của hôm trước ngày đi (23:59:59.999 giờ VN) vẫn là "Departs"', () => {
    vi.setSystemTime(new Date('2026-08-31T16:59:59.999Z'));
    render(<BookingReceipt booking={trip} mood="confirming" />);
    expect(screen.getByText(t.departsOn(dates))).toBeInTheDocument();
  });

  it('00:00 giờ VN của ngày đi (17:00Z hôm trước) → "Departed", dù chuyến còn bốn ngày', () => {
    vi.setSystemTime(new Date('2026-08-31T17:00:00.000Z'));
    render(<BookingReceipt booking={trip} mood="confirming" />);
    expect(screen.getByText(t.departedOn(dates))).toBeInTheDocument();
  });
});

describe('BookingReceipt — hai tâm trạng', () => {
  it.each([
    ['confirming', t.statusConfirming],
    ['settled', t.statusSettled],
  ] as const)('mood %s → pill %s', (mood, label) => {
    render(<BookingReceipt booking={unpaid()} mood={mood} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  /** Băng màu trạng thái phải ĐỔI theo mood. Đây là thứ duy nhất trên trang
   *  phân biệt "đang chờ" với "đã ở kết cục khác" khi nhìn lướt. */
  it('băng tone đổi theo mood', () => {
    const tone = (mood: 'confirming' | 'settled') => {
      const { container, unmount } = render(<BookingReceipt booking={unpaid()} mood={mood} />);
      const cls = container.querySelector('[data-slot="stub"]')?.className ?? '';
      unmount();
      return cls;
    };
    expect(tone('confirming')).not.toBe(tone('settled'));
  });
});

/** Ngày của hoá đơn là ngày lịch Việt Nam — cắt chuỗi UTC lệch một ngày cho mốc 00:00–06:59 giờ VN. */
describe('BookingReceipt — ngày theo lịch Việt Nam', () => {
  it('ô ngày là ngày ĐẶT theo lịch Việt Nam: đặt lúc 02:50 giờ VN 14/08 (19:50Z ngày 13/08)', () => {
    render(
      <BookingReceipt
        booking={unpaid({ createdAt: '2026-08-13T19:50:00.000Z' })}
        mood="confirming"
      />,
    );
    expect(screen.getByText('14 Aug 2026')).toBeInTheDocument();
  });
});

describe('BookingReceipt — ảnh bìa tour', () => {
  it('tourImage null thì KHÔNG render <img> vỡ', () => {
    const { container } = render(
      <BookingReceipt booking={unpaid({ tourImage: null })} mood="confirming" />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('có tourImage thì render <img> với alt', () => {
    const booking = unpaid({
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
    const { container } = render(<BookingReceipt booking={booking} mood="confirming" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});

/**
 * Kế thừa từ `checkout-shell.spec.tsx` (xoá 19/08 cùng `CheckoutShell`). Ca "không có code" không
 * còn thuộc component — booking null giờ do TRANG xử lý bằng một nhánh sớm, vì không có booking thì
 * không có hoá đơn nào để dựng.
 */
describe('BookingReceipt — mã chưa phải voucher', () => {
  /** Đây là bất biến CHỐNG NÓI DỐI, không phải chuyện thẩm mỹ. Booking PENDING
   *  KHÔNG giữ ghế nào (invariant #1 của API), nên in barcode — thứ nghĩa là
   *  "quét tôi ở cổng" — cho một booking chưa trả tiền là hứa một cái chưa có.
   *  Repo đã bị đúng lớp lỗi này: câu "Your reservation is held" bị bác ở final
   *  review cụm C vì ngụ ý giữ chỗ. */
  it('CHƯA trả tiền → không barcode, không serial, và dòng hint nói mã chưa là voucher', () => {
    const { container } = render(<BookingReceipt booking={unpaid()} mood="confirming" />);
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(screen.queryByText(/^NO\. \d{10}$/)).toBeNull();
    expect(screen.getByText(t.stubNotYetVoucher)).toBeInTheDocument();
    expect(screen.queryByText(/Show this code/)).toBeNull();
  });

  /**
   * Hoá đơn không còn chế độ "đã là voucher" (review cuối P7, M3): đơn đã trả mở voucher, nơi mã
   * vạch theo giai đoạn (`bookingPass`). Nhánh mã vạch, serial và "Show this code" của hoá đơn đã
   * không còn đường tới mà spec vẫn canh — người đọc tưởng hoá đơn còn in mã vạch cho đơn đã trả.
   */
  it('không bao giờ in mã vạch, serial hay "Show this code" — kể cả khi lỡ nhận đơn đã trả', () => {
    const { container } = render(<BookingReceipt booking={makeBooking()} mood="settled" />);
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(screen.queryByText(/^NO\. \d{10}$/)).toBeNull();
    expect(screen.queryByText(/Show this code/)).toBeNull();
  });

  /** Chưa trả mà in "Total paid" là nói dối bằng nhãn. */
  it('chưa trả tiền thì nhãn tổng KHÔNG phải "Total paid"', () => {
    render(<BookingReceipt booking={unpaid()} mood="confirming" />);
    expect(screen.getByText(messages.checkoutSummary.totalLabel)).toBeInTheDocument();
    expect(screen.queryByText(t.totalLabel)).toBeNull();
  });

  it('đơn chưa trả đã đóng: cuống nói thẳng đã đóng — không "Departs", không hứa thành voucher (G37)', () => {
    render(<BookingReceipt booking={unpaid({ status: 'CANCELLED' })} mood="settled" />);
    expect(screen.getByText(t.stubClosed)).toBeInTheDocument();
    expect(screen.queryByText(t.stubNotYetVoucher)).toBeNull();
    expect(screen.queryByText(/^Departs /)).toBeNull();
  });
});

/**
 * Trang không truyền câu riêng thì câu dưới tiêu đề theo tâm trạng (`receiptNote`, review P7C#5):
 * nhánh hoá đơn chờ của `/checkout/success` từng in "A copy of this receipt was sent to …" cho
 * đơn chưa trả, và im về khoản hoàn của đơn bị thu rồi hoàn tự động.
 */
describe('BookingReceipt — câu dưới tiêu đề khi trang không truyền body', () => {
  it('chờ webhook: nói đang xác nhận, KHÔNG "was sent to"', () => {
    render(<BookingReceipt booking={unpaid()} mood="confirming" />);
    expect(screen.getByText(t.pendingBody)).toBeInTheDocument();
    expect(screen.queryByText(/was sent to/)).toBeNull();
  });

  it('thua đua ghế (thu rồi hoàn tự động, paidAt null): kể khoản hoàn', () => {
    render(
      <BookingReceipt
        booking={unpaid({
          status: 'CANCELLED',
          totalAmount: '147.00',
          refundedTotal: '147.00',
        })}
        mood="settled"
      />,
    );
    expect(
      screen.getByText(
        '$147.00 has been refunded to your original payment method. It can take 5–10 business days to appear on your statement.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/was sent to/)).toBeNull();
  });
});

describe('BookingReceipt — đè tiêu đề và chèn nội dung riêng của trang', () => {
  it('title/body đè giá trị suy từ mood', () => {
    render(
      <BookingReceipt
        booking={unpaid()}
        mood="confirming"
        title="Payment cancelled"
        body="No charge was made."
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Payment cancelled' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No charge was made.')).toBeInTheDocument();
    // Tiêu đề suy từ mood KHÔNG được rò ra khi đã bị đè.
    expect(screen.queryByText(t.pendingTitle)).toBeNull();
  });

  it('children render bên trong hoá đơn', () => {
    render(
      <BookingReceipt booking={unpaid()} mood="confirming">
        <p>Released in about 42 minutes.</p>
      </BookingReceipt>,
    );
    expect(screen.getByText('Released in about 42 minutes.')).toBeInTheDocument();
  });
});

/** Đo trên trang thật thấy hai `<h1>` cùng lúc (ContentHero + receipt), nên
 *  khoá lại: tiêu đề của hoá đơn là h2, `h1` thuộc về hero của trang. */
describe('BookingReceipt — thứ bậc tiêu đề', () => {
  it('tiêu đề hoá đơn là h2, KHÔNG phải h1', () => {
    const { container } = render(<BookingReceipt booking={unpaid()} mood="confirming" />);
    expect(container.querySelectorAll('h1')).toHaveLength(0);
    expect(container.querySelectorAll('h2')).toHaveLength(1);
  });
});
