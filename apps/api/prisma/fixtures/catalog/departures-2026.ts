import { boSinh, idTinh, nguyen } from '../stable-id.js';
// Nhập thẳng ba file miền chứ không qua `index.js`: index nhập lại chính file
// này để gộp `tourDepartures`, đi vòng qua đó là vòng lặp nhập khẩu.
import { tours as toursCentral } from './tours-central.js';
import { tours as toursNorth } from './tours-north.js';
import { tours as toursSouth } from './tours-south.js';
import type { TourDepartureFixture } from './types.js';

/**
 * Lịch khởi hành — sinh từ một mô hình, không gõ tay.
 *
 * ── Vì sao thay 134 ngày viết cứng cũ ──
 * Bộ cũ là 134 ngày rời rạc gõ tay, không sinh từ luật nào, nên không ai canh
 * được độ phủ. Đo ngày 10/09/2026 lộ ra ba phân rã:
 *   · 40/134 chuyến đã qua ngày mà `status` vẫn `OPEN`;
 *   · mỗi tour chỉ có ĐÚNG MỘT đợt giảm giá, đều rơi nửa đầu năm, nên tới
 *     11/11 (khoảng bảo vệ) chỉ còn 3/29 tour hiện giá giảm;
 *   · tới 15/12/2026 thì 17/29 tour hết sạch chuyến bán được.
 *
 * ── HAI cửa sổ, không phải một ──
 * Bản nháp đầu rải đều 5 chuyến/tour khắp 12 tháng 2026 và làm mục thứ ba TỆ
 * HƠN bộ cũ: tới 15/12 chỉ còn 4/29 tour bán được, vì phần tương lai chỉ nhận
 * ~1,7 chuyến mỗi tour. Một trang đặt tour thật luôn có tồn kho chạy TRƯỚC mặt,
 * nên lịch tách làm hai:
 *
 *   LỊCH SỬ   01/01/2026 → 09/09/2026   5 chuyến/tour, tất cả đã qua
 *   BÁN ĐƯỢC  10/09/2026 → 31/03/2027   4 chuyến/tour, tất cả còn mở
 *
 * Cửa sổ bán được cố ý tràn sang quý 1/2027: nó là TỒN KHO, không phải lịch sử.
 * Cắt nó ở 31/12 là dựng lại đúng cái vực mà mô hình này đang vá.
 *
 * ── Mốc thời gian ──
 * `HOM_NAY` là mốc CỐ ĐỊNH, không phải `new Date()`: fixture phải cho ra cùng
 * một tập dòng ở mọi lượt chạy, nếu không `skipDuplicates` mất tác dụng.
 *
 * ── Thứ KHÔNG nằm ở đây ──
 * `seatsBooked` để 0 và `fixedCostAmount` để null. Cả hai là số DẪN XUẤT: ghế
 * đã đặt phải đếm từ booking thật (bộ cũ khai 438 ghế mà chỉ 2 booking đứng
 * sau — đếm hai lần), còn giá vốn cố định do bước 8 của seed suy từ các dòng
 * `PER_DEPARTURE`.
 */

/** Mốc "hôm nay" của bộ dữ liệu — cố định để seed tất định. */
export const HOM_NAY = new Date('2026-09-10T00:00:00.000Z');

/**
 * Tháng của hai cửa sổ, khai TƯỜNG MINH thay vì chia đều một khoảng.
 *
 * Bản trước chia cửa sổ thành N ô rồi bốc ngày trong ô. Với chỉ 29 mẫu mỗi ô,
 * phân bố theo NGÀY lồi lõm, và tháng 7 rơi xuống 9 chuyến — dưới sàn ≥10 mà
 * user đặt ra. Gán tháng tường minh rồi mới bốc ngày trong tháng thì sàn ấy
 * thành ràng buộc cấu trúc chứ không phải điều cầu may.
 */
const THANG_LICH_SU: [number, number][] = [
  [2026, 0],
  [2026, 1],
  [2026, 2],
  [2026, 3],
  [2026, 4],
  [2026, 5],
  [2026, 6],
  [2026, 7],
];
const THANG_BAN_DUOC: [number, number][] = [
  [2026, 8],
  [2026, 9],
  [2026, 10],
  [2026, 11],
  [2027, 0],
  [2027, 1],
  [2027, 2],
];

const CHUYEN_LICH_SU = 5;
const CHUYEN_BAN_DUOC = 4;

/** Tỉ lệ chuyến ĐÃ QUA bị công ty huỷ (phần còn lại là đã chạy xong). */
const TY_LE_HUY = 0.13;

/**
 * Tỉ lệ tour có khuyến mãi đang chạy.
 *
 * Bản nháp đầu gán khuyến mãi cho chuyến muộn nhất của MỌI tour, và cho ra
 * 29/29 tour bán được đều đang giảm giá — không trang nào như vậy, nó đọc ra
 * như một đợt xả hàng chứ không phải giá bình thường. Nay chỉ một phần tour có
 * đợt giảm, và tour nào thì do hạt tất định quyết chứ không theo thứ tự roster.
 */
const TY_LE_TOUR_CO_KM = 0.45;

const NGAY = 86400000;
const ISO = (d: number | Date): string => new Date(d).toISOString().slice(0, 10);
const tien = (n: number): string => n.toFixed(2);

