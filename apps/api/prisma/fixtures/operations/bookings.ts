import { policyRefundAmount, refundPercentForRequest } from '@tourism/contract';
import { tourDepartures } from '../catalog/departures-2026.js';
import { tours as toursCentral } from '../catalog/tours-central.js';
import { tours as toursNorth } from '../catalog/tours-north.js';
import { tours as toursSouth } from '../catalog/tours-south.js';
import type { TourDepartureFixture, TourFixture } from '../catalog/types.js';
import {
  GIO_MS,
  gioTrongNgay,
  HOM_NAY,
  isoGio,
  mocTrongKhoang,
  NGAY_MS,
  ngayUTC,
  PHUT_MS,
} from '../khung-thoi-gian.js';
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
 * Mỗi hình dạng ứng với đúng một luồng của app; tổ hợp nào app không tạo ra được
 * thì seed cũng không được tạo (bản 10/09 từng có bốn tổ hợp như vậy trên prod):
 *   PAID       thanh toán thành công.
 *   REFUNDED   admin hoàn đủ cho chuyến công ty huỷ — refund kèm lý do, KHÔNG yêu cầu
 *              huỷ, KHÔNG `cancelledAt`.
 *   CANCELLED  (a) giỏ bỏ dở: chưa trả, job `pending-sweep` huỷ sau 65 phút;
 *              (b) khách xin huỷ và admin duyệt: yêu cầu REFUNDED, hoàn theo bậc chính
 *              sách, bậc 0% thì không có refund.
 * Yêu cầu DENIED và REQUESTED giữ booking ở PAID.
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
/** Kết quả tầng vận hành trước bước đếm ghế. */
export type DuLieuVanHanh = Omit<KetQuaVanHanh, 'gheDaDat'>;

/** Số booking trên một chuyến, theo trạng thái chuyến. */
const SO_BOOKING = { CLOSED: [2, 5], CANCELLED: [1, 3], OPEN: [1, 4] } as const;
/** Tỉ lệ chuyến CÒN MỞ đã có người đặt — một doanh nghiệp đang chạy thì chuyến sắp tới phải đầy dần. */
const TY_LE_OPEN_CO_KHACH = 0.75;
const DAT_TRUOC_TOI_DA_NGAY = 90;
const LY_DO_CONG_TY_HUY = 'Departure cancelled by the operator — full refund issued.';

/**
 * Sàn booking ĐÃ ĐI mỗi tour: booking PAID trên chuyến CLOSED kết thúc trước H ít nhất 3 ngày
 * — đúng loại booking bước bù review nhận (`reviews-verified.ts`, sàn ≥ 3 review đã duyệt).
 */
const SAN_BOOKING_DA_DI = 3;
/** Số lượt đặt bù tối đa cho một tour — mỗi lượt là một chỉ số booking mới. */
const LUOT_BU_TOI_DA = 60;

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

/** Kết quả một lượt đặt chỗ: đặt được, chuyến hết ghế, hoặc bỏ lượt vì không bốc được khách hợp lệ. */
type KetQuaDat = 'da-dat' | 'het-ghe' | 'bo-qua';

/** Trạng thái chung của mọi lượt đặt chỗ — lượt tự nhiên và lượt bù đi qua CÙNG một luật. */
interface SoDatCho {
  kq: DuLieuVanHanh;
  H: number;
  khach: KhachFixture[];
  /** Lịch đã kín của từng khách — [bắt đầu, kết thúc] tính bằng mốc ms. */
  lichKhach: Map<string, [number, number][]>;
  /** `userId:departureId` đã có booking — một khách chỉ đặt MỘT lần trên cùng một chuyến. */
  daDat: Set<string>;
  /** Ghế booking đang giữ trên từng chuyến. */
  ghe: Map<string, number>;
}

/**
 * Một lượt đặt chỗ trên chuyến `dep`. Chỉ số `k` quyết định id, mã booking và hạt ngẫu nhiên,
 * nên hai lượt khác `k` trên cùng chuyến không bao giờ trùng id; còn khách được bốc và số ghế
 * phụ thuộc trạng thái chung `so` lúc gọi.
 */
