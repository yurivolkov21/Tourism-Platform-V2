import { cancellationDeadline, refundOnCancel } from '@tourism/contract';
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
 * `paidAt` ≥ ngày khách đăng ký + 1 ngày và ≥ lúc chuyến mở bán; ≤ hạn chót của chuyến
 * (ADR-0041 — sau hạn chót app từ chối tạo booking, nên seed cũng không được có);
 * < H. Không mốc giao dịch nào chạm H.
 *
 * ── Ngày Việt Nam = ngày UTC trong bộ seed này ──
 * Mọi mốc dựng theo khuôn `ngayUTC(x) + gioTrongNgay(rnd)`, mà `gioTrongNgay` chỉ trả
 * 01:00–15:00 UTC, tức 08:00–22:00 giờ Việt Nam của CHÍNH ngày đó. Nhờ vậy phép so ngày
 * ở đây làm bằng mốc ms vẫn cho ra cùng kết quả với `vietnamToday` của contract. Ai đổi
 * `gioTrongNgay` phải đọc lại chỗ này trước.
 *
 * ── Hình dạng khớp luồng thật (`docs/conventions/booking-states.md`) ──
 * Mỗi hình dạng ứng với đúng một luồng của app; tổ hợp nào app không tạo ra được
 * thì seed cũng không được tạo (bản 10/09 từng có bốn tổ hợp như vậy trên prod):
 *   PAID       thanh toán thành công.
 *   REFUNDED   admin hoàn đủ cho chuyến công ty huỷ — refund kèm lý do, `admin_id` có
 *              người, KHÔNG yêu cầu huỷ, KHÔNG `cancelledAt`.
 *   CANCELLED  (a) giỏ bỏ dở: chưa trả, job `pending-sweep` huỷ sau 65 phút;
 *              (b) khách tự huỷ TRONG hạn: yêu cầu REFUNDED do chính khách quyết, đúng
 *                  một dòng hoàn bằng phần còn lại, `admin_id` NULL;
 *              (c) khách tự huỷ QUÁ hạn: yêu cầu REFUNDED, KHÔNG dòng hoàn nào.
 * Không còn DENIED hay REQUESTED: ADR-0041 gỡ luồng duyệt huỷ, app không tạo ra được
 * hai trạng thái đó nữa.
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
  /** Lý do NỘI BỘ: có ở hoàn tiền do admin phát hành, null ở dòng hoàn sinh khi khách tự huỷ. */
  reason: string | null;
  /**
   * true = admin bấm hoàn (seed ghi `admin_id` = admin). false = lõi huỷ ghi lúc khách tự
   * huỷ, `admin_id` phải NULL (Hợp đồng C): admin không đứng sau hành động đó, và trang
   * admin dựa vào cột ấy để không gán nhầm việc của khách cho người trực.
   */
  issuedByAdmin: boolean;
  createdAt: string;
}

/**
 * Yêu cầu huỷ sau ADR-0041: app chỉ còn MỘT hình dạng — khách bấm huỷ, hệ thống chốt ngay.
 * Không còn REQUESTED hay DENIED nên `decisionNote` biến mất theo; `freeCancellationDays`
 * cũng vậy, vì hạn chót nay suy ra từ độ dài chuyến chứ không phải số ghim trên tour.
 * `createdAt` LUÔN bằng `decidedAt`: lõi huỷ (Hợp đồng C) ghi cả hai bằng cùng một `now()`
 * của DB, và báo cáo (Hợp đồng D) xếp loại trong/quá hạn bằng `createdAt` trong khi số tiền
 * tính tại mốc huỷ — để hai mốc lệch nhau là để sổ hoàn và báo cáo nói hai chuyện.
 */
