/**
 * Hai chốt chặn ĐỌC DB của `seed.ts`, viết thành hàm thuần để test được mà không cần DB (review
 * cuối nhánh 14/09/2026). `seed.ts` gọi cả hai ở đầu `main()`, TRƯỚC mọi lệnh ghi.
 */

export interface KetQuaChotChan {
  ketQua: 'ok' | 'tu-choi';
  thongDiep: string;
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
