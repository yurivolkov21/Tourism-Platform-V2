import { boSinh, idTinh, nguyen } from '../stable-id.js';

/**
 * Khách hàng GIẢ cho đợt làm mới dữ liệu 10/09/2026.
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
 * dạng và cả bộ tài khoản không đăng nhập được, mà không có lỗi nào báo ra.
 *
 * ── Vì sao id tất định ──
 * `createMany({ skipDuplicates })` chỉ bỏ qua được khi có khoá để đụng. Id sinh
 * từ email nên chạy seed lần hai ghi đè đúng dòng cũ thay vì đẻ thêm một lứa.
 *
 * ── Vì sao ghép tên theo NHÓM ngôn ngữ ──
 * Bản 40 người đầu tiên viết tay từng tên. Nâng lên 120 thì phải sinh, mà ghép
 * họ với tên qua lại giữa các vùng sẽ đẻ ra "Yuki Kowalski" hay "Priya
 * O’Sullivan" — không sai về kỹ thuật, nhưng người chấm liếc bảng Customers là
 * thấy ngay. Mỗi nhóm dưới đây tự chứa tên, họ và MÃ VÙNG điện thoại của nó.
 */
export interface KhachFixture {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: Date;
}

/** Đổi con số này là đổi cả quy mô tầng vận hành — booking rải trên chừng này người. */
export const SO_KHACH = 120;

interface Nhom {
  ten: string[];
  ho: string[];
  /** Mã điện thoại quốc tế của chính vùng đó. */
  ma: number[];
  /** Trọng số ~ thị phần khách quốc tế tới Việt Nam. */
  trong_so: number;
}

const NHOM: Nhom[] = [
  {
    // Anh · Ireland · Úc — thị trường nói tiếng Anh lớn nhất của tour inbound.
    ten: [
      'James',
      'Oliver',
      'Chloe',
      'Amelia',
      'Henry',
      'Grace',
      'Dylan',
      'Sarah',
      'Ben',
      'Ella',
      'Harry',
      'Freya',
    ],
    ho: [
      'Whitfield',
      'Grant',
      'Bennett',
      'Clarke',
      'Ashworth',
      'Thornton',
      'Roberts',
      'Whitaker',
      'Harrington',
      'O’Sullivan',
    ],
    ma: [44, 353, 61],
    trong_so: 22,
  },
  {
    // Bắc Âu — nhóm đi tour dài ngày nhiều nhất theo dữ liệu ngành.
    ten: ['Emma', 'Hannah', 'Nora', 'Ingrid', 'Felix', 'Jonas', 'Astrid', 'Lars', 'Sigrid', 'Erik'],
    ho: [
      'Lindqvist',
      'Bergström',
      'Hansen',
      'Solberg',
      'Andersson',
      'Nilsen',
      'Dahl',
      'Lund',
      'Mikkelsen',
      'Holm',
    ],
    ma: [46, 47, 45, 358],
    trong_so: 12,
  },
  {
    ten: [
      'Thomas',
      'Lucas',
      'Camille',
      'Chloé',
      'Mathieu',
      'Élise',
      'Julien',
      'Manon',
      'Antoine',
      'Léa',
    ],
    ho: [
      'Dubois',
      'Moreau',
      'Laurent',
      'Lefebvre',
      'Girard',
      'Bonnet',
      'Fontaine',
      'Chevalier',
      'Renaud',
      'Marchand',
    ],
    ma: [33],
    trong_so: 11,
  },
  {
    ten: [
      'Jonas',
      'Lena',
      'Maximilian',
      'Sophie',
      'Niklas',
      'Katharina',
      'Stefan',
      'Johanna',
      'Tobias',
      'Marlene',
    ],
    ho: [
      'Weber',
      'Hoffmann',
      'Schneider',
      'Fischer',
      'Brandt',
      'Keller',
      'Wagner',
      'Richter',
      'Neumann',
      'Vogel',
    ],
    ma: [49, 43, 41],
    trong_so: 12,
  },
  {
    ten: [
      'Sofia',
      'Mateo',
      'Isabella',
      'Rafael',
      'Laura',
      'Elena',
      'Diego',
      'Valentina',
      'Marco',
      'Lucia',
    ],
    ho: [
      'Marchetti',
      'Alvarez',
      'Rossi',
      'Costa',
      'Jimenez',
      'Vasquez',
      'Ferrari',
      'Moreno',
      'Conti',
      'Ortega',
    ],
    ma: [39, 34, 351],
    trong_so: 13,
  },
  // Đông Á tách làm BA nhóm chứ không gộp một. Gộp lại thì bộ sinh ghép chéo và
  // đẻ ra "Seo-yeon Chan" (tên Hàn + họ Quảng Đông) hay "Yuki Kim" — cùng loại
  // lỗi với "Yuki Kowalski", chỉ nhỏ hơn một bậc nên dễ lọt.
  {
    ten: ['Yuki', 'Haruto', 'Sakura', 'Aiko', 'Kenji', 'Riko', 'Sora', 'Nanami'],
    ho: ['Tanaka', 'Nakamura', 'Yamamoto', 'Sato', 'Watanabe', 'Kobayashi', 'Ito', 'Suzuki'],
    ma: [81],
    trong_so: 6,
  },
  {
    ten: ['Ji-woo', 'Min-jun', 'Seo-yeon', 'Hyun-woo', 'Ha-eun', 'Do-yun'],
    ho: ['Kim', 'Park', 'Lee', 'Choi', 'Jung', 'Kang'],
    ma: [82],
    trong_so: 5,
  },
  {
    ten: ['Mei Lin', 'Wei', 'Xiu Ying', 'Jia Hao', 'Yi Ting', 'Zhi Hao'],
    ho: ['Chan', 'Wong', 'Lim', 'Tan', 'Cheng', 'Ho'],
    ma: [852, 886, 65],
    trong_so: 4,
  },
  {
    ten: ['Noah', 'Sanne', 'Daan', 'Lotte', 'Bram', 'Fenna', 'Ruben', 'Anouk'],
    ho: ['Vermeulen', 'de Vries', 'Jansen', 'Bakker', 'Visser', 'Meijer', 'Smit', 'Bos'],
    ma: [31, 32],
    trong_so: 7,
  },
  {
    ten: ['Sebastian', 'Marta', 'Andrei', 'Anya', 'Tomas', 'Zofia', 'Nikolai', 'Katya'],
    ho: ['Novak', 'Kowalski', 'Petrov', 'Kuznetsova', 'Horak', 'Wojcik', 'Volkov', 'Nowak'],
    ma: [48, 420, 36, 40],
    trong_so: 6,
  },
  {
    ten: ['Ethan', 'Marcus', 'Madison', 'Tyler', 'Ashley', 'Brandon', 'Megan', 'Cole'],
    ho: ['Caldwell', 'Feldman', 'Sullivan', 'Brooks', 'Reyes', 'Palmer', 'Hayes', 'Mercer'],
    ma: [1],
    trong_so: 9,
  },
  {
    ten: ['Aisha', 'Priya', 'Daniel', 'Zara', 'Rohan', 'Amara', 'Karim', 'Nadia'],
    ho: ['Rahman', 'Deshmukh', 'Okafor', 'Mbeki', 'Kapoor', 'Adeyemi', 'Haddad', 'Iqbal'],
    ma: [91, 971, 27, 60, 65],
    trong_so: 6,
  },
];

