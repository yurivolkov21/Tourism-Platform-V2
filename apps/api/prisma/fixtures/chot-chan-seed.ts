/**
 * Chốt chặn của `seed.ts`, viết thành hàm thuần để test được mà không cần DB (review cuối nhánh
 * 14/09/2026). Hai chốt ĐỌC DB (`kiemTraAdminChoProd`, `kiemTraTheHeLich`) chạy ở đầu `main()`,
 * TRƯỚC mọi lệnh ghi; chốt mật khẩu (`kiemTraMatKhauKhachChoProd`) chạy trước cả khi Prisma kết nối.
 */

export interface KetQuaChotChan {
  ketQua: 'ok' | 'tu-choi';
  thongDiep: string;
}

/**
 * Mật khẩu chung mặc định của khách giả — CHỈ cho Docker. Chuỗi này đã lộ trên GitHub (nhánh remote,
 * từ 10/09/2026) nên prod không bao giờ được dùng nó.
 */
export const MAT_KHAU_KHACH_MAC_DINH = 'Nexora!Demo2026';

/**
 * Prod phải dùng mật khẩu khách giả RIÊNG: `db:seed` chỉ tự đọc `.env.local`, nên quên export
 * `SEED_CUSTOMER_PASSWORD` từ `.env.production` là seed lặng lẽ rơi về mặc định công khai — ai cũng
 * đăng nhập được 120 khách giả trên site sống. So sánh sau `trim()`, đúng như `seed.ts` băm mật khẩu.
 *
 * Thông điệp không in mật khẩu nào: log của lượt prod có thể bị chép vào CHANGELOG.
 */
export function kiemTraMatKhauKhachChoProd(input: {
  laProd: boolean;
  matKhau: string;
}): KetQuaChotChan {
  if (!input.laProd) {
    return { ketQua: 'ok', thongDiep: 'Không phải prod — trống thì dùng mật khẩu mặc định.' };
  }
  const matKhau = input.matKhau.trim();
  if (matKhau !== '' && matKhau !== MAT_KHAU_KHACH_MAC_DINH) {
    return { ketQua: 'ok', thongDiep: 'Prod dùng mật khẩu khách giả riêng.' };
  }
  return {
    ketQua: 'tu-choi',
    thongDiep:
      `SEED_CUSTOMER_PASSWORD ${matKhau === '' ? 'trống' : 'trùng mật khẩu mặc định công khai'} — prod phải ` +
      'dùng mật khẩu riêng, chỉ đặt trong .env.production (gitignored): ' +
      `export SEED_CUSTOMER_PASSWORD="$(grep '^SEED_CUSTOMER_PASSWORD=' .env.production | cut -d= -f2-)"`,
  };
}

/**
 * Prod phải có ĐÚNG MỘT admin, và seed chỉ được trỏ vào chính admin đó — không bao giờ tạo thêm
 * admin. User chốt 14/09/2026 chỉ giữ một tài khoản admin. `db:seed` đọc `ADMIN_EMAILS` từ
 * `.env.local` (cấu hình Docker), nên một email lệch sẽ sinh admin thứ hai trên prod, và lượt
 * `snapshot:export` + `data:reset` sau đó có thể giữ nhầm admin ma rồi xoá admin thật.
 *
 * Thông điệp không in email: log của lượt prod có thể bị chép vào CHANGELOG.
 */
export function kiemTraAdminChoProd(input: {
  laProd: boolean;
  adminEmail: string;
  emailAdminHienCo: readonly string[];
}): KetQuaChotChan {
  if (!input.laProd) {
    return { ketQua: 'ok', thongDiep: 'Không phải prod — seed tự upsert admin.' };
  }
  const chuanHoa = (e: string): string => e.trim().toLowerCase();
  const soAdmin = input.emailAdminHienCo.length;
  const khop = input.emailAdminHienCo.some((e) => chuanHoa(e) === chuanHoa(input.adminEmail));
  if (soAdmin === 1 && khop) {
    return {
      ketQua: 'ok',
      thongDiep: 'Prod có đúng một admin và ADMIN_EMAILS[0] trỏ đúng admin đó.',
    };
  }
  return {
    ketQua: 'tu-choi',
    thongDiep:
      `prod phải có đúng MỘT admin và ADMIN_EMAILS[0] phải là admin đó (đang có ${soAdmin} admin; ` +
      `ADMIN_EMAILS[0] ${khop ? 'khớp' : 'KHÔNG khớp'}). Lấy ADMIN_EMAILS từ .env.production: ` +
      `export ADMIN_EMAILS="$(grep '^ADMIN_EMAILS=' .env.production | cut -d= -f2-)"`,
  };
}

/**
 * Không seed chồng hai thế hệ dữ liệu. Id chuyến dẫn xuất từ ngày nên đổi H là đổi id, mà
 * `createMany({ skipDuplicates })` không bắt được thế hệ thứ hai — site sẽ hiện chuyến trùng và
 * booking gấp đôi. DB đang có chuyến nào không thuộc bộ fixture của H hiện tại tức là đang mang
 * dữ liệu của một H khác → bắt reset trước.
 */
export function kiemTraTheHeLich(input: {
  idChuyenHienCo: readonly string[];
  idChuyenFixture: ReadonlySet<string>;
}): KetQuaChotChan & { soLa: number } {
  const soLa = input.idChuyenHienCo.filter((id) => !input.idChuyenFixture.has(id)).length;
  if (soLa === 0) {
    return {
      ketQua: 'ok',
      soLa,
      thongDiep: 'DB chưa có chuyến hoặc cùng thế hệ H — seed chạy lại chỉ thêm 0 dòng.',
    };
  }
  return {
    ketQua: 'tu-choi',
    soLa,
    thongDiep:
      `DB đang có ${soLa} chuyến không thuộc bộ fixture của H hiện tại — dữ liệu của một mốc H khác. ` +
      'Reset trước khi seed (prod: data:reset; Docker: prisma migrate reset), và chạy lại thì dùng đúng SEED_HOM_NAY cũ.',
  };
}
