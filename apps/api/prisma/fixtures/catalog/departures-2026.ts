import {
  CUOI_KHUNG,
  DAU_KHUNG,
  gioTrongNgay,
  HOM_NAY,
  isoGio,
  isoNgay,
  NGAY_MS,
  ngayUTC,
} from '../khung-thoi-gian.js';
import { boSinh, idTinh, nguyen } from '../stable-id.js';
// Nhập thẳng ba file miền chứ không qua `index.js`: index nhập lại chính file
// này để gộp `tourDepartures`, đi vòng qua đó là vòng lặp nhập khẩu.
import { tours as toursCentral } from './tours-central.js';
import { tours as toursNorth } from './tours-north.js';
import { tours as toursSouth } from './tours-south.js';
import type { TourDepartureFixture } from './types.js';

/**
 * Lịch khởi hành — sinh từ mô hình theo mốc H (spec 2026-09-14 §4.2).
 *
 * ── Hai cửa sổ, cả hai nằm trọn năm 2026 ──
 *   LỊCH SỬ   08/01 → kết thúc trước H ít nhất 2 ngày   CLOSED ~87% · CANCELLED ~13%
 *   CÒN BÁN   H + 2 ngày → kết thúc muộn nhất 31/12       OPEN, 4 chuyến mỗi tour
 *
 * Bản 10/09 cho cửa sổ còn bán tràn sang quý 1/2027 và dùng danh sách tháng viết
 * cứng cho đúng một mốc. User chốt dữ liệu chỉ trong năm 2026, và mốc H nay đổi
 * được qua `SEED_HOM_NAY`, nên cả hai cửa sổ tính từ H.
 *
 * ── Rải đều theo khe ──
 * Mỗi tour chia cửa sổ thành N khe bằng nhau, mỗi khe một chuyến; vị trí trong khe
 * lệch theo `pha` riêng của tour (bội số tỉ lệ vàng) nên các tour không dồn cùng
 * một ngày và tổng số chuyến theo tháng phẳng.
 *
 * ── Thứ KHÔNG nằm ở đây ──
 * `seatsBooked` để 0 và `fixedCostAmount` để null: cả hai là số DẪN XUẤT, seed
 * tính lại từ booking thật và từ các dòng giá vốn `PER_DEPARTURE`.
 */

/** Chuyến lịch sử sớm nhất khởi hành từ 08/01 — tuần đầu năm dành cho khách đặt chỗ. */
const BAT_DAU_LICH_SU = Date.UTC(2026, 0, 8);
/** Số chuyến lịch sử mỗi tour trên mỗi tháng lịch sử. */
const CHUYEN_MOI_THANG = 0.6;
const SAN_CHUYEN_LICH_SU = 3;
const CHUYEN_BAN_DUOC = 4;
const NGAY_MOI_THANG = 30.44;
/** Tỉ lệ chuyến LỊCH SỬ bị công ty huỷ. */
const TY_LE_HUY = 0.13;
/** Tỉ lệ tour có một đợt giảm giá đang chạy trên chuyến còn bán. */
const TY_LE_TOUR_CO_KM = 0.45;
/** Tỉ lệ tour có một đợt giảm giá trong lịch sử, để báo cáo có cả giá giảm lẫn giá gốc. */
const TY_LE_KM_LICH_SU = 0.33;
/** Mốc bảo vệ đồ án — ưu tiên đặt khuyến mãi còn bán sau mốc này để chip giảm giá còn sống. */
const MOC_BAO_VE = Date.UTC(2026, 10, 15);
/** Độ lệch ngẫu nhiên tối đa trong một khe, tính theo phần của khe. */
const LECH_TRONG_KHE = 0.35;
const TI_LE_VANG = 0.6180339887498949;

const tien = (n: number): string => n.toFixed(2);

/** Rải `n` ngày khởi hành (nửa đêm UTC) vào [tu, den]: mỗi chuyến một khe bằng nhau. */
function raiDeu(tu: number, den: number, n: number, pha: number, rnd: () => number): number[] {
  const doDai = den - tu;
  const ra: number[] = [];
  for (let k = 0; k < n; k++) {
    const viTri = (pha + LECH_TRONG_KHE * rnd()) % 1;
    ra.push(ngayUTC(tu + ((k + viTri) / n) * doDai));
  }
  return ra;
}

