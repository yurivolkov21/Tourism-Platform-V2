import { HOM_NAY, tourDepartures } from '../catalog/departures-2026.js';
import { tours as toursCentral } from '../catalog/tours-central.js';
import { tours as toursNorth } from '../catalog/tours-north.js';
import { tours as toursSouth } from '../catalog/tours-south.js';
import { khachGia } from '../people/customers.js';
import { boSinh, idTinh, nguyen } from '../stable-id.js';

/**
 * Booking + payment event + refund + yêu cầu huỷ — tầng vận hành của đợt làm
 * mới dữ liệu 10/09/2026.
 *
 * ── Vì sao chuyến không tự đẻ ra doanh thu ──
 * Báo cáo và dashboard neo trên `bookings.paid_at` và chỉ đếm `PAID` /
 * `PARTIALLY_REFUNDED` (`stats-aggregates.ts:350`). Seed 261 chuyến mà không
 * seed booking thì mọi biểu đồ vẫn phẳng lì.
 *
 * ── Ba con số PHẢI khớp code thật, không được tự nghĩ ──
 *   `unitPrice`   = `priceOverride ?? basePrice`  (`pricing.ts:effectiveUnitPrice`)
 *   `totalAmount` = `unitPrice × (người lớn + trẻ em)`  (`pricing.ts:totalAmount`)
 *   `seatsBooked` cộng lúc THANH TOÁN, không phải lúc tạo (`bookings.service.ts:917`)
 * Fixture tự bịa công thức thì số trên trang lệch số trong báo cáo, mà không
 * test nào bắt được vì hai bên đọc hai nguồn khác nhau.
 *
 * ── `costPerPerson` KHÔNG nằm ở đây ──
 * Nó là SNAPSHOT, seed tính lúc chèn bằng chính `perPersonTotal(tour.costItems)`
 * mà `bookings.service.ts` dùng. Khai sẵn trong fixture là dựng hai nguồn sự
 * thật cho một phép tính — sửa một dòng giá vốn mà quên sửa fixture là hai số
 * nói khác nhau, im lặng.
 *
 * ── Khách phải có mặt trước khi đặt ──
 * `paidAt >= khach.createdAt` là ràng buộc cứng: một người không thể đặt chuyến
 * trước ngày họ có tài khoản. Bộ sinh chọn khách TRƯỚC rồi mới đặt `paidAt`
 * trong khoảng hợp lệ, và bỏ qua booking nếu khoảng ấy rỗng.
 */

export interface BookingFixture {
  id: string;
  code: string;
  userId: string;
  tourId: string;
  departureId: string;
  numAdults: number;
  numChildren: number;
  totalAmount: string;
  currency: string;
  status: 'PAID' | 'REFUNDED';
  tourTitle: string;
  departureStartDate: string;
  departureEndDate: string;
  unitPrice: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  specialRequests: string | null;
  paymentProvider: 'STRIPE' | 'PAYPAL';
  providerSessionId: string;
  providerPaymentId: string;
  paidAt: string;
  cancelledAt: string | null;
  createdAt: string;
}

export interface PaymentEventFixture {
  id: string;
  provider: 'STRIPE' | 'PAYPAL';
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  amount: string;
  currency: string;
  bookingId: string;
  processedAt: string;
  receivedAt: string;
}

export interface RefundFixture {
  id: string;
  bookingId: string;
  amount: string;
  currency: string;
  providerRefundId: string;
  providerPaymentId: string;
  reason: string;
  createdAt: string;
}

export interface CancellationRequestFixture {
  id: string;
  bookingId: string;
  userId: string;
  reason: string;
  freeCancellationDays: number | null;
  status: 'REFUNDED';
  decisionNote: string;
  decidedAt: string;
  createdAt: string;
}

const NGAY = 86400000;
const ISO = (t: number): string => new Date(t).toISOString().slice(0, 10);
const ISOT = (t: number): string => new Date(t).toISOString();
const tien = (n: number): string => n.toFixed(2);

/** Số booking trên một chuyến, theo trạng thái chuyến. */
const SO_BOOKING = {
  CLOSED: [2, 5] as const,
  CANCELLED: [1, 3] as const,
  OPEN: [1, 4] as const,
};
/**
 * Tỉ lệ chuyến CÒN MỞ đã có người đặt — phần còn lại trống ghế.
 *
 * Bản đầu để 0,28 và làm sụp đúng cửa sổ mà dashboard hay xem nhất: tháng
 * 9–11/2026 chỉ có 10/7/4 booking, trong khi "hôm nay" của bộ dữ liệu là
 * 10/09/2026. Màn 7/30/90 ngày vì thế gần như trống. Một doanh nghiệp đang chạy
 * thì chuyến sắp tới phải đang đầy dần, nên phần lớn chuyến mở đã có khách.
 */
