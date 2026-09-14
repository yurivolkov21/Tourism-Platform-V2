/**
 * Khung thời gian của bộ dữ liệu seed — spec
 * `docs/specs/2026-09-14-seed-khung-2026-design.md` §3.
 *
 * Mọi dòng seed nằm trong năm 2026 theo lịch UTC, và mọi giao dịch (thanh toán,
 * huỷ, hoàn, review, enquiry, subscriber) có mốc trước H — mốc "hôm nay" của bộ
 * dữ liệu, tính bằng nửa đêm UTC.
 *
 * H đọc từ `SEED_HOM_NAY`; vắng thì dùng ngày GHIM chứ không dùng đồng hồ máy.
 * Id của chuyến, booking, review dẫn xuất từ ngày: hai ngày chạy khác nhau đẻ ra
 * hai bộ id khác nhau, và `createMany({ skipDuplicates })` không bắt được — DB
 * âm thầm mang hai lứa dữ liệu.
 */

export const NGAY_MS = 86_400_000;
export const GIO_MS = 3_600_000;
export const PHUT_MS = 60_000;

/** Nửa đêm UTC 01/01/2026 — không dòng seed nào được sớm hơn. */
export const DAU_KHUNG = Date.UTC(2026, 0, 1);

/** Nửa đêm UTC 31/12/2026 — ngày muộn nhất một chuyến được phép kết thúc. */
export const CUOI_KHUNG = Date.UTC(2026, 11, 31);

/** Dải hợp lệ của H: sớm hơn thì lịch sử quá mỏng, muộn hơn thì cửa sổ còn bán quá hẹp. */
export const MOC_SOM_NHAT = '2026-06-01';
export const MOC_MUON_NHAT = '2026-12-01';

/** Mốc ghim cho Docker và test. Prod bắt buộc truyền `SEED_HOM_NAY` (xem `kiemTraMocChoProd`). */
export const HOM_NAY_MAC_DINH = '2026-09-20';

/** Đọc `YYYY-MM-DD` thành nửa đêm UTC; ném lỗi nếu sai dạng, không có thật, hoặc ngoài dải. */
export function docMocHomNay(giaTri: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giaTri)) {
    throw new Error(`SEED_HOM_NAY phải có dạng YYYY-MM-DD, nhận "${giaTri}"`);
  }
  const moc = Date.parse(`${giaTri}T00:00:00.000Z`);
  // So ngược lại với chuỗi gốc: có engine cuộn "2026-02-31" sang tháng 3 thay vì trả NaN.
  if (Number.isNaN(moc) || new Date(moc).toISOString().slice(0, 10) !== giaTri) {
    throw new Error(`SEED_HOM_NAY không phải một ngày có thật: "${giaTri}"`);
  }
  if (giaTri < MOC_SOM_NHAT || giaTri > MOC_MUON_NHAT) {
    throw new Error(
      `SEED_HOM_NAY phải nằm trong [${MOC_SOM_NHAT}, ${MOC_MUON_NHAT}], nhận "${giaTri}"`,
    );
  }
  return new Date(moc);
}

/**
 * H của lượt chạy. Chuỗi rỗng coi như vắng: file env và nền tảng deploy gửi `KEY=`
 * thành chuỗi rỗng chứ không phải `undefined` (CLAUDE.md, gotcha của `parseEnv`).
 */
export const HOM_NAY: Date = docMocHomNay(process.env.SEED_HOM_NAY?.trim() || HOM_NAY_MAC_DINH);

/** Cắt một mốc về nửa đêm UTC của chính ngày đó. */
export function ngayUTC(t: number): number {
  return Math.floor(t / NGAY_MS) * NGAY_MS;
}

/** `YYYY-MM-DD` theo UTC. */
export const isoNgay = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** ISO đầy đủ theo UTC. */
export const isoGio = (t: number): string => new Date(t).toISOString();

/** Giờ trong ngày 08:00–22:00 giờ Việt Nam, tức 01:00–15:00 UTC, tính bằng ms từ nửa đêm UTC. */
export function gioTrongNgay(rnd: () => number): number {
  return GIO_MS + Math.floor(rnd() * 14 * GIO_MS);
}

/**
 * Một mốc có giờ ban ngày trong [tu, den]: chọn NGÀY đều trong khoảng rồi gắn giờ
 * 08–22h giờ Việt Nam; hai ngày biên bị kẹp để mốc không vượt ra ngoài khoảng.
 */
export function mocTrongKhoang(rnd: () => number, tu: number, den: number): number {
  if (den < tu) throw new Error(`mocTrongKhoang: khoảng rỗng [${isoGio(tu)}, ${isoGio(den)}]`);
  const ngayDau = ngayUTC(tu);
  const soNgay = Math.round((ngayUTC(den) - ngayDau) / NGAY_MS);
  const ngay = ngayDau + Math.floor(rnd() * (soNgay + 1)) * NGAY_MS;
  return Math.min(den, Math.max(tu, ngay + gioTrongNgay(rnd)));
}

export type KetQuaKiemTraMoc =
  | { ketQua: 'ok' }
  | { ketQua: 'canh-bao'; thongDiep: string }
  | { ketQua: 'tu-choi'; thongDiep: string };

/**
 * Chốt chặn mốc khi đích là Supabase (spec §3). Tách thành hàm thuần để test đủ ba
 * kết cục; `seed.ts` gọi nó ngay sau chốt `--toi-biet-day-la-production`.
 */
export function kiemTraMocChoProd(input: {
  laProd: boolean;
  coEnv: boolean;
  homNay: Date;
  homNayThat: Date;
}): KetQuaKiemTraMoc {
  if (!input.laProd) return { ketQua: 'ok' };
  if (!input.coEnv) {
    return {
      ketQua: 'tu-choi',
      thongDiep:
        'Đích là Supabase production nhưng thiếu SEED_HOM_NAY — ngày ghim mặc định chỉ dành cho Docker và test.',
    };
  }
  const moc = isoNgay(input.homNay.getTime());
  const lech = Math.round((input.homNay.getTime() - ngayUTC(input.homNayThat.getTime())) / NGAY_MS);
  if (lech > 1) {
    return {
      ketQua: 'tu-choi',
      thongDiep: `SEED_HOM_NAY ${moc} nằm sau hôm nay ${lech} ngày — prod sẽ mang giao dịch ở tương lai.`,
    };
  }
  if (lech < -3) {
    return {
      ketQua: 'canh-bao',
      thongDiep: `SEED_HOM_NAY ${moc} cũ hơn hôm nay ${-lech} ngày — các cửa sổ 7/28 ngày của dashboard sẽ mỏng.`,
    };
  }
  return { ketQua: 'ok' };
}
