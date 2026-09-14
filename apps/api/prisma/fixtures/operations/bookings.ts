import { tourDepartures } from '../catalog/departures-2026.js';
import { tours as toursCentral } from '../catalog/tours-central.js';
import { tours as toursNorth } from '../catalog/tours-north.js';
import { tours as toursSouth } from '../catalog/tours-south.js';
import type { TourDepartureFixture } from '../catalog/types.js';
import { gioTrongNgay, HOM_NAY, isoGio, NGAY_MS, ngayUTC, PHUT_MS } from '../khung-thoi-gian.js';
import { type KhachFixture, khachGia } from '../people/customers.js';
import { boSinh, chonMot, idTinh, nguyen } from '../stable-id.js';

/**
 * Tầng vận hành: booking, payment event, refund, yêu cầu huỷ — spec 2026-09-14
 * §4.3–§4.4.
 *
 * ── Vì sao chuyến không tự đẻ ra doanh thu ──
 * Báo cáo và dashboard neo trên `bookings.paid_at` và chỉ đếm `PAID` /
 * `PARTIALLY_REFUNDED` (`stats-aggregates.ts`). Seed chuyến mà không seed booking
 * thì mọi biểu đồ vẫn phẳng lì.
 *
 * ── Ba con số PHẢI khớp code thật, không được tự nghĩ ──
 *   `unitPrice`   = `priceOverride ?? basePrice`  (`pricing.ts:effectiveUnitPrice`)
 *   `totalAmount` = `unitPrice × (người lớn + trẻ em)`  (`pricing.ts:totalAmount`)
 *   `seatsBooked` chỉ đếm booking PAID — seed đặt lại từ `gheDaDat`
 *
 * ── `costPerPerson` KHÔNG nằm ở đây ──
 * Nó là SNAPSHOT, seed tính lúc chèn bằng chính `perPersonTotal(tour.costItems)`.
 *
 * ── Mọi mốc nằm trong khung ──
 * `paidAt` ≥ ngày khách đăng ký + 1 ngày và ≥ lúc chuyến mở bán; < ngày khởi hành;
 * < H. Không mốc giao dịch nào chạm H.
 *
 * ── Hình dạng khớp luồng thật (`docs/conventions/booking-states.md`) ──
 * PAID là thanh toán thành công. REFUNDED là admin hoàn đủ cho chuyến công ty huỷ:
 * có refund kèm lý do, KHÔNG có yêu cầu huỷ, KHÔNG có `cancelledAt`.
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
  status: 'PAID' | 'REFUNDED' | 'CANCELLED';
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
  /** Null khi chưa từng capture được tiền (giỏ bỏ dở). */
  providerPaymentId: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** Mốc thay đổi cuối của dòng — seed ghi tường minh thay vì để Prisma đóng dấu giờ chạy. */
  updatedAt: string;
}

export interface PaymentEventFixture {
  id: string;
  provider: 'STRIPE' | 'PAYPAL';
  eventId: string;
  type: string;
  payload: { seeded: true; bookingId: string; kind: 'capture' | 'refund' };
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
  providerPaymentId: string | null;
  /** Lý do NỘI BỘ: có ở hoàn tiền do admin phát hành, null ở hoàn tiền khi duyệt yêu cầu huỷ. */
  reason: string | null;
  createdAt: string;
}