function datMotBooking(
  so: SoDatCho,
  dep: TourDepartureFixture,
  tour: TourFixture,
  k: number | string,
): KetQuaDat {
  const rnd = boSinh(`bk:${dep.id}:${k}`);
  const donGia = Number(dep.priceOverride ?? tour.basePrice);
  const batDau = ngayCua(dep.startDate);
  const ketThuc = ngayCua(dep.endDate);
  const moBan = Date.parse(dep.createdAt);
  const congTyHuy = dep.status === 'CANCELLED';
  // Ngày trả tiền muộn nhất (nửa đêm UTC): trước khởi hành 1 ngày — 2 ngày với chuyến
  // công ty sẽ huỷ, để mốc hoàn vẫn rơi trước ngày khởi hành — và trước ngày H.
  const ngayMuonNhat = Math.min(batDau - (congTyHuy ? 2 : 1) * NGAY_MS, so.H - NGAY_MS);
  const somNhatCua = (ung: KhachFixture): number =>
    Math.max(ung.createdAt.getTime() + NGAY_MS, moBan);

  // ── Khách ── chọn trước, vì `paidAt` phải nằm sau ngày họ có tài khoản. Thử vài người:
  // người bốc được có thể đã đặt chuyến này, đang đi chuyến khác trùng ngày, hoặc đăng ký
  // quá muộn để kịp trả tiền. Khách đăng ký muộn phải bị loại NGAY lúc bốc: bản trước bốc
  // xong mới loại rồi bỏ cả lượt, nên chuyến tháng 1–4 chỉ còn ~1,7 booking so với ~3 ở
  // tháng 6–9 (đo 14/09 với H = 20/09).
  let nguoi: KhachFixture | null = null;
  for (let lan = 0; lan < 12; lan++) {
    const ung = so.khach[nguyen(rnd, 0, so.khach.length - 1)];
    if (!ung || so.daDat.has(`${ung.id}:${dep.id}`)) continue;
    if (ngayUTC(somNhatCua(ung)) > ngayMuonNhat) continue;
    if ((so.lichKhach.get(ung.id) ?? []).some(([a, b]) => batDau <= b && a <= ketThuc)) continue;
    nguoi = ung;
    break;
  }
  if (!nguoi) return 'bo-qua';

  // ── Ngày trả tiền ── đặt trước 0–90 ngày, CO theo khoảng khả dụng thay vì dồn về
  // ngày sớm nhất: khách mới hay chuyến vừa mở bán vẫn ra ngày rải đều, không đẻ
  // đỉnh giả ở đầu khoảng (đầu tháng 1 là chỗ dễ dính nhất).
  const somNhat = somNhatCua(nguoi);
  const soNgayKhaDung = Math.round((ngayMuonNhat - ngayUTC(somNhat)) / NGAY_MS);
  const ngayTra =
    ngayMuonNhat - nguyen(rnd, 0, Math.min(DAT_TRUOC_TOI_DA_NGAY, soNgayKhaDung)) * NGAY_MS;
  const paidAt = Math.max(somNhat, ngayTra + gioTrongNgay(rnd));

  // ── Ghế ── không bao giờ vượt sức chứa còn lại. Chuyến CÒN MỞ mang giá khuyến mãi
  // luôn chừa ít nhất một ghế: card trên /tours in giá rẻ nhất, chuyến giảm giá kín
  // chỗ là trang rao một mức giá không ai mua được.
  const giuLai = dep.status === 'OPEN' && dep.priceOverride ? 1 : 0;
  const conLai = dep.seatsTotal - (so.ghe.get(dep.id) ?? 0) - giuLai;
  if (conLai < 1) return 'het-ghe';
  const nguoiLon = Math.min(nguyen(rnd, 1, 3), conLai);
  const treEm = Math.min(rnd() < 0.28 ? nguyen(rnd, 1, 2) : 0, conLai - nguoiLon);
  so.ghe.set(dep.id, (so.ghe.get(dep.id) ?? 0) + nguoiLon + treEm);
  so.daDat.add(`${nguoi.id}:${dep.id}`);
  so.lichKhach.set(nguoi.id, [...(so.lichKhach.get(nguoi.id) ?? []), [batDau, ketThuc]]);

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
  so.kq.bookings.push(booking);
  so.kq.paymentEvents.push(suKienThu(booking, paidAt));
  if (!congTyHuy) return 'da-dat';

  // ── Công ty huỷ chuyến ── admin hoàn đủ khoảng 14 ngày trước ngày đi, luôn sau lúc
  // trả tiền. Luồng hoàn tiền của admin KHÔNG tạo yêu cầu huỷ và KHÔNG đặt `cancelledAt`.
  const hoanLuc = Math.max(paidAt + NGAY_MS, batDau - 14 * NGAY_MS + gioTrongNgay(rnd));
  so.kq.refunds.push({
    id: idTinh('refund', id),
    bookingId: id,
    amount: tongTien,
    currency: tour.currency,
    providerRefundId: maHoan(nhaCC, id),
    providerPaymentId: maThanhToan(nhaCC, id),
    reason: LY_DO_CONG_TY_HUY,
    createdAt: isoGio(hoanLuc),
  });
  so.kq.paymentEvents.push(suKienHoan(booking, tongTien, hoanLuc));
  booking.updatedAt = isoGio(hoanLuc);
  return 'da-dat';
}

