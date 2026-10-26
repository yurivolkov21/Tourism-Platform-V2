/**
 * Xuất bản sao an toàn TRƯỚC khi seed lại (bước 1 của đợt làm mới dữ liệu 09/09/2026).
 *
 *   pnpm --filter @tourism/api snapshot:export
 *
 * Vì sao cần: `media_assets` là BẢN ĐỒ DUY NHẤT nối 241 file trên Cloudinary với
 * nội dung — không có khoá ngoại nào, nên xoá/tạo lại chủ sở hữu với UUID mới là
 * ảnh mồ côi trong im lặng. Bản sao cục bộ `media-inbox/` KHÔNG đủ (201/241 file,
 * bốn thư mục hue/ ha-long/ can-tho/ posts/ rỗng). Mất bảng này là mất ảnh thật.
 *
 * CHỈ ĐỌC: script không có một câu INSERT/UPDATE/DELETE nào.
 *
 * ── Vì sao chia hai nơi ──
 * Repo này là PUBLIC trên GitHub. Nên:
 *   docs/snapshots/<ngày>/  → commit được: bản đồ ảnh + id/slug nội dung, KHÔNG PII
 *   backups/<ngày>/         → gitignored: TRỌN mọi bảng (xem RIENG_TU), có PII
 * Trộn hai thứ là đẩy email của 63 người lên GitHub công khai.
 *
 * Xuất lần nữa trong cùng ngày: `docs/snapshots/<ngày>/` bị ghi đè (có chủ ý:
 * `data:reset` đọc keep-list ở thư mục mới nhất), còn bản sao lưu sang
 * `backups/<ngày>-2/`, `-3`… để bản chụp TRƯỚC reset không bao giờ bị thay.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { chonThuMucSaoLuu } from './thu-muc-sao-luu.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NGAY = new Date().toISOString().slice(0, 10);

// Bảng KHÔNG chứa PII — an toàn để commit, và là thứ cần để nối lại ảnh.
const CONG_KHAI = {
  // `select *` có chủ ý: hai bảng này không có cột PII nào (đã đối chiếu
  // information_schema), và liệt kê tay từng cột là tự chuốc rủi ro sót cột mới
  // thêm sau này — mà sót một cột ở đây là mất một mảnh bản đồ nối ảnh.
  'media-assets': 'select * from media_assets order by owner_type, owner_id, role, sort_order',
  'site-media-slots': 'select * from site_media_slots order by key',
  // Bốn bảng dưới CHỈ lấy id + slug + nhãn: đủ để nối lại ảnh theo slug, không
  // kéo theo nội dung biên tập (nội dung đầy đủ nằm ở bản backups/ riêng tư).
  'tours-ids': 'select id, slug, title, is_published from tours order by slug',
  'destinations-ids': 'select id, slug, name, region from destinations order by slug',
  'posts-ids': 'select id, slug, title, status, published_at from posts order by slug',
  'tour-categories-ids': 'select id, slug, name from tour_categories order by slug',
};

/** Sổ migration của Prisma — không phải dữ liệu, `prisma migrate deploy` tự dựng lại. */
const KHONG_SAO_LUU = new Set(['_prisma_migrations']);

const url = process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const host = new URL(url).host;
console.log(`Nối tới: ${host}\n`);

const client = new pg.Client({ connectionString: url });
await client.connect();

// Có PII hoặc dữ liệu giao dịch — CHỈ để local, không bao giờ commit.
// TRỌN mọi bảng của schema public, đọc từ information_schema lúc chạy chứ không kê tay
// (review F2, 20/10): bản kê tay 19 bảng thiếu năm bảng `data:reset` xoá (chat, ghi chú
// và sự kiện của enquiry, nhật ký admin) và sáu bảng seed ghi đè (29 tour fixture cùng
// năm bảng con), tức đúng phần sẽ mất mà không có bản nào để lấy lại. Bảng sinh sau
// này tự có mặt, không ai phải nhớ thêm vào đây.
// `select *` + `order by 1`: đây là BẢN SAO LƯU, không phải báo cáo — liệt kê cột hay
// đoán tên cột sắp xếp chỉ tạo chỗ để sai. `order by 1` (cột đầu) hợp lệ với mọi bảng,
// kể cả bảng nối không có `id` hay `created_at`.
const { rows: bangThat } = await client.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`,
);
const RIENG_TU = Object.fromEntries(
  bangThat
    .map((r) => r.table_name)
    .filter((ten) => !KHONG_SAO_LUU.has(ten))
    .map((ten) => [ten, `select * from "${ten}" order by 1`]),
);

async function xuat(thuMuc, bang) {
  mkdirSync(thuMuc, { recursive: true });
  let tong = 0;
  for (const [ten, sql] of Object.entries(bang)) {
    const { rows } = await client.query(sql);
    writeFileSync(join(thuMuc, `${ten}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`  ${String(rows.length).padStart(5)} dòng  ${ten}.json`);
    tong += rows.length;
  }
  return tong;
}

console.log(`docs/snapshots/${NGAY}/  (commit được — không PII)`);
const nCongKhai = await xuat(join(ROOT, 'docs', 'snapshots', NGAY), CONG_KHAI);

