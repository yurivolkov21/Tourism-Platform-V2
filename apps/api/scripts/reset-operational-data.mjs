/**
 * Xoá TẦNG VẬN HÀNH trước khi seed lại (bước 2, đợt làm mới dữ liệu 09/09/2026).
 *
 *   pnpm --filter @tourism/api data:reset              # DRY RUN — chỉ in kế hoạch
 *   DATABASE_URL=<docker> … data:reset -- --apply      # xoá thật ở local
 *
 * CẢNH BÁO về mặc định: `data:reset` chạy qua `--env-file-if-exists=.env.local`,
 * mà `.env.local` của repo này trỏ Session pooler của Supabase PROD. Nghĩa là
 * không truyền gì thì đích MẶC ĐỊNH LÀ PRODUCTION — ngược hẳn trực giác. Muốn
 * chạy ở docker thì phải đặt DATABASE_URL tường minh (biến môi trường thắng
 * --env-file, đã đo).
 *
 * ── Nó GIỮ gì ──
 * Toàn bộ tầng nội dung và ảnh: tours, destinations, tour_categories và các bảng
 * con của tour, media_assets, site_media_slots, VÀ CẢ blog (posts, post_tags,
 * post_tag_links), cùng đúng một tài khoản admin.
 *
 * ── Vì sao blog KHÔNG bị xoá, dù đợt này làm mới nội dung blog ──
 * Ban đầu script có xoá `posts`. Review đối kháng bắt được đó là lỗi CHẶN HỎNG:
 * `Post.id` là `@default(uuid(7))` và `seed.ts` tạo post KHÔNG gán `id`, nên
 * seed lại sẽ sinh 9 uuid MỚI — trong khi 9 dòng `media_assets` owner_type=POST
 * vẫn trỏ vào 9 uuid CŨ. Kết quả: 9 ảnh hero blog mồ côi trong im lặng, không
 * lỗi, không cảnh báo, script vẫn in COMMIT thành công.
 *
 * Lý do DUY NHẤT phải xoá posts là khoá ngoại RESTRICT `posts.author_id → users`
 * (tài khoản Seed Admin đang giữ cả 9 bài). Cách đúng là gỡ tham chiếu đó bằng
 * một lệnh UPDATE trỏ tác giả sang admin được giữ — giữ nguyên 9 uuid, giữ
 * nguyên ảnh. Chính `keep-list.json` đã kê đúng thuốc này.
 * Làm mới NỘI DUNG blog là việc của seed (upsert theo `slug`), không phải việc
 * của lệnh xoá.
 *
 * ── Vì sao giữ UUID là điều sống còn ──
 * `media_assets` trỏ chủ sở hữu bằng (owner_type, owner_id) và KHÔNG có một khoá
 * ngoại nào. Postgres không cản, không cascade, không báo lỗi khi chủ sở hữu
 * biến mất. Vì thế script có một bất biến THAM CHIẾU (không phải đếm dòng) chạy
 * trong transaction ngay trước COMMIT.
 *
 * ── Thứ tự xoá ──
 * Suy từ pg_constraint, không từ trí nhớ. TÁM khoá RESTRICT là nút chặn thật:
 * bookings→users, bookings→tours, bookings→tour_departures,
 * cancellation_requests→users, cancellation_requests→bookings, posts→users,
 * refunds→bookings, tours→tour_categories.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const CHO_PHEP_PROD = process.argv.includes('--toi-biet-day-la-production');
const ROOT = join(import.meta.dirname, '..', '..', '..');

const url = process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const host = new URL(url).host;
// Bắt cả `…pooler.supabase.com` lẫn `db.<ref>.supabase.co`.
const LA_PROD = /supabase\.(com|co)$/i.test(host.split(':')[0]);

if (LA_PROD && APPLY && !CHO_PHEP_PROD) {
  console.error(`✖ TỪ CHỐI: ${host} là Supabase production.`);
  console.error('  Muốn chạy thật trên prod thì phải thêm cờ thứ hai:');
  console.error('    --apply --toi-biet-day-la-production');
  console.error('  Theo CLAUDE.md §15, việc này thuộc session gốc SAU review.');
  process.exit(1);
}

const keep = JSON.parse(
  readFileSync(join(ROOT, 'docs', 'snapshots', '2026-09-09', 'keep-list.json'), 'utf8'),
);
const ADMIN_ID = keep.admin_duy_nhat.id;

/** Thứ tự BẮT BUỘC — con trước cha. Đảo là gãy ở khoá RESTRICT. */
const KE_HOACH = [
  ['payment_events', null, 'sổ webhook — không FK, xoá trước để khỏi trỏ vào booking ma'],
  ['refunds', null, 'RESTRICT → bookings'],
  ['cancellation_requests', null, 'RESTRICT → bookings và users'],
  ['review_moderation_events', null, 'CASCADE ← reviews, xoá tường minh cho rõ ý'],
  ['reviews', null, 'xoá hết, seed lại sau bằng dữ liệu người dùng giả'],
  ['bookings', null, 'RESTRICT → users, tour_departures, tours'],
  ['tour_departures', null, 'phải SAU bookings (bookings.departure_id là RESTRICT)'],
  ['wishlist', null, 'CASCADE ← users'],
  ['chat_messages', null, 'CASCADE ← chat_conversations; hiện 0 dòng, để sẵn cho P6'],
  ['chat_conversations', null, 'user_id → users là SET NULL; hiện 0 dòng'],
  ['enquiry_status_events', null, 'CASCADE ← enquiries'],
  ['enquiry_notes', null, 'CASCADE ← enquiries'],
  ['enquiries', null, '3 dòng nội dung "Testing" của chính user'],
  ['subscribers', null, 'seed lại bằng người dùng giả'],
  ['outbox', null, '137 dòng đều SENT — không email nào đang chờ'],
  ['verifications', null, 'token Better Auth, tự sinh lại'],
  ['sessions', 'user_id <> $1', 'giữ phiên admin để không tự đá mình khỏi trang admin'],
  ['accounts', 'user_id <> $1', 'CASCADE ← users, xoá tường minh cho khớp'],
  ['users', 'id <> $1', 'GIỮ ĐÚNG MỘT admin — xem keep-list.admin_duy_nhat'],
];

