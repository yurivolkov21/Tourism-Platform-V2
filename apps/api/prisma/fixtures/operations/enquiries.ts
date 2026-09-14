import { tours as toursCentral } from '../catalog/tours-central.js';
import { tours as toursNorth } from '../catalog/tours-north.js';
import { tours as toursSouth } from '../catalog/tours-south.js';
import {
  CUOI_KHUNG,
  GIO_MS,
  HOM_NAY,
  isoGio,
  isoNgay,
  mocTrongKhoang,
  NGAY_MS,
  ngayUTC,
  PHUT_MS,
} from '../khung-thoi-gian.js';
import { type KhachFixture, khachGia, taoDanhTinh } from '../people/customers.js';
import { boSinh, chonMot, idTinh, nguyen } from '../stable-id.js';

/**
 * Enquiries — lead "Inquire Now" (spec 2026-09-14 §5.1).
 *
 * ── Vì sao phải giống hệt thứ app ghi ra ──
 * DB không có CHECK nào cho bốn bảng enquiry, nhưng response của admin được validate
 * theo contract: MỘT dòng sai là cả trang `/enquiries` lỗi. Nên mỗi dòng mô phỏng
 * đúng hai form web đang gửi — form private trip (`private-trip.ts`) và form liên hệ
 * (`enquiry-form.ts`) — và không có trường nào mà form không gửi (`nationality`,
 * `budgetTier`).
 *
 * ── Vòng đời theo tuổi so với H ──
 * Lead ≤ 7 ngày phần lớn còn NEW; 7–30 ngày đang CONTACTED/QUOTED; cũ hơn đã chốt WON
 * hoặc LOST. Mỗi lần đổi trạng thái là một dòng `enquiry_status_events` nối liền từ
 * NEW; bước nào rơi từ H trở đi thì chuỗi dừng ở bước trước.
 *
 * ── Thứ KHÔNG nằm ở đây ──
 * `authorId`/`authorName` của ghi chú và `adminId` của sự kiện do `seed.ts` gắn bằng
 * admin thật; outbox không bao giờ được seed (worker gửi mail thật); không dòng nào ẩn
 * danh (retention 18 tháng, và dòng ẩn danh làm vỡ trang admin).
 */

export type TrangThaiEnquiry = 'NEW' | 'CONTACTED' | 'QUOTED' | 'WON' | 'LOST';

export interface EnquiryFixture {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  tourId: string | null;
  nationality: null;
  /** `YYYY-MM-DD` — cột `@db.Date`. */
  travelDate: string | null;
  groupSize: number | null;
  budgetTier: null;
  interests: string[];
  status: TrangThaiEnquiry;
  userId: string | null;
  createdAt: string;
  /** Mốc sự kiện trạng thái cuối, hoặc lúc tạo nếu chưa ai sờ tới. Ghi chú không đổi cột này. */
  updatedAt: string;
}

export interface EnquiryNoteFixture {
  id: string;
  enquiryId: string;
  body: string;
  createdAt: string;
}

export interface EnquiryStatusEventFixture {
  id: string;
  enquiryId: string;
  fromStatus: TrangThaiEnquiry;
  toStatus: TrangThaiEnquiry;
  createdAt: string;
}

export interface KetQuaEnquiry {
  enquiries: EnquiryFixture[];
  notes: EnquiryNoteFixture[];
  statusEvents: EnquiryStatusEventFixture[];
}

const TY_LE_PRIVATE_TRIP = 0.6;
const TY_LE_DANG_NHAP = 0.35;
const TY_LE_CO_DIEN_THOAI = 0.5;
const TOI_THIEU_NEW = 5;
/** Số enquiry của tháng (0 = tháng 1): tăng dần theo năm, site càng lúc càng được biết đến. */
const soTrongThang = (thang: number): number => 4 + thang;