const TY_LE_OPEN_CO_KHACH = 0.75;

/** Vài yêu cầu đặc biệt thật, để cột `special_requests` không trống trơn. */
const YEU_CAU = [
  'Vegetarian meals for two of us, please.',
  'We are celebrating an anniversary — no fuss needed, just letting you know.',
  'One traveller is a slow walker; please allow a little extra time at each stop.',
  'Could we be collected from the hotel lobby rather than the street entrance?',
  'Peanut allergy in the party — please flag it to the kitchen.',
  'We would like a window seat on the transfer if that is possible.',
];

const tours = [...toursNorth, ...toursCentral, ...toursSouth];
const bangTour = new Map(tours.map((t) => [t.id, t]));

/** Mã booking `BK-` + 8 ký tự base36 hoa — khớp `BOOKING_CODE_PATTERN`. */
function maBooking(hat: string): string {
  const h = idTinh('booking-code', hat).replace(/-/g, '');
  let n = BigInt(`0x${h.slice(0, 16)}`);
  let ra = '';
  const BANG = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 8; i++) {
    ra += BANG[Number(n % 36n)];
    n /= 36n;
  }
  return `BK-${ra}`;
}

interface Ket {
  bookings: BookingFixture[];
  paymentEvents: PaymentEventFixture[];
  refunds: RefundFixture[];
  cancellationRequests: CancellationRequestFixture[];
}