/** Bảng phải còn NGUYÊN VẸN: số dòng trước và sau phải bằng nhau. */
const PHAI_CON = [
  'media_assets',
  'site_media_slots',
  'tours',
  'destinations',
  'tour_categories',
  'tour_destinations',
  'tour_itinerary_days',
  'tour_faqs',
  'tour_policies',
  'tour_cost_items',
  // Blog nằm ở đây chứ KHÔNG ở KE_HOACH — xem doc-comment đầu file.
  'posts',
  'post_tags',
  'post_tag_links',
  'post_tours',
  // Dữ liệu tuân thủ gửi mail: một dòng ở đây là một địa chỉ bị CHẶN GỬI thật.
  'email_suppressions',
  // Hàng đợi xoá ảnh Cloudinary — phải ở yên (và đang rỗng). Đụng vào là đường
  // duy nhất mất ảnh THẬT.
  'media_garbage',
];

/** Bảng cố ý không thuộc nhóm nào (sổ ghi của Prisma). */
const BO_QUA = ['_prisma_migrations'];

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log(`Nối tới  : ${host}${LA_PROD ? '  ⚠ PRODUCTION' : '  (local)'}`);
console.log(`Chế độ   : ${APPLY ? 'XOÁ THẬT' : 'DRY RUN — không đụng gì'}`);
console.log(`Giữ admin: ${keep.admin_duy_nhat.email_rut_gon}  (${ADMIN_ID})\n`);

const dem = async (bang, where) => {
  const { rows } = await client.query(
    `select count(*)::int as n from ${bang}${where ? ` where ${where}` : ''}`,
    where ? [ADMIN_ID] : [],
  );
  return rows[0].n;
};

// ── Cổng 1: mọi bảng phải được phân loại ────────────────────────────────────
// Không có bước này thì bảng sinh ra sau sẽ bị bỏ quên trong im lặng — đúng lỗi
// review bắt được (4 bảng từng không nằm trong danh sách nào).
const { rows: bangThat } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'`,
);
const daPhanLoai = new Set([...KE_HOACH.map((r) => r[0]), ...PHAI_CON, ...BO_QUA]);
const chuaPhanLoai = bangThat.map((r) => r.table_name).filter((t) => !daPhanLoai.has(t));
if (chuaPhanLoai.length > 0) {
  console.error(`✖ DỪNG: ${chuaPhanLoai.length} bảng chưa được phân loại giữ hay xoá:`);
  for (const t of chuaPhanLoai) console.error(`    ${t}`);
  console.error('  Thêm chúng vào KE_HOACH hoặc PHAI_CON rồi chạy lại.');
  process.exit(1);
}
console.log(`✓ Cổng phân loại: ${bangThat.length}/${bangThat.length} bảng đã có chỗ`);

// ── Cổng 2: tài khoản admin phải CÓ THẬT trong DB đích ──────────────────────
// Thiếu bước này thì lỗi lộ ra rất muộn và rất tối nghĩa: lệnh
// `update posts set author_id = <admin>` sẽ vi phạm khoá ngoại và ném
// "posts_author_id_fkey" — không ai đoán được nguyên nhân thật là "id trong
// keep-list không tồn tại ở database này". Đã dính đúng vậy khi chạy thử trên
// docker local ngày 09/09.
const { rows: adminRows } = await client.query('select email, role from users where id = $1', [
  ADMIN_ID,
]);
if (adminRows.length !== 1) {
  console.error(`\n✖ DỪNG: không tìm thấy tài khoản admin ${ADMIN_ID} trong ${host}.`);
  console.error('  keep-list.json ghi id của Supabase prod. Muốn chạy ở database khác thì DB đó');
  console.error('  phải có sẵn một user mang đúng id này (hoặc sửa keep-list cho khớp).');
  process.exit(1);
}
if (adminRows[0].role !== 'ADMIN') {
  console.error(`\n✖ DỪNG: user ${ADMIN_ID} có role ${adminRows[0].role}, không phải ADMIN.`);
  process.exit(1);
}
console.log(`✓ Cổng admin: tìm thấy, role ${adminRows[0].role}\n`);