const LOI_NHAN_PRIVATE: ReadonlyArray<(tenTour: string, soNguoi: number) => string> = [
  (t, n) =>
    `We are a group of ${n} and would love to do ${t} as a private trip. Could you send us a quote and let us know what changes for a private group?`,
  (t, n) =>
    `Is it possible to run ${t} privately for ${n} people? We are flexible on the exact dates and happy to take things at a slower pace.`,
  (t, n) =>
    `Hello! We saw ${t} on your site. There will be ${n} of us and we would prefer our own guide. What would that cost?`,
  (t, n) =>
    `Could ${t} be arranged as a private departure for ${n} travellers? One of us is vegetarian and we would like a later start in the mornings.`,
];

const LOI_NHAN_LIEN_HE = [
  'We are planning two weeks in Vietnam and cannot decide between the north and the centre. Could someone help us shape a route?',
  'Do you arrange tours for travellers with limited mobility? My father uses a walking stick and we want to plan carefully.',
  'We would like a food-focused trip with at least one cooking class. What would you recommend for about ten days?',
  'Is it too hot to travel in the south during the dry season? We are trying to pick the most comfortable month.',
  'Our family of five is looking for a mix of beaches and culture. Can you suggest something that is not too rushed for the kids?',
  'We are honeymooning in Vietnam and would love a couple of special evenings. What private experiences do you offer?',
] as const;

const VUNG = ['north', 'central', 'south'] as const;
const TEN_THANG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const PHAN_THANG = ['early', 'mid', 'late'] as const;

const GHI_CHU = [
  'Called the guest — they are comparing us with one other operator. Sent the sample itinerary.',
  'Guest prefers WhatsApp over email. Follow up in two days.',
  'Quote sent with the private-guide supplement itemised separately.',
  'Asked about child pricing; confirmed under-5s travel free on this route.',
  'Guest confirmed the dates are flexible by a week either side.',
  'Budget is tighter than the quote — offered the shared departure as an alternative.',
] as const;

/** Chuỗi trạng thái ĐÍCH theo tuổi của lead (ngày), trước khi bị cắt theo H. */
function loTrinhDich(tuoiNgay: number, rnd: () => number): TrangThaiEnquiry[] {
  const x = rnd();
  if (tuoiNgay <= 7) return x < 0.8 ? [] : ['CONTACTED'];
  if (tuoiNgay <= 30) return x < 0.15 ? [] : x < 0.6 ? ['CONTACTED'] : ['CONTACTED', 'QUOTED'];
  if (x < 0.3) return ['CONTACTED', 'QUOTED', 'WON'];
  if (x < 0.5) return ['CONTACTED', 'QUOTED', 'LOST'];
  if (x < 0.65) return ['CONTACTED', 'LOST'];
  if (x < 0.85) return ['CONTACTED', 'QUOTED'];
  return ['CONTACTED'];
}

/** Khoảng thời gian để đi TỚI trạng thái `toi` tính từ bước trước. */
function khoangToi(toi: TrangThaiEnquiry, rnd: () => number): number {
  if (toi === 'CONTACTED') return nguyen(rnd, 2, 30) * GIO_MS;
  if (toi === 'QUOTED') return nguyen(rnd, 24, 96) * GIO_MS;
  return nguyen(rnd, 72, 336) * GIO_MS;
}

/** Xoá tại chỗ mọi phần tử thoả điều kiện. */
function xoaNeu<T>(ds: T[], dieuKien: (x: T) => boolean): void {
  for (let i = ds.length - 1; i >= 0; i--) {
    const x = ds[i];
    if (x !== undefined && dieuKien(x)) ds.splice(i, 1);
  }
}