const SAO_LUU = chonThuMucSaoLuu(NGAY, (ten) => existsSync(join(ROOT, 'backups', ten)));
console.log(`\nbackups/${SAO_LUU}/  (gitignored — có PII)`);
if (SAO_LUU !== NGAY) {
  console.log(`  backups/${NGAY}/ đã có từ lượt xuất trước: giữ nguyên, ghi sang thư mục mới.`);
}
const nRieng = await xuat(join(ROOT, 'backups', SAO_LUU), RIENG_TU);

// ── keep-list.json ──────────────────────────────────────────────────────────
// `reset-operational-data.mjs` đọc file này để biết Owner nào được LÀM MỚI: cùng
// email, dòng mới (Yuri chốt 26/10/2026; trước đó nó GIỮ nguyên dòng admin này).
// Trước 10/09 nó được viết TAY một lần rồi script reset trỏ cứng vào thư mục
// ngày 09/09 — nghĩa là mọi lần xuất snapshot mới đều thiếu file, và bước xoá
// vẫn im lặng đọc bản cũ. Sinh nó ở đây để snapshot tự đủ.
//
// Chọn admin nào — tuyệt đối không đoán. Bản nháp đầu của khối này dùng
// "ADMIN cũ nhất" và chọn NHẦM `admin@tourism.test` (rác của seed) thay vì tài
// khoản gmail thật; chạy reset với nó là xoá đúng tài khoản người dùng đang
// dùng. Một heuristic sai ở đây không báo lỗi — nó chỉ lặng lẽ xoá nhầm người.
//
// Thứ tự quyết định, dừng ở cái đầu tiên khớp:
//   1. biến môi trường GIU_ADMIN_EMAIL (chỉ định tường minh)
//   2. ADMIN_EMAILS[0] — đúng biến mà seed dùng để upsert admin
//   3. keep-list của lần xuất trước, nếu admin đó CÒN tồn tại
//   4. đúng một ADMIN trong DB thì lấy nó
// Không cái nào khớp → DỪNG và in danh sách để người chọn.
const { rows: admins } = await client.query(
  `select id, email, name, created_at from users
    where role = 'ADMIN' order by created_at asc`,
);
if (admins.length === 0) throw new Error('Không có ADMIN nào — không thể sinh keep-list');

const theoEmail = (e) => admins.find((a) => a.email.toLowerCase() === e?.trim().toLowerCase());
const truoc = readdirSync(join(ROOT, 'docs', 'snapshots'))
  .filter((d) => d !== NGAY && existsSync(join(ROOT, 'docs', 'snapshots', d, 'keep-list.json')))
  .sort()
  .at(-1);
const idTruoc = truoc
  ? JSON.parse(readFileSync(join(ROOT, 'docs', 'snapshots', truoc, 'keep-list.json'), 'utf8'))
      .admin_duy_nhat?.id
  : undefined;

const giu =
  theoEmail(process.env.GIU_ADMIN_EMAIL) ??
  theoEmail(process.env.ADMIN_EMAILS?.split(',')[0]) ??
  admins.find((a) => a.id === idTruoc) ??
  (admins.length === 1 ? admins[0] : undefined);

if (!giu) {
  console.error(`\n✗ Có ${admins.length} ADMIN và không có cách nào chọn chắc chắn.`);
  for (const a of admins) console.error(`    ${a.id}  ${a.email}  (${a.name})`);
  console.error('\n  Chỉ định tường minh rồi chạy lại:');
  console.error('    GIU_ADMIN_EMAIL=<email> pnpm --filter @tourism/api snapshot:export\n');
  process.exit(1);
}
const rutGon = (e) => `${e.slice(0, 4)}….${e.slice(e.indexOf('@') - 6)}`;

writeFileSync(
  join(ROOT, 'docs', 'snapshots', NGAY, 'keep-list.json'),
  `${JSON.stringify(
    {
      ghi_chu:
        'Sinh tự động bởi export-snapshot.mjs. reset-operational-data.mjs đọc file ' +
        'này ở thư mục snapshot MỚI NHẤT để biết Owner nào được làm mới.',
      ly_do_giu_email:
        'Owner được làm mới chứ không xoá hẳn: dòng mới cùng email, uuid mới, chưa ' +
        'có mật khẩu. Giữ email để ADMIN_EMAILS trên Render vẫn khớp; 9 bài blog ' +
        'trỏ vào Owner qua FK RESTRICT nên được chuyển sang dòng mới trước khi xoá dòng cũ.',
      admin_duy_nhat: {
        id: giu.id,
        email_rut_gon: rutGon(giu.email),
        name: giu.name,
        created_at: giu.created_at,
        ghi_chu:
          admins.length > 1
            ? `Prod có ${admins.length} ADMIN lúc xuất; bản này được làm mới, ${admins.length - 1} bản còn lại bị xoá khi reset.`
            : 'Chỉ có đúng một ADMIN lúc xuất; bản này được làm mới khi reset.',
      },
      so_admin_luc_xuat: admins.length,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `\n  keep-list.json  → làm mới Owner ${rutGon(giu.email)} (${admins.length} ADMIN lúc xuất)`,
);

console.log(`\n✓ Tổng ${nCongKhai + nRieng} dòng (${nCongKhai} công khai, ${nRieng} riêng tư)`);
await client.end();