export interface CancellationRequestFixture {
  id: string;
  bookingId: string;
  userId: string;
  reason: string;
  freeCancellationDays: number | null;
  status: 'REFUNDED' | 'REQUESTED' | 'DENIED';
  decisionNote: string | null;
  /** Null nghĩa là CHƯA có phán quyết (REQUESTED). */
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KetQuaVanHanh {
  bookings: BookingFixture[];
  paymentEvents: PaymentEventFixture[];
  refunds: RefundFixture[];
  cancellationRequests: CancellationRequestFixture[];
  /** Ghế đã đặt của mỗi chuyến — DẪN XUẤT từ booking PAID, không đặt tay. */
  gheDaDat: Map<string, number>;
}

type NhaCungCap = BookingFixture['paymentProvider'];
type DuLieuVanHanh = Omit<KetQuaVanHanh, 'gheDaDat'>;

/** Số booking trên một chuyến, theo trạng thái chuyến. */
const SO_BOOKING = { CLOSED: [2, 5], CANCELLED: [1, 3], OPEN: [1, 4] } as const;
/** Tỉ lệ chuyến CÒN MỞ đã có người đặt — một doanh nghiệp đang chạy thì chuyến sắp tới phải đầy dần. */
const TY_LE_OPEN_CO_KHACH = 0.75;
const DAT_TRUOC_TOI_DA_NGAY = 90;
const LY_DO_CONG_TY_HUY = 'Departure cancelled by the operator — full refund issued.';

/** Vài yêu cầu đặc biệt thật, để cột `special_requests` không trống trơn. */
const YEU_CAU = [
  'Vegetarian meals for two of us, please.',
  'We are celebrating an anniversary — no fuss needed, just letting you know.',
  'One traveller is a slow walker; please allow a little extra time at each stop.',
  'Could we be collected from the hotel lobby rather than the street entrance?',
  'Peanut allergy in the party — please flag it to the kitchen.',
  'We would like a window seat on the transfer if that is possible.',
] as const;

const tours = [...toursNorth, ...toursCentral, ...toursSouth];
const bangTour = new Map(tours.map((t) => [t.id, t]));

const tien = (n: number): string => n.toFixed(2);
const khongGach = (s: string): string => s.replace(/-/g, '');
const ngayCua = (ngayIso: string): number => Date.parse(`${ngayIso}T00:00:00.000Z`);

/** Mã booking `BK-` + 8 ký tự base36 hoa — khớp `BOOKING_CODE_PATTERN`. */
function maBooking(hat: string): string {
  const h = khongGach(idTinh('booking-code', hat));
  let n = BigInt(`0x${h.slice(0, 16)}`);
  let ra = '';
  const BANG = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < 8; i++) {
    ra += BANG[Number(n % 36n)];
    n /= 36n;
  }
  return `BK-${ra}`;
}

/** `provider_session_id` là UNIQUE — id tất định theo booking nên không bao giờ đụng nhau. */
function maPhien(nhaCC: NhaCungCap, id: string): string {
  return `${nhaCC === 'STRIPE' ? 'cs_test_' : 'PAYPALORD-'}${khongGach(idTinh('sess', id)).slice(0, 24)}`;
}

function maThanhToan(nhaCC: NhaCungCap, id: string): string {
  return `${nhaCC === 'STRIPE' ? 'pi_' : 'PAYPALCAP-'}${khongGach(idTinh('pay', id)).slice(0, 24)}`;
}

function maHoan(nhaCC: NhaCungCap, id: string): string {
  return `${nhaCC === 'STRIPE' ? 're_' : 'PAYPALRF-'}${khongGach(idTinh('rf', id)).slice(0, 24)}`;
}

function suKienThu(b: BookingFixture, luc: number): PaymentEventFixture {
  return {
    id: idTinh('pe-thu', b.id),
    provider: b.paymentProvider,
    eventId: `evt_${khongGach(idTinh('evt-thu', b.id)).slice(0, 24)}`,
    type:
      b.paymentProvider === 'STRIPE' ? 'checkout.session.completed' : 'PAYMENT.CAPTURE.COMPLETED',
    payload: { seeded: true, bookingId: b.id, kind: 'capture' },
    amount: b.totalAmount,
    currency: b.currency,
    bookingId: b.id,
    processedAt: isoGio(luc),
    receivedAt: isoGio(luc),
  };
}

function suKienHoan(b: BookingFixture, soTien: string, luc: number): PaymentEventFixture {
  return {
    id: idTinh('pe-hoan', b.id),
    provider: b.paymentProvider,
    eventId: `evt_${khongGach(idTinh('evt-hoan', b.id)).slice(0, 24)}`,
    type: b.paymentProvider === 'STRIPE' ? 'charge.refunded' : 'PAYMENT.CAPTURE.REFUNDED',
    payload: { seeded: true, bookingId: b.id, kind: 'refund' },
    amount: soTien,
    currency: b.currency,
    bookingId: b.id,
    processedAt: isoGio(luc),
    receivedAt: isoGio(luc),
  };
}