/** `Chloé Lefebvre` → `chloe.lefebvre` (bỏ dấu, bỏ nháy, gộp khoảng trắng). */
function phanEmail(ten: string): string {
  return ten
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’']/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join('.');
}

/**
 * `createdAt`: **60% khách có mặt từ 09–12/2025**, 40% còn lại rải đều 01–08/2026.
 *
 * Khách không thể đặt chuyến trước ngày họ có tài khoản, mà booking bắt đầu ngay
 * từ 01/2026. Dồn phần lớn khách về trước 2026 giữ cho tháng đầu năm có đủ người
 * đặt, mà vẫn còn một dòng khách mới chảy suốt năm cho biểu đồ dashboard.
 *
 * Bộ sinh booking PHẢI tôn trọng `paidAt >= khach.createdAt`.
 */
const TY_LE_CU = 0.6;
const CU_DAU = Date.UTC(2025, 8, 1);
const CU_CUOI = Date.UTC(2025, 11, 28);
const MOI_DAU = Date.UTC(2026, 0, 3);
const MOI_CUOI = Date.UTC(2026, 7, 31);

/** Bảng tra nhóm theo trọng số — dựng một lần, rồi đọc bằng chỉ số. */
const VE: number[] = NHOM.flatMap((n, i) => Array.from({ length: n.trong_so }, () => i));

function sinh(): KhachFixture[] {
  const ra: KhachFixture[] = [];
  const daDung = new Set<string>();
  const soCu = Math.round(SO_KHACH * TY_LE_CU);

  for (let i = 0; i < SO_KHACH; i++) {
    const rnd = boSinh(`khach-v2:${i}`);
    const nhom = NHOM[VE[i % VE.length] as number] as Nhom;

    // Bước nhảy nguyên tố khác nhau cho tên và họ: cùng bước thì hai danh sách
    // chạy song song và chỉ sinh ra `len` cặp thay vì `len * len`.
    let ten = '';
    let phan = '';
    for (let k = 0; k < 200; k++) {
      const t = nhom.ten[(i * 7 + k * 3) % nhom.ten.length] as string;
      const h = nhom.ho[(i * 11 + k * 5) % nhom.ho.length] as string;
      const p = phanEmail(`${t} ${h}`);
      if (!daDung.has(p)) {
        daDung.add(p);
        ten = `${t} ${h}`;
        phan = p;
        break;
      }
    }
    if (!ten) throw new Error(`Không tìm được tên chưa dùng cho khách #${i}`);

    const email = `${phan}@example.com`;
    const cu = i < soCu;
    const moc = cu
      ? CU_DAU + Math.floor((CU_CUOI - CU_DAU) * ((i + 0.5) / soCu))
      : MOI_DAU + Math.floor((MOI_CUOI - MOI_DAU) * ((i - soCu + 0.5) / (SO_KHACH - soCu)));

    ra.push({
      id: idTinh('seed-customer', email),
      email,
      name: ten,
      // ~60% có số điện thoại: hồ sơ thật cũng không ai điền đủ, và màn admin
      // cần cả hai nhánh để lộ ra chỗ nào chưa xử lý giá trị rỗng. Mã vùng lấy
      // từ CHÍNH nhóm của cái tên — một "Ingrid Solberg" mang số +91 là thứ
      // không ai viết ra có chủ ý.
      phone:
        rnd() < 0.6
          ? `+${nhom.ma[nguyen(rnd, 0, nhom.ma.length - 1)]}${nguyen(rnd, 100000000, 999999999)}`
          : null,
      createdAt: new Date(moc),
    });
  }
  return ra;
}

export const khachGia: KhachFixture[] = sinh();