/** Booking đã trả tiền và chuyến công ty huỷ — phần lõi của tầng vận hành. */
function sinhDatCho(H: number, lich: TourDepartureFixture[], khach: KhachFixture[]): DuLieuVanHanh {
  const kq: DuLieuVanHanh = {
    bookings: [],
    paymentEvents: [],
    refunds: [],
    cancellationRequests: [],
  };
  const so: SoDatCho = { kq, H, khach, lichKhach: new Map(), daDat: new Set(), ghe: new Map() };
  for (const dep of lich) {
    const tour = bangTour.get(dep.tourId);
    if (!tour) continue;
    const rndDep = boSinh(`bk-dep:${dep.id}`);
    if (dep.status === 'OPEN' && rndDep() >= TY_LE_OPEN_CO_KHACH) continue;
    const [min, max] = SO_BOOKING[dep.status];
    const muon = nguyen(rndDep, min, max);
    for (let k = 0; k < muon; k++) {
      if (datMotBooking(so, dep, tour, k) === 'het-ghe') break;
    }
  }
  return kq;
}

/**
 * Sàn booking ĐÃ ĐI: mỗi tour ≥ `SAN_BOOKING_DA_DI` booking PAID trên chuyến CLOSED kết thúc
 * trước H ít nhất 3 ngày — đúng loại booking bước bù review nhận (`reviews-verified.ts`), để
 * sàn "≥ 3 review đã duyệt mỗi tour" là ràng buộc cấu trúc chứ không phải may rủi. Với H sớm
 * một tour chỉ có vài chuyến lịch sử, và bước duyệt huỷ có thể lấy đúng booking của tour ấy.
 *
 * Chạy SAU bước duyệt huỷ. Bù bằng chính `datMotBooking` trên chỉ số `bu-<n>`, nên id không
 * đụng booking tự nhiên và mọi luật đặt chỗ vẫn giữ. Luôn còn ghế: `departures-2026.ts` giữ
 * ≥ 3 chuyến CLOSED mỗi tour và tối đa một chuyến kết thúc trong 3 ngày sát H, nên có ≥ 2
 * chuyến hợp lệ; còn dưới sàn thì một chuyến trong đó giữ ≤ 1 booking, tức ≤ 5 ghế, trong
 * khi sức chứa nhỏ nhất của catalog là 6.
 */
export function baoDamBookingDaDi(
  kq: DuLieuVanHanh,
  H: number,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): void {
  const so: SoDatCho = {
    kq,
    H,
    khach,
    lichKhach: new Map(),
    daDat: new Set(),
    ghe: demGhe(kq.bookings),
  };
  // Lịch kín và cặp khách–chuyến dựng lại từ MỌI booking đang có, kể cả booking đã huỷ.
  for (const b of kq.bookings) {
    so.daDat.add(`${b.userId}:${b.departureId}`);
    const chuyenCu = so.lichKhach.get(b.userId) ?? [];
    so.lichKhach.set(b.userId, [
      ...chuyenCu,
      [ngayCua(b.departureStartDate), ngayCua(b.departureEndDate)],
    ]);
  }
  for (const tour of tours) {
    const chuyen = lich.filter(
      (d) => d.tourId === tour.id && d.status === 'CLOSED' && ngayCua(d.endDate) <= H - 3 * NGAY_MS,
    );
    const hopLe = new Set(chuyen.map((d) => d.id));
    const soDaDi = (): number =>
      kq.bookings.filter((b) => b.status === 'PAID' && hopLe.has(b.departureId)).length;
    for (let n = 0; n < LUOT_BU_TOI_DA && soDaDi() < SAN_BOOKING_DA_DI; n++) {
      const dep = chuyen[n % chuyen.length];
      if (!dep) break;
      datMotBooking(so, dep, tour, `bu-${n}`);
    }
    // JSDoc trên chỉ chứng minh luôn còn ghế; bốc khách vẫn có thể hụt. Hụt thì dừng hẳn:
    // fixture sinh lúc import, trước mọi lệnh ghi, nên seed không bao giờ ghi một bộ dữ liệu
    // có tour thiếu booking đã đi.
    if (soDaDi() < SAN_BOOKING_DA_DI) {
      throw new Error(
        `sàn booking đã đi: tour ${tour.slug} chỉ có ${soDaDi()}/${SAN_BOOKING_DA_DI} booking với H = ${isoGio(H)}`,
      );
    }
  }
}