/**
 * Ghế đã đặt của mỗi chuyến — chỉ booking PAID giữ ghế: booking bị huỷ hay được
 * hoàn đã trả ghế về, đúng như service thật làm.
 */
export function demGhe(bookings: BookingFixture[]): Map<string, number> {
  const ra = new Map<string, number>();
  for (const b of bookings) {
    if (b.status !== 'PAID') continue;
    ra.set(b.departureId, (ra.get(b.departureId) ?? 0) + b.numAdults + b.numChildren);
  }
  return ra;
}

/** Booking đã trả tiền và chuyến công ty huỷ — phần lõi của tầng vận hành. */
function sinhDatCho(H: number, lich: TourDepartureFixture[], khach: KhachFixture[]): DuLieuVanHanh {
  const kq: DuLieuVanHanh = {
    bookings: [],
    paymentEvents: [],
    refunds: [],
    cancellationRequests: [],
  };
  // Lịch đã kín của từng khách — [bắt đầu, kết thúc] tính bằng mốc ms.
  const lichKhach = new Map<string, [number, number][]>();
  const trungLich = (userId: string, batDau: number, ketThuc: number): boolean =>
    (lichKhach.get(userId) ?? []).some(([a, b]) => batDau <= b && a <= ketThuc);

  for (const dep of lich) {
    const tour = bangTour.get(dep.tourId);
    if (!tour) continue;
    const rndDep = boSinh(`bk-dep:${dep.id}`);
    if (dep.status === 'OPEN' && rndDep() >= TY_LE_OPEN_CO_KHACH) continue;

    const [min, max] = SO_BOOKING[dep.status];
    const muon = nguyen(rndDep, min, max);
    const donGia = Number(dep.priceOverride ?? tour.basePrice);
    const batDau = ngayCua(dep.startDate);
    const ketThuc = ngayCua(dep.endDate);
    const moBan = Date.parse(dep.createdAt);
    const congTyHuy = dep.status === 'CANCELLED';
    // Ngày trả tiền muộn nhất (nửa đêm UTC): trước khởi hành 1 ngày — 2 ngày với chuyến
    // công ty sẽ huỷ, để mốc hoàn vẫn rơi trước ngày khởi hành — và trước ngày H.
    const ngayMuonNhat = Math.min(batDau - (congTyHuy ? 2 : 1) * NGAY_MS, H - NGAY_MS);
    let gheDaDung = 0;
    // Một khách chỉ đặt MỘT lần trên cùng một chuyến.
    const khachTrenChuyen = new Set<string>();

    for (let k = 0; k < muon; k++) {
      const rnd = boSinh(`bk:${dep.id}:${k}`);

      // ── Khách ── chọn trước, vì `paidAt` phải nằm sau ngày họ có tài khoản. Thử vài
      // người: người bốc được có thể đã đặt chuyến này, hoặc đang đi chuyến khác trùng ngày.
      let nguoi: KhachFixture | null = null;
      for (let lan = 0; lan < 12; lan++) {
        const ung = khach[nguyen(rnd, 0, khach.length - 1)];
        if (!ung || khachTrenChuyen.has(ung.id) || trungLich(ung.id, batDau, ketThuc)) continue;
        nguoi = ung;
        break;
      }
      if (!nguoi) continue;

      // ── Ngày trả tiền ── đặt trước 0–90 ngày, CO theo khoảng khả dụng thay vì dồn về
      // ngày sớm nhất: khách mới hay chuyến vừa mở bán vẫn ra ngày rải đều, không đẻ
      // đỉnh giả ở đầu khoảng (đầu tháng 1 là chỗ dễ dính nhất).
      const somNhat = Math.max(nguoi.createdAt.getTime() + NGAY_MS, moBan);
      if (ngayUTC(somNhat) > ngayMuonNhat) continue;
      const soNgayKhaDung = Math.round((ngayMuonNhat - ngayUTC(somNhat)) / NGAY_MS);
      const ngayTra =
        ngayMuonNhat - nguyen(rnd, 0, Math.min(DAT_TRUOC_TOI_DA_NGAY, soNgayKhaDung)) * NGAY_MS;
      const paidAt = Math.max(somNhat, ngayTra + gioTrongNgay(rnd));

      // ── Ghế ── không bao giờ vượt sức chứa còn lại. Chuyến CÒN MỞ mang giá khuyến mãi
      // luôn chừa ít nhất một ghế: card trên /tours in giá rẻ nhất, chuyến giảm giá kín
      // chỗ là trang rao một mức giá không ai mua được.
      const giuLai = dep.status === 'OPEN' && dep.priceOverride ? 1 : 0;
      const conLai = dep.seatsTotal - gheDaDung - giuLai;
      if (conLai < 1) break;
      const nguoiLon = Math.min(nguyen(rnd, 1, 3), conLai);
      const treEm = Math.min(rnd() < 0.28 ? nguyen(rnd, 1, 2) : 0, conLai - nguoiLon);
      gheDaDung += nguoiLon + treEm;
      khachTrenChuyen.add(nguoi.id);
      lichKhach.set(nguoi.id, [...(lichKhach.get(nguoi.id) ?? []), [batDau, ketThuc]]);

      const id = idTinh('booking', dep.id, k);
      const nhaCC: NhaCungCap = rnd() < 0.7 ? 'STRIPE' : 'PAYPAL';
      const tongTien = tien(donGia * (nguoiLon + treEm));
      // Đơn được tạo vài phút trước khi thanh toán xong, không sớm hơn lúc chuyến mở bán.
      const taoLuc = Math.max(moBan, paidAt - nguyen(rnd, 5, 40) * PHUT_MS);

      const booking: BookingFixture = {
        id,
        code: maBooking(`${dep.id}:${k}`),
        userId: nguoi.id,
        tourId: tour.id,
        departureId: dep.id,
        numAdults: nguoiLon,
        numChildren: treEm,
        totalAmount: tongTien,
        currency: tour.currency,
        status: congTyHuy ? 'REFUNDED' : 'PAID',
        tourTitle: tour.title,
        departureStartDate: dep.startDate,
        departureEndDate: dep.endDate,
        unitPrice: tien(donGia),
        contactName: nguoi.name,
        contactEmail: nguoi.email,
        contactPhone: nguoi.phone,
        specialRequests: rnd() < 0.18 ? chonMot(rnd, YEU_CAU) : null,
        paymentProvider: nhaCC,
        providerSessionId: maPhien(nhaCC, id),
        providerPaymentId: maThanhToan(nhaCC, id),
        paidAt: isoGio(paidAt),
        cancelledAt: null,
        createdAt: isoGio(taoLuc),
        updatedAt: isoGio(paidAt),
      };
      kq.bookings.push(booking);
      kq.paymentEvents.push(suKienThu(booking, paidAt));

      if (!congTyHuy) continue;

      // ── Công ty huỷ chuyến ── admin hoàn đủ khoảng 14 ngày trước ngày đi, luôn sau lúc
      // trả tiền. Luồng hoàn tiền của admin KHÔNG tạo yêu cầu huỷ và KHÔNG đặt `cancelledAt`.
      const hoanLuc = Math.max(paidAt + NGAY_MS, batDau - 14 * NGAY_MS + gioTrongNgay(rnd));
      kq.refunds.push({
        id: idTinh('refund', id),
        bookingId: id,
        amount: tongTien,
        currency: tour.currency,
        providerRefundId: maHoan(nhaCC, id),
        providerPaymentId: maThanhToan(nhaCC, id),
        reason: LY_DO_CONG_TY_HUY,
        createdAt: isoGio(hoanLuc),
      });
      kq.paymentEvents.push(suKienHoan(booking, tongTien, hoanLuc));
      booking.updatedAt = isoGio(hoanLuc);
    }
  }
  return kq;
}

export function sinhVanHanh(
  homNay: Date,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): KetQuaVanHanh {
  const duLieu = sinhDatCho(homNay.getTime(), lich, khach);
  return { ...duLieu, gheDaDat: demGhe(duLieu.bookings) };
}

const vanHanh = sinhVanHanh(HOM_NAY, tourDepartures, khachGia);
export const bookingsGia = vanHanh.bookings;
export const paymentEventsGia = vanHanh.paymentEvents;
export const refundsGia = vanHanh.refunds;
export const cancellationRequestsGia = vanHanh.cancellationRequests;
export const gheDaDat = vanHanh.gheDaDat;