export function sinhLich(homNay: Date): TourDepartureFixture[] {
  const H = homNay.getTime();
  const ra: TourDepartureFixture[] = [];
  const tours = [...toursNorth, ...toursCentral, ...toursSouth];

  tours.forEach((tour, i) => {
    const gia = Number(tour.basePrice);
    const keoDai = (tour.durationDays - 1) * NGAY_MS;
    const pha = (i * TI_LE_VANG) % 1;

    // Lịch sử: khởi hành sao cho ngày kết thúc ≤ H − 2 ngày.
    const lsDen = H - 2 * NGAY_MS - keoDai;
    const soThang = (lsDen - BAT_DAU_LICH_SU) / (NGAY_MOI_THANG * NGAY_MS);
    const soLichSu = Math.max(SAN_CHUYEN_LICH_SU, Math.round(CHUYEN_MOI_THANG * soThang));
    // Còn bán: khởi hành từ H + 2 ngày, kết thúc chậm nhất 31/12.
    const bdTu = H + 2 * NGAY_MS;
    const bdDen = CUOI_KHUNG - keoDai;

    const moc = [
      ...raiDeu(BAT_DAU_LICH_SU, lsDen, soLichSu, pha, boSinh(`lich-ls:${tour.slug}`)).map(
        (batDau) => ({ batDau, banDuoc: false }),
      ),
      ...raiDeu(bdTu, bdDen, CHUYEN_BAN_DUOC, pha, boSinh(`lich-bd:${tour.slug}`)).map(
        (batDau) => ({ batDau, banDuoc: true }),
      ),
    ];

    // ── Chọn chuyến khuyến mãi ──
    const rndKM = boSinh(`km:${tour.slug}`);
    const khuyenMai = new Set<number>();
    if (rndKM() < TY_LE_TOUR_CO_KM) {
      const ungVien = moc.filter((m) => m.banDuoc);
      const sauBaoVe = ungVien.filter((m) => m.batDau >= MOC_BAO_VE);
      const nguon = sauBaoVe.length > 0 ? sauBaoVe : ungVien;
      const chon = nguon[nguyen(rndKM, 0, nguon.length - 1)];
      if (chon) khuyenMai.add(chon.batDau);
    }
    if (rndKM() < TY_LE_KM_LICH_SU) {
      const daQua = moc.filter((m) => !m.banDuoc);
      const chon = daQua[nguyen(rndKM, 0, daQua.length - 1)];
      if (chon) khuyenMai.add(chon.batDau);
    }

    for (const m of moc) {
      const rnd = boSinh(`chuyen-tt:${tour.slug}:${isoNgay(m.batDau)}`);
      const coKM = khuyenMai.has(m.batDau);
      // Giảm 10–20%: đủ để chip "% OFF" đáng tin, không tới mức trông như xả hàng.
      const mucGiam = coKM ? nguyen(rnd, 10, 20) / 100 : 0;
      const status = m.banDuoc ? 'OPEN' : rnd() < TY_LE_HUY ? 'CANCELLED' : 'CLOSED';
      // Mở bán trước ngày đi 4–8 tháng, kẹp vào [01/01, H − 1 ngày] rồi gắn giờ trong
      // ngày — nên luôn trước H và trước ngày khởi hành.
      const moBan =
        Math.min(
          H - NGAY_MS,
          Math.max(DAU_KHUNG, ngayUTC(m.batDau - nguyen(rnd, 120, 240) * NGAY_MS)),
        ) + gioTrongNgay(rnd);

      ra.push({
        id: idTinh('departure', tour.id, isoNgay(m.batDau)),
        tourId: tour.id,
        startDate: isoNgay(m.batDau),
        endDate: isoNgay(m.batDau + keoDai),
        priceOverride: coKM ? tien(Math.round(gia * (1 - mucGiam) * 100) / 100) : null,
        // Giá gạch ngang LUÔN là giá gốc của tour, và chỉ đặt khi có giảm giá thật.
        compareAtPrice: coKM ? tien(gia) : null,
        // Bằng đúng sức chứa tour — bộ cũ từng có "8 of 6 seats left".
        seatsTotal: tour.maxGroupSize,
        seatsBooked: 0,
        status,
        createdAt: isoGio(moBan),
        updatedAt: isoGio(moBan),
      });
    }
  });

  return ra.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}

export const tourDepartures: TourDepartureFixture[] = sinhLich(HOM_NAY);