const LY_DO_KHACH_HUY = [
  'Our connecting flight was rescheduled and we can no longer make the start time.',
  'One of the party is unwell and we would rather not travel.',
  'A work commitment came up that we cannot move.',
  'A family matter means we have to stay home that week.',
] as const;
const LY_DO_DOI_NGAY = [
  'We would like to move to a later departure instead of cancelling.',
  'Could we change to a date next month rather than lose the booking?',
] as const;
const GHI_CHU_TU_CHOI =
  'Date changes are handled as a rebooking by our team — this request was closed without cancelling, and we have emailed you the available dates.';

/** Bốn bậc của `REFUND_POLICY_TIERS` — mỗi bậc vài ca để màn quyết định có đủ nhánh. */
const BAC_HOAN = [100, 50, 25, 0] as const;
const MOI_BAC = 3;
const SO_TU_CHOI = 5;
const SO_DANG_CHO = 9;
const SO_GIO_BO_DO = 16;

/**
 * Số ngày trước khởi hành để một yêu cầu rơi đúng bậc (ADR-0030): từ ngưỡng của tour
 * trở lên là 100%; dưới ngưỡng thì bảng bậc site 15–29 → 50%, 7–14 → 25%, dưới 7 →
 * 0%. Null khi ngưỡng của tour không cho bậc ấy tồn tại — tour ngưỡng 1 ngày chẳng
 * hạn không bao giờ ra 50%.
 */
function soNgayChoBac(
  bac: (typeof BAC_HOAN)[number],
  freeCancellationDays: number | null,
  rnd: () => number,
): number | null {
  const nguong = freeCancellationDays ?? 30;
  const khoang = (tu: number, den: number): number | null =>
    den < tu ? null : nguyen(rnd, tu, den);
  if (bac === 100) return khoang(nguong, nguong + 20);
  if (bac === 50) return khoang(15, Math.min(29, nguong - 1));
  if (bac === 25) return khoang(7, Math.min(14, nguong - 1));
  return khoang(1, Math.min(6, nguong - 1));
}

/**
 * Yêu cầu huỷ của khách trên booking đã trả: duyệt theo bậc, từ chối, và đang chờ.
 * Mỗi booking dính tối đa một yêu cầu, chọn theo thứ tự id cho tất định.
 * Export để test nhánh (review cuối 14/09).
 */