/**
 * Bốc một ngày trong tháng. 1..27 để mọi tháng đều hợp lệ và `endDate` của tour
 * 12 ngày không tràn sang tháng sau một cách khó đọc.
 *
 * Bước nhảy nguyên tố cùng nhau với số tháng (3 với 8, 2 với 7) làm các chuyến
 * của MỘT tour rơi vào các tháng KHÁC NHAU, còn phép cộng `i` làm lịch tour kế
 * tiếp lệch đi một tháng — nên tổng theo tháng của cả 29 tour vẫn phẳng.
 */
function ngayTrongThang(nam: number, thang: number, rnd: () => number, somNhat = 1): number {
  return Date.UTC(nam, thang, nguyen(rnd, somNhat, 27));
}

function sinh(): TourDepartureFixture[] {
  const ra: TourDepartureFixture[] = [];
  const tours = [...toursNorth, ...toursCentral, ...toursSouth];

  for (const tour of tours) {
    const gia = Number(tour.basePrice);
    const moc: { batDau: number; banDuoc: boolean }[] = [];

    const i = tours.indexOf(tour);
    for (let j = 0; j < CHUYEN_LICH_SU; j++) {
      const rnd = boSinh(`chuyen-ls:${tour.slug}:${j}`);
      const [nam, thang] = THANG_LICH_SU[(i + j * 3) % THANG_LICH_SU.length] as [number, number];
      moc.push({ batDau: ngayTrongThang(nam, thang, rnd), banDuoc: false });
    }
    for (let j = 0; j < CHUYEN_BAN_DUOC; j++) {
      const rnd = boSinh(`chuyen-bd:${tour.slug}:${j}`);
      const [nam, thang] = THANG_BAN_DUOC[(i + j * 2) % THANG_BAN_DUOC.length] as [number, number];
      // Tháng ĐẦU của cửa sổ bán được là chính tháng chứa `HOM_NAY`, nên ngày
      // phải chặn dưới: bốc 1..27 như các tháng khác thì chuyến rơi vào 1–9/9
      // và ra một dòng "quá khứ mà vẫn OPEN" — đúng lỗi mà mô hình này đang vá.
      const somNhat = nam === 2026 && thang === 8 ? 12 : 1;
      moc.push({ batDau: ngayTrongThang(nam, thang, rnd, somNhat), banDuoc: true });
    }
    moc.sort((a, b) => a.batDau - b.batDau);

    // ── Chọn chuyến khuyến mãi ──
    const rndKM = boSinh(`km:${tour.slug}`);
    const khuyenMai = new Set<number>();
    if (rndKM() < TY_LE_TOUR_CO_KM) {
      // Đặt vào một chuyến CÒN BÁN ĐƯỢC, ưu tiên chuyến nằm sau mốc bảo vệ đồ
      // án để chip giảm giá còn sống đúng lúc cần.
      const ungVien = moc.filter((m) => m.banDuoc);
      const sauBaoVe = ungVien.filter((m) => m.batDau >= Date.UTC(2026, 10, 15));
      const chon = (sauBaoVe.length > 0 ? sauBaoVe : ungVien)[
        nguyen(rndKM, 0, (sauBaoVe.length > 0 ? sauBaoVe : ungVien).length - 1)
      ];
      if (chon) khuyenMai.add(chon.batDau);
    }
    // Một đợt giảm trong QUÁ KHỨ cho ~1/3 tour — để báo cáo doanh thu có cả
    // chuyến bán giá giảm lẫn chuyến bán giá gốc mà so.
    if (rndKM() < 0.33) {
      const daQua = moc.filter((m) => !m.banDuoc);
      const chon = daQua[nguyen(rndKM, 0, daQua.length - 1)];
      if (chon) khuyenMai.add(chon.batDau);
    }

    for (const m of moc) {
      const rnd = boSinh(`chuyen-tt:${tour.slug}:${ISO(m.batDau)}`);
      const ketThuc = m.batDau + (tour.durationDays - 1) * NGAY;
      const coKM = khuyenMai.has(m.batDau);
      // Giảm 10–20%: đủ để chip "% OFF" đáng tin, không tới mức trông như xả hàng.
      const mucGiam = coKM ? nguyen(rnd, 10, 20) / 100 : 0;

      ra.push({
        id: idTinh('departure', tour.id, ISO(m.batDau)),
        tourId: tour.id,
        startDate: ISO(m.batDau),
        endDate: ISO(ketThuc),
        priceOverride: coKM ? tien(Math.round(gia * (1 - mucGiam) * 100) / 100) : null,
        // Giá gạch ngang LUÔN là giá gốc của tour — và chỉ đặt khi có giảm giá
        // thật, để không bao giờ tồn tại dòng `compareAtPrice <= priceOverride`.
        compareAtPrice: coKM ? tien(gia) : null,
        // Bằng đúng sức chứa tour. Bộ cũ có chuyến `seatsTotal 8` trên tour
        // `maxGroupSize 6` → site in "8 of 6 seats left".
        seatsTotal: tour.maxGroupSize,
        seatsBooked: 0,
        status: m.banDuoc ? 'OPEN' : rnd() < TY_LE_HUY ? 'CANCELLED' : 'CLOSED',
        // Mở bán trước ngày đi 4–8 tháng, không bao giờ sớm hơn lúc dự án có
        // dữ liệu (09/2025).
        createdAt: new Date(
          Math.max(Date.UTC(2025, 8, 1), m.batDau - nguyen(rnd, 120, 240) * NGAY),
        ).toISOString(),
        updatedAt: HOM_NAY.toISOString(),
      });
    }
  }

  return ra.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}

export const tourDepartures: TourDepartureFixture[] = sinh();
