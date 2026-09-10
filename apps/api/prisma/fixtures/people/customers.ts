import { boSinh, idTinh, nguyen } from '../stable-id.js';

/**
 * 40 khách hàng GIẢ cho đợt làm mới dữ liệu 10/09/2026.
 *
 * ── Vì sao có file này ──
 * Đợt dọn 10/09 xoá sạch 63 user thật/thử nghiệm trên prod, giữ đúng một admin.
 * Toàn bộ tầng vận hành seed lại (≈400 booking, ≈116 review) cần người đứng tên:
 * booking có FK `user_id` RESTRICT, và review `VERIFIED` bị CHECK
 * `reviews_source_shape` bắt buộc phải có `user_id` + `booking_id`.
 *
 * ── Vì sao email dùng `@example.com` ──
 * RFC 2606 giữ riêng tên miền này để làm ví dụ; nó KHÔNG BAO GIỜ nhận được thư.
 * Đó chính là điều mình muốn: nếu sau này một luồng nào đó lỡ gửi mail cho khách
 * giả, thư sẽ không tới hộp của người thật, và cũng không tạo bounce về một tên
 * miền đang dùng thật (bounce làm hỏng uy tín gửi của `nexora-travel.agency`).
 *
 * ── Mật khẩu ──
 * KHÔNG nằm ở đây và KHÔNG nằm trong repo dưới dạng hash. Repo này public. Seed
 * đọc `SEED_CUSTOMER_PASSWORD` rồi băm bằng CHÍNH hàm của Better Auth
 * (`auth.$context.password.hash`) — băm bằng bcrypt tự chọn thì hash sai định
 * dạng và cả 40 tài khoản không đăng nhập được, mà không có lỗi nào báo ra.
 *
 * ── Vì sao id tất định ──
 * `createMany({ skipDuplicates })` chỉ bỏ qua được khi có khoá để đụng. Id sinh
 * từ email nên chạy seed lần hai ghi đè đúng dòng cũ thay vì đẻ thêm 40 người.
 */
export interface KhachFixture {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: Date;
}

/**
 * Tên lấy theo thị trường khách quốc tế tới Việt Nam — Tây Âu, Bắc Mỹ, Úc, Đông
 * Á. Cố ý KHÔNG dùng tên Việt: đây là khách inbound, và một danh sách toàn tên
 * Việt sẽ trông sai ngay với người chấm.
 */
const TEN = [
  'Emma Lindqvist',
  'James Whitfield',
  'Sofia Marchetti',
  'Daniel Okafor',
  'Hannah Bergström',
  'Thomas Dubois',
  'Aisha Rahman',
  'Lucas Moreau',
  'Chloe Bennett',
  'Mateo Alvarez',
  'Freya Nilsen',
  'Oliver Grant',
  'Yuki Tanaka',
  'Isabella Rossi',
  'Noah Vermeulen',
  'Priya Deshmukh',
  'Ethan Caldwell',
  'Marta Kowalski',
  'Liam O’Sullivan',
  'Nora Hansen',
  'Rafael Costa',
  'Amelia Clarke',
  'Jonas Weber',
  'Mei Lin Chan',
  'Sebastian Novak',
  'Grace Thornton',
  'Andrei Petrov',
  'Laura Jimenez',
  'Felix Andersson',
  'Zara Mbeki',
  'Henry Ashworth',
  'Camille Laurent',
  'Dylan Roberts',
  'Ingrid Solberg',
  'Marcus Feldman',
  'Sarah Whitaker',
  'Tomas Horak',
  'Elena Vasquez',
  'Ben Harrington',
  'Anya Kuznetsova',
];

/** `Emma Lindqvist` → `emma.lindqvist@example.com` (bỏ dấu, bỏ nháy). */
function emailTu(ten: string): string {
  const goc = ten
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’']/g, '')
    .toLowerCase()
    .split(/\s+/)
    .join('.');
  return `${goc}@example.com`;
}

/**
 * Mã vùng THẬT, khớp với thị trường của bộ tên ở trên. Bản nháp đầu sinh mã
 * ngẫu nhiên trong [31,81] và cho ra `+68…` — không phải quốc gia nào cả. Một
 * số điện thoại bịa không làm hỏng gì về mặt kỹ thuật, nhưng nó là thứ người
 * chấm liếc qua là thấy.
 */
const MA_VUNG = [44, 33, 46, 49, 61, 1, 39, 81, 31, 34, 351, 48, 353, 47, 420, 27, 91, 65];

/**
 * `createdAt`: **24 khách có mặt từ 09–12/2025**, 16 khách còn lại rải đều
 * 01–08/2026.
 *
 * Bản nháp đầu rải đều cả 40 người từ 10/2025 tới 08/2026 và chỉ có 11 người
 * tồn tại trước 01/2026 — trong khi booking bắt đầu ngay từ tháng 1. Khách
 * không thể đặt chuyến trước ngày họ có tài khoản, nên 30 booking tháng 1 sẽ
 * phải dồn vào 11 người, mỗi người gần 3 chuyến trong một tháng. Dồn phần lớn
 * khách về trước 2026 giữ cho tháng đầu năm có đủ người đặt, mà vẫn còn một
 * dòng khách mới chảy suốt năm cho biểu đồ dashboard.
 *
 * Bộ sinh booking PHẢI tôn trọng `paidAt >= khach.createdAt`.
 */
const SO_KHACH_CU = 24;
const CU_DAU = Date.UTC(2025, 8, 1);
const CU_CUOI = Date.UTC(2025, 11, 28);
const MOI_DAU = Date.UTC(2026, 0, 5);
const MOI_CUOI = Date.UTC(2026, 7, 31);

export const khachGia: KhachFixture[] = TEN.map((ten, i) => {
  const rnd = boSinh(`khach:${ten}`);
  const email = emailTu(ten);
  const cu = i < SO_KHACH_CU;
  const buoc = cu
    ? CU_DAU + Math.floor((CU_CUOI - CU_DAU) * ((i + 0.5) / SO_KHACH_CU))
    : MOI_DAU +
      Math.floor((MOI_CUOI - MOI_DAU) * ((i - SO_KHACH_CU + 0.5) / (TEN.length - SO_KHACH_CU)));
  return {
    id: idTinh('seed-customer', email),
    email,
    name: ten,
    // ~60% có số điện thoại: hồ sơ thật cũng không ai điền đủ, và màn admin cần
    // cả hai nhánh để lộ ra chỗ nào chưa xử lý giá trị rỗng.
    phone:
      rnd() < 0.6
        ? `+${MA_VUNG[nguyen(rnd, 0, MA_VUNG.length - 1)]}${nguyen(rnd, 100000000, 999999999)}`
        : null,
    createdAt: new Date(buoc),
  };
});