export function apDungYeuCauHuy(kq: DuLieuVanHanh, H: number): void {
  const ungVien = kq.bookings
    .filter((b) => b.status === 'PAID')
    .sort((a, b) => a.id.localeCompare(b.id));
  const daDung = new Set<string>();

  // ── Duyệt theo bậc ── booking CANCELLED, yêu cầu REFUNDED, hoàn đúng mức chính sách.
  for (const bac of BAC_HOAN) {
    let soDaChon = 0;
    for (const b of ungVien) {
      if (soDaChon >= MOI_BAC) break;
      if (daDung.has(b.id) || b.paidAt === null) continue;
      const tour = bangTour.get(b.tourId);
      if (!tour) continue;
      const rnd = boSinh(`yc-duyet:${bac}:${b.id}`);
      const soNgay = soNgayChoBac(bac, tour.freeCancellationDays, rnd);
      if (soNgay === null) continue;
      const batDau = ngayCua(b.departureStartDate);
      const paidAt = Date.parse(b.paidAt);
      const guiLuc = batDau - soNgay * NGAY_MS + gioTrongNgay(rnd);
      // Ngoài 24 giờ ân hạn (ân hạn luôn cho 100% và sẽ che mất bậc), và trước H.
      if (guiLuc <= paidAt + 25 * GIO_MS || guiLuc >= H) continue;
      const quyetLuc = guiLuc + nguyen(rnd, 2, 30) * GIO_MS;
      if (quyetLuc >= Math.min(batDau, H)) continue;
      // Tính bằng CHÍNH hàm của contract mà admin và API dùng — số seed và số trên màn
      // quyết định không bao giờ nói hai chuyện khác nhau.
      const phanTram = refundPercentForRequest({
        requestedAt: new Date(guiLuc),
        paidAt: b.paidAt,
        departureStartDate: b.departureStartDate,
        freeCancellationDays: tour.freeCancellationDays,
      });
      if (phanTram !== bac) continue;
      const soTien = policyRefundAmount({
        percent: phanTram,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });

      kq.cancellationRequests.push({
        id: idTinh('huy-duyet', b.id),
        bookingId: b.id,
        userId: b.userId,
        reason: chonMot(rnd, LY_DO_KHACH_HUY),
        freeCancellationDays: tour.freeCancellationDays,
        status: 'REFUNDED',
        decisionNote: null,
        decidedAt: isoGio(quyetLuc),
        createdAt: isoGio(guiLuc),
        updatedAt: isoGio(quyetLuc),
      });
      b.status = 'CANCELLED';
      b.cancelledAt = isoGio(quyetLuc);
      b.updatedAt = isoGio(quyetLuc);
      // Bậc 0% KHÔNG ghi dòng refund nào: sổ refund chỉ kể tiền thật sự đi ra.
      if (Number(soTien) > 0) {
        kq.refunds.push({
          id: idTinh('refund', b.id),
          bookingId: b.id,
          amount: soTien,
          currency: b.currency,
          providerRefundId: maHoan(b.paymentProvider, b.id),
          providerPaymentId: b.providerPaymentId,
          reason: null,
          createdAt: isoGio(quyetLuc),
        });
        kq.paymentEvents.push(suKienHoan(b, soTien, quyetLuc));
      }
      daDung.add(b.id);
      soDaChon++;
    }
  }

  // ── Từ chối ── khách xin đổi ngày chứ không phải huỷ; booking giữ PAID.
  let soTuChoi = 0;
  for (const b of ungVien) {
    if (soTuChoi >= SO_TU_CHOI) break;
    if (daDung.has(b.id) || b.status !== 'PAID' || b.paidAt === null) continue;
    const rnd = boSinh(`yc-tuchoi:${b.id}`);
    const batDau = ngayCua(b.departureStartDate);
    const tu = Date.parse(b.paidAt) + 2 * NGAY_MS;
    const den = Math.min(batDau - 4 * NGAY_MS, H - 4 * NGAY_MS);
    if (den <= tu) continue;
    const guiLuc = mocTrongKhoang(rnd, tu, den);
    // Admin trả lời sau 1–3 ngày (spec §4.4); `den` lùi 4 ngày trước khởi hành và trước H
    // nên mốc quyết vẫn rơi trước cả hai.
    const quyetLuc = guiLuc + nguyen(rnd, 24, 72) * GIO_MS;
    kq.cancellationRequests.push({
      id: idTinh('huy-tuchoi', b.id),
      bookingId: b.id,
      userId: b.userId,
      reason: chonMot(rnd, LY_DO_DOI_NGAY),
      freeCancellationDays: bangTour.get(b.tourId)?.freeCancellationDays ?? null,
      status: 'DENIED',
      decisionNote: GHI_CHU_TU_CHOI,
      decidedAt: isoGio(quyetLuc),
      createdAt: isoGio(guiLuc),
      updatedAt: isoGio(quyetLuc),
    });
    daDung.add(b.id);
    soTuChoi++;
  }

  // ── Đang chờ ── gửi trong 25 ngày trước H cho chuyến chưa khởi hành; chưa ai quyết.
  let soDangCho = 0;
  for (const b of ungVien) {
    if (soDangCho >= SO_DANG_CHO) break;
    if (daDung.has(b.id) || b.status !== 'PAID' || b.paidAt === null) continue;
    if (ngayCua(b.departureStartDate) <= H) continue;
    const rnd = boSinh(`yc-cho:${b.id}`);
    const tu = Math.max(Date.parse(b.paidAt) + NGAY_MS, H - 25 * NGAY_MS);
    const den = H - 2 * GIO_MS;
    if (den <= tu) continue;
    const guiLuc = mocTrongKhoang(rnd, tu, den);
    kq.cancellationRequests.push({
      id: idTinh('huy-cho', b.id),
      bookingId: b.id,
      userId: b.userId,
      reason: chonMot(rnd, LY_DO_KHACH_HUY),
      freeCancellationDays: bangTour.get(b.tourId)?.freeCancellationDays ?? null,
      status: 'REQUESTED',
      decisionNote: null,
      decidedAt: null,
      createdAt: isoGio(guiLuc),
      updatedAt: isoGio(guiLuc),
    });
    daDung.add(b.id);
    soDangCho++;
  }
}