function sinh(): Ket {
  const bookings: BookingFixture[] = [];
  const paymentEvents: PaymentEventFixture[] = [];
  const refunds: RefundFixture[] = [];
  const cancellationRequests: CancellationRequestFixture[] = [];

  for (const dep of tourDepartures) {
    const tour = bangTour.get(dep.tourId);
    if (!tour) continue;
    const rndDep = boSinh(`bk-dep:${dep.id}`);

    if (dep.status === 'OPEN' && rndDep() >= TY_LE_OPEN_CO_KHACH) continue;

    const [min, max] = SO_BOOKING[dep.status];
    const muon = nguyen(rndDep, min, max);
    const donGia = Number(dep.priceOverride ?? tour.basePrice);
    const batDau = Date.parse(`${dep.startDate}T00:00:00.000Z`);
    let gheDaDung = 0;

    for (let k = 0; k < muon; k++) {
      const rnd = boSinh(`bk:${dep.id}:${k}`);

      // ── Khách ── chọn trước, vì `paidAt` phải nằm sau ngày họ có tài khoản.
      const khach = khachGia[nguyen(rnd, 0, khachGia.length - 1)];
      if (!khach) continue;
      const somNhat = +khach.createdAt + NGAY;
      // Trần KÉP: không sau ngày khởi hành, và KHÔNG SAU HÔM NAY. Thiếu vế thứ
      // hai thì chuyến tháng 3/2027 sinh ra booking `paidAt` tháng 1/2027 —
      // tiền chưa trả mà đã ghi là đã trả. Bản đầu của mình sót đúng vế này và
      // đẻ ra 36 dòng như vậy.
      const muonNhat = Math.min(batDau - NGAY, +HOM_NAY);
      if (somNhat > muonNhat) continue; // khách gia nhập sau khi chuyến đã chạy

      // Đặt trước 7–90 ngày, kẹp lại cho khỏi sớm hơn ngày khách có tài khoản.
      const thanhToan = Math.max(somNhat, muonNhat - nguyen(rnd, 7, 90) * NGAY);

      // ── Ghế ── không bao giờ vượt sức chứa còn lại của chuyến.
      const conLai = dep.seatsTotal - gheDaDung;
      if (conLai < 1) break;
      const nguoiLon = Math.min(nguyen(rnd, 1, 3), conLai);
      const treEm = Math.min(rnd() < 0.28 ? nguyen(rnd, 1, 2) : 0, conLai - nguoiLon);
      const ghe = nguoiLon + treEm;
      gheDaDung += ghe;

      const daHuy = dep.status === 'CANCELLED';
      // Công ty huỷ chuyến ~14 ngày trước ngày đi (quyết định của user 10/09:
      // công ty huỷ → hoàn 100%, không vướng bậc hoàn tiền).
      const ngayHuy = batDau - 14 * NGAY;
      const id = idTinh('booking', dep.id, k);
      const nhaCC = rnd() < 0.7 ? 'STRIPE' : 'PAYPAL';
      const tongTien = donGia * ghe;

      bookings.push({
        id,
        code: maBooking(`${dep.id}:${k}`),
        userId: khach.id,
        tourId: tour.id,
        departureId: dep.id,
        numAdults: nguoiLon,
        numChildren: treEm,
        totalAmount: tien(tongTien),
        currency: tour.currency,
        status: daHuy ? 'REFUNDED' : 'PAID',
        tourTitle: tour.title,
        departureStartDate: dep.startDate,
        departureEndDate: dep.endDate,
        unitPrice: tien(donGia),
        contactName: khach.name,
        contactEmail: khach.email,
        contactPhone: khach.phone,
        specialRequests:
          rnd() < 0.18 ? (YEU_CAU[nguyen(rnd, 0, YEU_CAU.length - 1)] ?? null) : null,
        paymentProvider: nhaCC,
        // Cột `provider_session_id` là UNIQUE — id tất định theo booking nên
        // không bao giờ đụng nhau, kể cả khi chạy seed lại.
        providerSessionId: `${nhaCC === 'STRIPE' ? 'cs_test_' : 'PAYPALORD-'}${idTinh('sess', id).replace(/-/g, '').slice(0, 24)}`,
        providerPaymentId: `${nhaCC === 'STRIPE' ? 'pi_' : 'PAYPALCAP-'}${idTinh('pay', id).replace(/-/g, '').slice(0, 24)}`,
        paidAt: ISOT(thanhToan),
        cancelledAt: daHuy ? ISOT(ngayHuy) : null,
        createdAt: ISOT(thanhToan - nguyen(rnd, 0, 2) * 3600000),
      });

      // ── Sự kiện thu tiền ──
      paymentEvents.push({
        id: idTinh('pe-thu', id),
        provider: nhaCC,
        eventId: `evt_${idTinh('evt-thu', id).replace(/-/g, '').slice(0, 24)}`,
        type: nhaCC === 'STRIPE' ? 'checkout.session.completed' : 'PAYMENT.CAPTURE.COMPLETED',
        payload: { seeded: true, bookingId: id, kind: 'capture' },
        amount: tien(tongTien),
        currency: tour.currency,
        bookingId: id,
        processedAt: ISOT(thanhToan),
        receivedAt: ISOT(thanhToan),
      });

      if (!daHuy) continue;

      // ── Chuyến bị huỷ: hoàn 100% + sự kiện hoàn + yêu cầu huỷ ──
      refunds.push({
        id: idTinh('refund', id),
        bookingId: id,
        amount: tien(tongTien),
        currency: tour.currency,
        providerRefundId: `${nhaCC === 'STRIPE' ? 're_' : 'PAYPALRF-'}${idTinh('rf', id).replace(/-/g, '').slice(0, 24)}`,
        providerPaymentId: `${nhaCC === 'STRIPE' ? 'pi_' : 'PAYPALCAP-'}${idTinh('pay', id).replace(/-/g, '').slice(0, 24)}`,
        reason: 'Departure cancelled by the operator — full refund issued.',
        createdAt: ISOT(ngayHuy),
      });
      paymentEvents.push({
        id: idTinh('pe-hoan', id),
        provider: nhaCC,
        eventId: `evt_${idTinh('evt-hoan', id).replace(/-/g, '').slice(0, 24)}`,
        type: nhaCC === 'STRIPE' ? 'charge.refunded' : 'PAYMENT.CAPTURE.REFUNDED',
        payload: { seeded: true, bookingId: id, kind: 'refund' },
        amount: tien(tongTien),
        currency: tour.currency,
        bookingId: id,
        processedAt: ISOT(ngayHuy),
        receivedAt: ISOT(ngayHuy),
      });
      cancellationRequests.push({
        id: idTinh('huy', id),
        bookingId: id,
        userId: khach.id,
        reason: 'Operator cancelled this departure.',
        // Chụp lại ngưỡng của tour lúc huỷ — cột này là SNAPSHOT, không đọc
        // ngược từ tour về sau.
        freeCancellationDays: tour.freeCancellationDays,
        status: 'REFUNDED',
        decisionNote: 'Full refund issued automatically: the operator cancelled the departure.',
        decidedAt: ISOT(ngayHuy),
        createdAt: ISOT(ngayHuy - 3600000),
      });
    }
  }

  return { bookings, paymentEvents, refunds, cancellationRequests };
}

const ket = sinh();
export const bookingsGia = ket.bookings;
export const paymentEventsGia = ket.paymentEvents;
export const refundsGia = ket.refunds;
export const cancellationRequestsGia = ket.cancellationRequests;

/**
 * Ghế đã đặt của mỗi chuyến — DẪN XUẤT từ booking, không đặt tay.
 *
 * Bộ cũ khai 438 ghế đã đặt mà chỉ có 2 booking đứng sau, tức đếm hai lần.
 * Chỉ booking `PAID` mới giữ ghế: chuyến bị huỷ thì khách đã được hoàn tiền và
 * ghế trả về, đúng như `bookings.service.ts` làm khi huỷ.
 */
export const gheDaDat = new Map<string, number>();
for (const b of ket.bookings) {
  if (b.status !== 'PAID') continue;
  gheDaDat.set(b.departureId, (gheDaDat.get(b.departureId) ?? 0) + b.numAdults + b.numChildren);
}