export function sinhEnquiry(homNay: Date, khach: KhachFixture[]): KetQuaEnquiry {
  const H = homNay.getTime();
  const tours = [...toursNorth, ...toursCentral, ...toursSouth].filter((t) => t.isPublished);
  // Khách vãng lai không được mang email của khách giả.
  const daDung = new Set(khach.map((k) => k.email.split('@')[0] ?? k.email));
  const kq: KetQuaEnquiry = { enquiries: [], notes: [], statusEvents: [] };
  let chiSoVangLai = 1000;

  for (let thang = 0; thang < 12; thang++) {
    const dauThang = Date.UTC(2026, thang, 1);
    const dauThangSau = Date.UTC(2026, thang + 1, 1);
    const den = Math.min(dauThangSau, H) - GIO_MS;
    if (den <= dauThang) break;
    // Tháng chứa H chỉ tính phần đã trôi qua.
    const so = Math.round(soTrongThang(thang) * ((den - dauThang) / (dauThangSau - dauThang)));

    for (let j = 0; j < so; j++) {
      const rnd = boSinh(`enquiry:${thang}:${j}`);
      const id = idTinh('enquiry', thang, j);
      const taoLuc = mocTrongKhoang(rnd, dauThang, den);

      // ── Người gửi ── có session thì app ghi `userId` và dùng tên, email của tài khoản.
      const daDangKy = khach.filter((k) => k.createdAt.getTime() <= taoLuc - GIO_MS);
      let ten: string;
      let email: string;
      let userId: string | null = null;
      let dienThoai: string | null;
      if (rnd() < TY_LE_DANG_NHAP && daDangKy.length > 0) {
        const nguoi = chonMot(rnd, daDangKy);
        ten = nguoi.name;
        email = nguoi.email;
        userId = nguoi.id;
        dienThoai = nguoi.phone;
      } else {
        const danhTinh = taoDanhTinh(chiSoVangLai++, daDung);
        ten = danhTinh.ten;
        email = `${danhTinh.phanEmail}@example.com`;
        dienThoai = `+${chonMot(rnd, danhTinh.maVung)}${nguyen(rnd, 100000000, 999999999)}`;
      }

      // ── Nội dung theo đúng form ──
      let tourId: string | null = null;
      let travelDate: string | null = null;
      let groupSize: number | null = null;
      let phone: string | null = null;
      let interests: string[] = [];
      let message: string;
      if (rnd() < TY_LE_PRIVATE_TRIP) {
        const tour = chonMot(rnd, tours);
        tourId = tour.id;
        groupSize = nguyen(rnd, 2, 4) + nguyen(rnd, 0, 3);
        travelDate = isoNgay(mocTrongKhoang(rnd, ngayUTC(taoLuc) + 14 * NGAY_MS, CUOI_KHUNG));
        phone = rnd() < TY_LE_CO_DIEN_THOAI ? dienThoai : null;
        message = chonMot(rnd, LOI_NHAN_PRIVATE)(tour.title, groupSize);
      } else {
        interests = rnd() < 0.5 ? [] : [chonMot(rnd, VUNG)];
        groupSize = rnd() < 0.6 ? nguyen(rnd, 1, 8) : null;
        message = chonMot(rnd, LOI_NHAN_LIEN_HE);
        if (rnd() < 0.4) {
          // Dòng "Preferred dates" y như form liên hệ nối vào — tháng mong muốn sau tháng gửi.
          const thangMuon = nguyen(rnd, new Date(taoLuc).getUTCMonth() + 1, 11);
          message = `${message}\n\nPreferred dates: ${chonMot(rnd, PHAN_THANG)} ${TEN_THANG[thangMuon] ?? 'December'}`;
        }
      }

      // ── Vòng đời ──
      let hienTai: TrangThaiEnquiry = 'NEW';
      let moc = taoLuc;
      const suKien: EnquiryStatusEventFixture[] = [];
      for (const [k, toi] of loTrinhDich((H - taoLuc) / NGAY_MS, rnd).entries()) {
        const luc = moc + khoangToi(toi, rnd);
        if (luc >= H - GIO_MS) break;
        suKien.push({
          id: idTinh('enquiry-event', id, k),
          enquiryId: id,
          fromStatus: hienTai,
          toStatus: toi,
          createdAt: isoGio(luc),
        });
        hienTai = toi;
        moc = luc;
      }
      kq.statusEvents.push(...suKien);

      // ── Ghi chú nội bộ ── chỉ khi lead đã có người sờ tới.
      const dauTien = suKien[0];
      if (dauTien) {
        const tu = Date.parse(dauTien.createdAt) + 5 * PHUT_MS;
        const denGhiChu = Math.min(moc + 2 * NGAY_MS, H - 30 * PHUT_MS);
        if (denGhiChu > tu) {
          const cacMoc = Array.from({ length: nguyen(rnd, 0, 3) }, () =>
            mocTrongKhoang(rnd, tu, denGhiChu),
          ).sort((a, b) => a - b);
          for (const [k, luc] of cacMoc.entries()) {
            kq.notes.push({
              id: idTinh('enquiry-note', id, k),
              enquiryId: id,
              body: chonMot(rnd, GHI_CHU),
              createdAt: isoGio(luc),
            });
          }
        }
      }

      kq.enquiries.push({
        id,
        name: ten,
        email,
        phone,
        message,
        tourId,
        nationality: null,
        travelDate,
        groupSize,
        budgetTier: null,
        interests,
        status: hienTai,
        userId,
        createdAt: isoGio(taoLuc),
        updatedAt: isoGio(moc),
      });
    }
  }

  baoDamThongKe(kq, H);
  return kq;
}

