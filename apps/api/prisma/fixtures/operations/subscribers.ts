import { GIO_MS, HOM_NAY, isoGio, mocTrongKhoang, NGAY_MS, PHUT_MS } from '../khung-thoi-gian.js';
import { type KhachFixture, khachGia, taoDanhTinh } from '../people/customers.js';
import { boSinh, idTinh, nguyen } from '../stable-id.js';

/**
 * Subscribers — double opt-in (spec 2026-09-14 §5.2).
 *
 * ── Bốn trạng thái, đúng thứ luồng thật tạo ra được ──
 *   chờ xác nhận        `confirmedAt` null, `unsubscribedAt` null
 *   đang nhận tin        `confirmedAt` có, `unsubscribedAt` null
 *   xác nhận rồi huỷ     `unsubscribedAt` sau `confirmedAt`
 *   huỷ khi chưa xác nhận `confirmedAt` null, `unsubscribedAt` có
 * `welcomeSentAt` có ở MỌI dòng: sau W4, subscribe luôn xếp mail xác nhận trong cùng
 * transaction, nên một dòng thiếu cột này là dòng app không tạo ra được.
 *
 * ── Không seed outbox, không token ──
 * Token là chữ ký HMAC, không lưu trong DB; outbox bị worker gửi thật nên tuyệt đối
 * không chèn. `source` null vì footer web chỉ gửi email.
 */

export interface SubscriberFixture {
  id: string;
  email: string;
  source: null;
  createdAt: string;
  welcomeSentAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  /** Mốc mới nhất trong ba cột trên — seed ghi tường minh. */
  updatedAt: string;
}

/** Tỉ lệ đăng ký dùng email của khách giả — khách đặt tour cũng nhận tin. */
const TY_LE_KHACH_GIA = 0.3;
/** Số đăng ký của tháng (0 = tháng 1): tăng dần theo năm. */
const soTrongThang = (thang: number): number => Math.round(12 + (18 * thang) / 8);

export function sinhSubscriber(homNay: Date, khach: KhachFixture[]): SubscriberFixture[] {
  const H = homNay.getTime();
  // Khách vãng lai không được mang email của khách giả; mỗi khách giả đăng ký tối đa một lần.
  const daDung = new Set(khach.map((k) => k.email.split('@')[0] ?? k.email));
  const khachChuaDangKy = [...khach];
  const ra: SubscriberFixture[] = [];
  let chiSoVangLai = 2000;

  for (let thang = 0; thang < 12; thang++) {
    const dauThang = Date.UTC(2026, thang, 1);
    const dauThangSau = Date.UTC(2026, thang + 1, 1);
    const den = Math.min(dauThangSau, H) - GIO_MS;
    if (den <= dauThang) break;
    const so = Math.round(soTrongThang(thang) * ((den - dauThang) / (dauThangSau - dauThang)));

    for (let j = 0; j < so; j++) {
      const rnd = boSinh(`subscriber:${thang}:${j}`);
      const taoLuc = mocTrongKhoang(rnd, dauThang, den);
      const chiSo = nguyen(rnd, 0, Math.max(0, khachChuaDangKy.length - 1));
      const nguoi = rnd() < TY_LE_KHACH_GIA ? khachChuaDangKy.splice(chiSo, 1)[0] : undefined;
      const email = nguoi
        ? nguoi.email
        : `${taoDanhTinh(chiSoVangLai++, daDung).phanEmail}@example.com`;

      const welcomeSentAt = taoLuc + nguyen(rnd, 1, 9) * 1000;
      const x = rnd();
      // < 0,10 chờ xác nhận · 0,10–0,15 huỷ khi chưa xác nhận · 0,15–0,25 xác nhận rồi huỷ ·
      // còn lại đang nhận tin.
      let confirmedAt: number | null = x >= 0.15 ? taoLuc + nguyen(rnd, 3, 2880) * PHUT_MS : null;
      let unsubscribedAt: number | null =
        x >= 0.1 && x < 0.25
          ? (confirmedAt ?? welcomeSentAt) + nguyen(rnd, 2, 120) * NGAY_MS
          : null;
      // Mốc rơi từ H trở đi là chuyện chưa xảy ra: xác nhận chưa tới thì cũng chưa thể huỷ.
      if (confirmedAt !== null && confirmedAt >= H - PHUT_MS) {
        confirmedAt = null;
        unsubscribedAt = null;
      }
      if (unsubscribedAt !== null && unsubscribedAt >= H - PHUT_MS) unsubscribedAt = null;

      ra.push({
        id: idTinh('subscriber', email),
        email,
        source: null,
        createdAt: isoGio(taoLuc),
        welcomeSentAt: isoGio(welcomeSentAt),
        confirmedAt: confirmedAt === null ? null : isoGio(confirmedAt),
        unsubscribedAt: unsubscribedAt === null ? null : isoGio(unsubscribedAt),
        updatedAt: isoGio(Math.max(welcomeSentAt, confirmedAt ?? 0, unsubscribedAt ?? 0)),
      });
    }
  }

  // Thẻ "Unsubscribed 28d" không được về 0 chỉ vì may rủi của một H cụ thể.
  const tu = H - 28 * NGAY_MS;
  if (!ra.some((s) => s.unsubscribedAt !== null && Date.parse(s.unsubscribedAt) >= tu)) {
    const s = ra.find(
      (x) =>
        x.confirmedAt !== null &&
        x.unsubscribedAt === null &&
        Date.parse(x.confirmedAt) <= H - 30 * NGAY_MS,
    );
    if (s) {
      const luc = mocTrongKhoang(
        boSinh(`subscriber-huy:${s.id}`),
        H - 20 * NGAY_MS,
        H - 2 * GIO_MS,
      );
      s.unsubscribedAt = isoGio(luc);
      s.updatedAt = isoGio(luc);
    }
  }
  return ra;
}

export const subscribersGia: SubscriberFixture[] = sinhSubscriber(HOM_NAY, khachGia);
