import { createHash } from 'node:crypto';

/**
 * UUID v5 dẫn xuất từ một chuỗi khoá — id TĨNH mà không phải gõ tay.
 *
 * Vì sao cần: seed nạp phần lớn bảng bằng `createMany({ skipDuplicates })`, và
 * phép bỏ qua ấy chỉ có tác dụng khi có một khoá để đụng. Để Prisma tự sinh id
 * là mỗi lượt seed thêm một tập dòng mới trên DB dùng chung dev/prod.
 *
 * Bản gốc của thuật toán này nằm trong `catalog/tour-costs.ts` (hàm `stableId`,
 * 05/09) và CỐ Ý không được đụng tới: đổi nó là đổi 131 id giá vốn đã sinh ra.
 * Đây là bản tách ra dùng chung cho các fixture MỚI, cùng công thức, khác tiền tố.
 *
 * Tiền tố (`khong_gian`) là thứ ngăn hai loại bản ghi khác nhau đụng id nhau khi
 * tình cờ mang cùng một khoá — ví dụ `departure:<tourId>:2026-03-04` và
 * `booking:<tourId>:2026-03-04`.
 */
export function idTinh(khongGian: string, ...phan: (string | number)[]): string {
  const hex = createHash('sha1')
    .update(`${khongGian}:${phan.join(':')}`)
    .digest('hex');
  const b = hex.slice(0, 32).split('');
  // Đặt version 5 và variant RFC 4122 — không có hai dòng này thì chuỗi hex vẫn
  // "trông như" uuid nhưng Postgres kiểu `uuid` nhận, còn thư viện kiểm version
  // thì không. Rẻ, nên làm đúng.
  b[12] = '5';
  b[16] = ['8', '9', 'a', 'b'][Number.parseInt(b[16] ?? '0', 16) & 0b11] ?? '8';
  const h = b.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Bộ sinh số giả-ngẫu-nhiên TẤT ĐỊNH (mulberry32), gieo từ một chuỗi.
 *
 * `Math.random()` bị cấm trong fixture: seed phải cho ra CÙNG một tập dòng ở
 * mọi lượt chạy, nếu không `skipDuplicates` mất tác dụng và mỗi lượt seed lại
 * đẻ thêm một tập booking mới. Nhưng dữ liệu trông thật thì cần biến thiên —
 * nên dùng ngẫu-nhiên-có-hạt thay vì ngẫu nhiên thật.
 */
export function boSinh(hat: string): () => number {
  let a = Number.parseInt(createHash('sha1').update(hat).digest('hex').slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Số nguyên trong [min, max] từ một bộ sinh tất định. */
export function nguyen(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** Chọn một phần tử theo trọng số — dùng cho phân bố sao hình chữ J. */
export function chonTheoTrongSo<T>(rnd: () => number, cap: [T, number][]): T {
  const tong = cap.reduce((s, [, w]) => s + w, 0);
  let moc = rnd() * tong;
  for (const [gia_tri, w] of cap) {
    moc -= w;
    if (moc <= 0) return gia_tri;
  }
  return cap[cap.length - 1]?.[0] as T;
}