export interface CancellationRequestFixture {
  id: string;
  bookingId: string;
  userId: string;
  /** Khách được phép bỏ trống ô lý do — Task 2 cho cột `reason` nhận NULL. */
  reason: string | null;
  status: 'REFUNDED';
  decidedAt: string;
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
/**
 * Trần của `gioTrongNgay` (15:00 UTC = 22:00 giờ Việt Nam cùng ngày). Dùng để so mốc THẲNG
 * thay vì cắt về nửa đêm UTC: một mốc 18:00 UTC của ngày chót vẫn "đúng ngày UTC" nhưng đã
 * là hôm sau ở Việt Nam, tức đã quá hạn theo `isWithinDeadline`.
 */
const TRAN_GIO_TRONG_NGAY = 15 * GIO_MS;
const LY_DO_CONG_TY_HUY = 'Departure cancelled by the operator — full refund issued.';

/**
 * Sàn booking ĐÃ ĐI mỗi tour: booking PAID trên chuyến CLOSED kết thúc trước H ít nhất 3 ngày
 * — đúng loại booking bước bù review nhận (`reviews-verified.ts`, sàn ≥ 3 review đã duyệt).
 */
const SAN_BOOKING_DA_DI = 3;
/** Sàn demo (spec 2026-09-15 §11): số booking PAID trên chuyến đã qua hạn chót mà chưa khởi hành. */
const SAN_BOOKING_QUA_HAN = 3;
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
  // công ty sẽ huỷ, để mốc hoàn vẫn rơi trước ngày khởi hành — trước ngày H, và KHÔNG
  // muộn hơn ngày chót của chuyến: từ ADR-0041 app từ chối tạo booking sau hạn chót, nên
  // một `paid_at` muộn hơn là hình dạng app không bao giờ đẻ ra được.
  const hanChot = ngayCua(cancellationDeadline(dep.startDate, dep.endDate));
  const ngayMuonNhat = Math.min(batDau - (congTyHuy ? 2 : 1) * NGAY_MS, so.H - NGAY_MS, hanChot);
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
    // So THẲNG mốc, không cắt về nửa đêm: mốc 17:00 UTC trở đi của ngày chót đã sang hôm
    // sau theo giờ Việt Nam, và `paidAt` lấy `max(somNhat, …)` nên mốc đó lọt thẳng ra.
    if (somNhatCua(ung) > ngayMuonNhat + TRAN_GIO_TRONG_NGAY) continue;
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
    issuedByAdmin: true,
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
 * Trạng thái đặt chỗ dựng lại từ sổ hiện có, để bước bù đi qua ĐÚNG luật của lượt tự nhiên.
 * Lịch kín và cặp khách–chuyến tính từ MỌI booking, kể cả booking đã huỷ.
 */
function soDatChoTuSo(kq: DuLieuVanHanh, H: number, khach: KhachFixture[]): SoDatCho {
  const so: SoDatCho = {
    kq,
    H,
    khach,
    lichKhach: new Map(),
    daDat: new Set(),
    ghe: demGhe(kq.bookings),
  };
  for (const b of kq.bookings) {
    so.daDat.add(`${b.userId}:${b.departureId}`);
    const chuyenCu = so.lichKhach.get(b.userId) ?? [];
    so.lichKhach.set(b.userId, [
      ...chuyenCu,
      [ngayCua(b.departureStartDate), ngayCua(b.departureEndDate)],
    ]);
  }
  return so;
}

/**
 * Sàn booking ĐÃ ĐI: mỗi tour ≥ `SAN_BOOKING_DA_DI` booking PAID trên chuyến CLOSED kết thúc
 * trước H ít nhất 3 ngày — đúng loại booking bước bù review nhận (`reviews-verified.ts`), để
 * sàn "≥ 3 review đã duyệt mỗi tour" là ràng buộc cấu trúc chứ không phải may rủi. Với H sớm
 * một tour chỉ có vài chuyến lịch sử, và bước khách tự huỷ có thể lấy đúng booking của tour ấy.
 *
 * Chạy SAU bước khách tự huỷ. Bù bằng chính `datMotBooking` trên chỉ số `bu-<n>`, nên id không
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
  const so = soDatChoTuSo(kq, H, khach);
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

/**
 * Sàn "còn booking để demo huỷ quá hạn" (spec 2026-09-15 §7 và §11): ít nhất
 * `SAN_BOOKING_QUA_HAN` booking PAID nằm trên chuyến CÒN BÁN đã qua hạn chót tại H mà chưa
 * khởi hành. `departures-2026.ts` bảo đảm luôn có 6 chuyến như vậy (mỗi tour ≥ 4 ngày một
 * chuyến), nhưng lượt đặt tự nhiên chỉ đụng tới chuyến OPEN với xác suất 0,75 nên không có
 * gì bảo đảm chúng có khách.
 *
 * Chạy SAU `apDungKhachTuHuy` — nếu chạy trước, chính bước huỷ có thể lấy mất đúng những
 * booking này — và bù bằng chính `datMotBooking` trên chỉ số `qua-han-<n>`, nên id không đụng
 * booking tự nhiên và mọi luật đặt chỗ vẫn giữ (gồm cả trần `paid_at` ≤ ngày chót trong `datMotBooking`).
 * Hụt sàn thì ném: fixture sinh lúc import, trước mọi lệnh ghi, nên seed không bao giờ ghi
 * một bộ dữ liệu thiếu ca demo. Export để test nhánh.
 */
export function baoDamBookingQuaHan(
  kq: DuLieuVanHanh,
  H: number,
  lich: TourDepartureFixture[],
  khach: KhachFixture[],
): void {
  const so = soDatChoTuSo(kq, H, khach);
  const chuyen = lich.filter(
    (d) =>
      d.status === 'OPEN' &&
      ngayCua(d.startDate) > H &&
      ngayCua(cancellationDeadline(d.startDate, d.endDate)) < H,
  );
  const hopLe = new Set(chuyen.map((d) => d.id));
  const soQuaHan = (): number =>
    kq.bookings.filter((b) => b.status === 'PAID' && hopLe.has(b.departureId)).length;
  for (let n = 0; n < LUOT_BU_TOI_DA && soQuaHan() < SAN_BOOKING_QUA_HAN; n++) {
    const dep = chuyen[n % chuyen.length];
    if (!dep) break;
    const tour = bangTour.get(dep.tourId);
    if (!tour) break;
    datMotBooking(so, dep, tour, `qua-han-${n}`);
  }
  if (soQuaHan() < SAN_BOOKING_QUA_HAN) {
    throw new Error(
      `sàn booking quá hạn: chỉ có ${soQuaHan()}/${SAN_BOOKING_QUA_HAN} booking PAID trên chuyến đã qua hạn chót với H = ${isoGio(H)}`,
    );
  }
}

const LY_DO_KHACH_HUY = [
  'Our connecting flight was rescheduled and we can no longer make the start time.',
  'One of the party is unwell and we would rather not travel.',
  'A work commitment came up that we cannot move.',
  'A family matter means we have to stay home that week.',
] as const;
const SO_GIO_BO_DO = 16;
/** Số ca huỷ mỗi loại — đủ cho hai dòng báo cáo (Hợp đồng D) và cả hai nhánh giao diện. */
const SO_HUY_TRONG_HAN = 9;
const SO_HUY_QUA_HAN = 6;
/** Tỉ lệ khách bấm huỷ mà bỏ trống ô lý do — cột `reason` nay nhận NULL (Task 2). */
const TY_LE_KHONG_LY_DO = 0.25;

/**
 * Khách TỰ huỷ booking đã trả (ADR-0041 §3.3): không ai duyệt, nên mỗi lần huỷ đẻ ra đúng
 * một yêu cầu `REFUNDED` do chính khách quyết, cộng một dòng hoàn NẾU còn trong hạn.
 *
 * ── Vì sao chọn NGÀY rồi mới gắn giờ ──
 * Mốc huỷ dựng bằng `<nửa đêm UTC của một ngày> + gioTrongNgay(rnd)`, tức 01:00–15:00 UTC
 * = 08:00–22:00 giờ Việt Nam CÙNG ngày. Nhờ vậy ngày Việt Nam của mốc đúng bằng ngày UTC
 * đã chọn, và phép so với ngày chót ở đây khớp `isWithinDeadline` của contract. Dùng
 * `mocTrongKhoang` thì không: nó kẹp về biên `tu`, mà `tu` là `paidAt` cộng vài giờ nên
 * có thể rơi ra ngoài dải giờ ban ngày.
 *
 * ── KHÔNG ném lỗi khi hụt ca ──
 * Đây là bước TẠO HÌNH, không phải sàn. Sàn demo "còn booking để huỷ quá hạn" do
 * `baoDamBookingQuaHan` giữ và chính nó mới ném; số ca huỷ chỉ là assertion trong spec.
 * Export để test nhánh.
 */
export function apDungKhachTuHuy(kq: DuLieuVanHanh, H: number): void {
  const ungVien = kq.bookings
    .filter((b) => b.status === 'PAID' && b.paidAt !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  const daDung = new Set<string>();

  /**
   * Khoảng NGÀY (nửa đêm UTC) mà khách còn bấm huỷ được, theo loại ca. Null = khoảng rỗng.
   * Cả hai loại đều chặn trên bởi H − 1 ngày: không mốc giao dịch nào chạm H.
   */
  const cuaSoNgay = (b: BookingFixture, loai: 'trong-han' | 'qua-han'): [number, number] | null => {
    if (b.paidAt === null) return null;
    const hanChot = ngayCua(cancellationDeadline(b.departureStartDate, b.departureEndDate));
    const sauKhiTra = ngayUTC(Date.parse(b.paidAt)) + NGAY_MS;
    const truocH = H - NGAY_MS;
    // Quá hạn: sau ngày chót và TRƯỚC ngày khởi hành (`canCancelOnline`). Tour 1 ngày có
    // D = ngày đi − 1 nên khoảng này rỗng — đúng luật, không phải thiếu sót.
    const tu = loai === 'trong-han' ? sauKhiTra : Math.max(sauKhiTra, hanChot + NGAY_MS);
    const den =
      loai === 'trong-han'
        ? Math.min(hanChot, truocH)
        : Math.min(ngayCua(b.departureStartDate) - NGAY_MS, truocH);
    return den < tu ? null : [tu, den];
  };

  for (const loai of ['trong-han', 'qua-han'] as const) {
    const muon = loai === 'trong-han' ? SO_HUY_TRONG_HAN : SO_HUY_QUA_HAN;
    let soDaChon = 0;
    for (const b of ungVien) {
      if (soDaChon >= muon) break;
      if (daDung.has(b.id) || b.status !== 'PAID') continue;
      const cua = cuaSoNgay(b, loai);
      if (cua === null) continue;
      const rnd = boSinh(`huy-khach:${loai}:${b.id}`);
      const [tu, den] = cua;
      const huyLuc =
        tu + nguyen(rnd, 0, Math.round((den - tu) / NGAY_MS)) * NGAY_MS + gioTrongNgay(rnd);
      // Tính bằng CHÍNH hàm luật mà API, web và email dùng: trong hạn ra phần còn lại,
      // quá hạn ra '0.00'. Seed không bao giờ tự nhân chia lấy số tiền hoàn.
      const soTien = refundOnCancel({
        now: new Date(huyLuc),
        startDate: b.departureStartDate,
        endDate: b.departureEndDate,
        totalAmount: b.totalAmount,
        refundedTotal: '0.00',
      });

      kq.cancellationRequests.push({
        id: idTinh('huy-khach', b.id),
        bookingId: b.id,
        userId: b.userId,
        reason: rnd() < TY_LE_KHONG_LY_DO ? null : chonMot(rnd, LY_DO_KHACH_HUY),
        status: 'REFUNDED',
        decidedAt: isoGio(huyLuc),
        createdAt: isoGio(huyLuc),
        updatedAt: isoGio(huyLuc),
      });
      b.status = 'CANCELLED';
      b.cancelledAt = isoGio(huyLuc);
      b.updatedAt = isoGio(huyLuc);
      // Quá hạn KHÔNG ghi dòng hoàn nào: sổ refund chỉ kể tiền thật sự đi ra.
      if (Number(soTien) > 0) {
        kq.refunds.push({
          id: idTinh('refund', b.id),
          bookingId: b.id,
          amount: soTien,
          currency: b.currency,
          providerRefundId: maHoan(b.paymentProvider, b.id),
          providerPaymentId: b.providerPaymentId,
          reason: null,
          issuedByAdmin: false,
          createdAt: isoGio(huyLuc),
        });
        kq.paymentEvents.push(suKienHoan(b, soTien, huyLuc));
      }
      daDung.add(b.id);
      soDaChon++;
    }
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
    // Giỏ bỏ dở là một lượt checkout THẬT nên cũng phải nằm trong hạn đặt chỗ: kẹp thêm
    // vào 22:00 giờ Việt Nam của ngày chót. Mốc huỷ sau đó 65–80 phút cùng lắm tới 16:20
    // UTC, vẫn là ngày chót ở Việt Nam (ngày chỉ nhảy từ 17:00 UTC).
    const hanChot = ngayCua(cancellationDeadline(dep.startDate, dep.endDate));
    const den = Math.min(
      batDau - (dep.status === 'CANCELLED' ? 15 : 2) * NGAY_MS,
      H - 2 * GIO_MS,
      hanChot + TRAN_GIO_TRONG_NGAY,
    );
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
  apDungKhachTuHuy(duLieu, H);
  // Hai sàn chạy SAU bước huỷ: bước huỷ có thể lấy mất đúng booking mà sàn đang đếm.
  baoDamBookingDaDi(duLieu, H, lich, khach);
  baoDamBookingQuaHan(duLieu, H, lich, khach);
  themGioBoDo(duLieu, H, lich, khach);
  // Đếm ghế SAU khi huỷ: booking khách tự huỷ trả ghế về, giỏ bỏ dở chưa từng giữ ghế.
  return { ...duLieu, gheDaDat: demGhe(duLieu.bookings) };
}

const vanHanh = sinhVanHanh(HOM_NAY, tourDepartures, khachGia);
export const bookingsGia = vanHanh.bookings;
export const paymentEventsGia = vanHanh.paymentEvents;
export const refundsGia = vanHanh.refunds;
export const cancellationRequestsGia = vanHanh.cancellationRequests;
export const gheDaDat = vanHanh.gheDaDat;