// ── Bất biến THAM CHIẾU: ảnh mồ côi ─────────────────────────────────────────
// Đếm số dòng là VÔ NGHĨA với media_assets: nó không có khoá ngoại nào, nên xoá
// chủ sở hữu không đụng tới số dòng — 517 vẫn là 517 trong khi ảnh đã mồ côi.
// Phép đo đúng là truy ngược xem chủ sở hữu còn tồn tại không.
const SQL_MO_COI = `
  select count(*)::int as n from media_assets m where
       (m.owner_type = 'TOUR'        and not exists (select 1 from tours t             where t.id = m.owner_id))
    or (m.owner_type = 'DESTINATION' and not exists (select 1 from destinations d      where d.id = m.owner_id))
    or (m.owner_type = 'SITE'        and not exists (select 1 from site_media_slots s  where s.id = m.owner_id))
    or (m.owner_type = 'POST'        and not exists (select 1 from posts p             where p.id = m.owner_id))
    or m.owner_type not in ('TOUR', 'DESTINATION', 'SITE', 'POST')`;
const demMoCoi = async () => (await client.query(SQL_MO_COI)).rows[0].n;

console.log('KẾ HOẠCH XOÁ (thứ tự suy từ pg_constraint)');
let tong = 0;
for (const [bang, where, ly_do] of KE_HOACH) {
  const n = await dem(bang, where);
  tong += n;
  console.log(`  ${String(n).padStart(5)}  ${bang.padEnd(24)} ${ly_do}`);
}
console.log(`  ${'─'.repeat(5)}\n  ${String(tong).padStart(5)}  TỔNG\n`);

console.log('MỘT LỆNH SỬA (gỡ khoá RESTRICT mà không xoá bài)');
const soBaiPhaiDoi = (
  await client.query('select count(*)::int as n from posts where author_id <> $1', [ADMIN_ID])
).rows[0].n;
console.log(`  ${String(soBaiPhaiDoi).padStart(5)}  posts.author_id → admin được giữ\n`);

console.log(`Ảnh mồ côi hiện tại: ${await demMoCoi()}  (phải là 0 trước VÀ sau)\n`);

if (!APPLY) {
  console.log('DRY RUN — chưa xoá gì. Thêm --apply để chạy thật.');
  await client.end();
  process.exit(0);
}

// ── Xoá thật ────────────────────────────────────────────────────────────────
console.log('Đang chạy trong một transaction…');
await client.query('BEGIN');
try {
  // Chụp mốc BÊN TRONG transaction: đo ngoài rồi so trong sẽ báo động giả nếu
  // có admin upload ảnh xen vào giữa hai lần đo.
  const truoc = new Map();
  for (const bang of PHAI_CON) truoc.set(bang, await dem(bang, null));

  const { rowCount: doiTacGia } = await client.query(
    'update posts set author_id = $1 where author_id <> $1',
    [ADMIN_ID],
  );
  console.log(
    `  ~${String(doiTacGia).padStart(5)}  posts.author_id (gỡ RESTRICT, giữ nguyên uuid)`,
  );

  for (const [bang, where] of KE_HOACH) {
    const { rowCount } = await client.query(
      `delete from ${bang}${where ? ` where ${where}` : ''}`,
      where ? [ADMIN_ID] : [],
    );
    console.log(`  −${String(rowCount).padStart(5)}  ${bang}`);
  }

  for (const bang of PHAI_CON) {
    const sau = await dem(bang, null);
    if (sau !== truoc.get(bang)) {
      throw new Error(`Bất biến vỡ: ${bang} có ${truoc.get(bang)} dòng trước, còn ${sau} sau`);
    }
  }
  const moCoi = await demMoCoi();
  if (moCoi !== 0) throw new Error(`${moCoi} ảnh mồ côi — chủ sở hữu đã biến mất`);
  if ((await dem('users', 'id = $1')) !== 1) throw new Error('Tài khoản admin đã biến mất');

  await client.query('COMMIT');
  console.log('\n✓ COMMIT — 0 ảnh mồ côi, mọi bất biến còn nguyên, admin còn sống.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`\n✖ ROLLBACK: ${err.message}`);
  console.error('  Không một dòng nào bị xoá.');
  process.exitCode = 1;
}
await client.end();