/**
 * Giỏ bỏ dở: khách mở checkout rồi bỏ đi. Job `pending-sweep` huỷ mọi PENDING quá 65
 * phút, nên seed ghi thẳng hình dạng mà job để lại — CANCELLED, chưa trả, không capture,
 * `cancelledAt` = lúc tạo + 65–80 phút. Ghi PENDING thì 65 phút sau khi seed job quét cả
 * loạt trong cùng một mili-giây (đã dính trên prod ngày 10/09).
 * Export để test nhánh (review cuối 14/09).
 */
export function themGioBoDo(
  kq: DuLieuVanHanh,
  H: number,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): void {
  const daCo = new Set(kq.bookings.map((b) => `${b.userId}:${b.departureId}`));
  let soDaTao = 0;
  for (let i = 0; soDaTao < SO_GIO_BO_DO && i < 400; i++) {
    const rnd = boSinh(`gio-bo-do:${i}`);
    const dep = chonMot(rnd, lich);
    const nguoi = chonMot(rnd, khach);
    const tour = bangTour.get(dep.tourId);
    if (!tour || daCo.has(`${nguoi.id}:${dep.id}`)) continue;
    const batDau = ngayCua(dep.startDate);
    const tu = Math.max(Date.parse(dep.createdAt), nguoi.createdAt.getTime() + NGAY_MS);
    // Chuyến sẽ bị công ty huỷ thì không ai mở checkout trong hai tuần cuối trước ngày đi.
    const den = Math.min(batDau - (dep.status === 'CANCELLED' ? 15 : 2) * NGAY_MS, H - 2 * GIO_MS);
    if (den <= tu) continue;
    const taoLuc = mocTrongKhoang(rnd, tu, den);
    const huyLuc = taoLuc + nguyen(rnd, 65, 80) * PHUT_MS;
    const id = idTinh('booking-bo-do', i);
    const nhaCC: NhaCungCap = rnd() < 0.7 ? 'STRIPE' : 'PAYPAL';
    const donGia = Number(dep.priceOverride ?? tour.basePrice);
    const nguoiLon = nguyen(rnd, 1, Math.min(3, dep.seatsTotal));

    kq.bookings.push({
      id,
      code: maBooking(`bo-do:${i}`),
      userId: nguoi.id,
      tourId: tour.id,
      departureId: dep.id,
      numAdults: nguoiLon,
      numChildren: 0,
      totalAmount: tien(donGia * nguoiLon),
      currency: tour.currency,
      status: 'CANCELLED',
      tourTitle: tour.title,
      departureStartDate: dep.startDate,
      departureEndDate: dep.endDate,
      unitPrice: tien(donGia),
      contactName: nguoi.name,
      contactEmail: nguoi.email,
      contactPhone: nguoi.phone,
      specialRequests: null,
      paymentProvider: nhaCC,
      providerSessionId: maPhien(nhaCC, id),
      providerPaymentId: null,
      paidAt: null,
      cancelledAt: isoGio(huyLuc),
      createdAt: isoGio(taoLuc),
      updatedAt: isoGio(huyLuc),
    });
    daCo.add(`${nguoi.id}:${dep.id}`);
    soDaTao++;
  }
}

export function sinhVanHanh(
  homNay: Date,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): KetQuaVanHanh {
  const H = homNay.getTime();
  const duLieu = sinhDatCho(H, lich, khach);
  apDungYeuCauHuy(duLieu, H);
  // Sau bước duyệt huỷ: bước đó có thể lấy mất booking đã đi của một tour ít chuyến.
  baoDamBookingDaDi(duLieu, H, lich, khach);
  themGioBoDo(duLieu, H, lich, khach);
  // Đếm ghế SAU khi huỷ: booking huỷ đã duyệt trả ghế về, giỏ bỏ dở chưa từng giữ ghế.
  return { ...duLieu, gheDaDat: demGhe(duLieu.bookings) };
}

const vanHanh = sinhVanHanh(HOM_NAY, tourDepartures, khachGia);
export const bookingsGia = vanHanh.bookings;
export const paymentEventsGia = vanHanh.paymentEvents;
export const refundsGia = vanHanh.refunds;
export const cancellationRequestsGia = vanHanh.cancellationRequests;
export const gheDaDat = vanHanh.gheDaDat;