/**
 * Thẻ "Won 28d" đếm lượt chuyển sang WON trong 28 ngày, còn menu admin trỏ vào tab NEW.
 * Với một H cụ thể, tỉ lệ ngẫu nhiên có thể để trống cả hai, nên sàn phải là ràng buộc
 * cấu trúc (spec §5.1).
 */
function baoDamThongKe(kq: KetQuaEnquiry, H: number): void {
  const soSuKien = (id: string): number => kq.statusEvents.filter((s) => s.enquiryId === id).length;

  const coWon = kq.statusEvents.some(
    (s) => s.toStatus === 'WON' && Date.parse(s.createdAt) >= H - 28 * NGAY_MS,
  );
  if (!coWon) {
    const e = kq.enquiries
      .filter(
        (x) =>
          (x.status === 'QUOTED' || x.status === 'CONTACTED') &&
          Date.parse(x.updatedAt) <= H - 3 * NGAY_MS,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (e) {
      let luc = Math.max(Date.parse(e.updatedAt) + GIO_MS, H - 20 * NGAY_MS);
      if (e.status === 'CONTACTED') {
        kq.statusEvents.push({
          id: idTinh('enquiry-event', e.id, soSuKien(e.id)),
          enquiryId: e.id,
          fromStatus: 'CONTACTED',
          toStatus: 'QUOTED',
          createdAt: isoGio(luc),
        });
        luc += NGAY_MS;
      }
      kq.statusEvents.push({
        id: idTinh('enquiry-event', e.id, soSuKien(e.id)),
        enquiryId: e.id,
        fromStatus: 'QUOTED',
        toStatus: 'WON',
        createdAt: isoGio(luc),
      });
      e.status = 'WON';
      e.updatedAt = isoGio(luc);
    }
  }

  let soNew = kq.enquiries.filter((e) => e.status === 'NEW').length;
  const coTheLui = kq.enquiries
    .filter(
      (e) =>
        e.status === 'CONTACTED' &&
        soSuKien(e.id) === 1 &&
        Date.parse(e.createdAt) >= H - 30 * NGAY_MS,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const e of coTheLui) {
    if (soNew >= TOI_THIEU_NEW) break;
    // Lead quay về trạng thái chưa ai sờ tới: gỡ sự kiện và ghi chú của nó.
    xoaNeu(kq.statusEvents, (s) => s.enquiryId === e.id);
    xoaNeu(kq.notes, (n) => n.enquiryId === e.id);
    e.status = 'NEW';
    e.updatedAt = e.createdAt;
    soNew++;
  }
}

const ket = sinhEnquiry(HOM_NAY, khachGia);
export const enquiriesGia = ket.enquiries;
export const enquiryNotesGia = ket.notes;
export const enquiryStatusEventsGia = ket.statusEvents;
