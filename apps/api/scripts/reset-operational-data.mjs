/**
 * Xoá TẦNG VẬN HÀNH trước khi seed lại (bước 2, đợt làm mới dữ liệu 09/09/2026).
 *
 *   pnpm --filter @tourism/api data:reset              # DRY RUN — chỉ in kế hoạch
 *   DATABASE_URL=<docker> … data:reset -- --apply      # xoá thật ở local
 *
 * Đích: `data:reset` chạy qua `--env-file-if-exists=.env.local`, mà từ 14/09/2026
 * `.env.local` trỏ Postgres Docker. Muốn nhắm Supabase thì ghi đè DATABASE_URL bằng
 * chuỗi của `.env.production` (biến môi trường thắng --env-file, đã đo) và thêm
 * `--apply --toi-biet-day-la-production`.
 *
 * ── Nó GIỮ gì ──
 * Toàn bộ tầng nội dung và ảnh: tours, destinations, tour_categories và các bảng
 * con của tour, media_assets, site_media_slots, VÀ CẢ blog (posts, post_tags,
 * post_tag_links). Ngoại lệ duy nhất là ảnh của review: chúng rời site cùng review
 * và sang hàng dọn media (G22, xem SQL_ANH_REVIEW). Không giữ tài khoản nào, kể cả
 * Owner: xem mục kế tiếp.
 *
 * ── Owner được LÀM MỚI chứ không được giữ (Yuri chốt 26/10/2026) ──
 * Trước 26/10 script giữ nguyên dòng admin cùng phiên đăng nhập của nó. Lượt seed lại
 * 2 làm mới mọi tài khoản, kể cả Owner, và Owner giữ email cũ để `ADMIN_EMAILS` trên
 * Render khỏi đổi. Trong cùng transaction: đổi email dòng cũ sang một địa chỉ tạm
 * (email là citext unique), chèn dòng Owner mới mang email ấy, chuyển `posts.author_id`
 * sang dòng mới, rồi mới xoá mọi tài khoản, cả dòng cũ. Dòng mới chưa có mật khẩu:
 * trang đăng nhập admin có "Forgot password?", và Better Auth tạo dòng `accounts`
 * credential khi đặt lại mật khẩu cho tài khoản chưa có. Spec seed 14/09 §8.5, điều
 * chỉnh 26/10.
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
 * một lệnh UPDATE trỏ tác giả sang Owner mới (mục trên) — giữ nguyên 9 uuid, giữ
 * nguyên ảnh.
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
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// Đọc keep-list ở thư mục snapshot MỚI NHẤT, không trỏ cứng vào một ngày.
// Bản trước trỏ cứng '2026-09-09' — nghĩa là xuất snapshot mới bao nhiêu lần thì
// bước xoá vẫn im lặng đọc bản cũ, và ngày nào admin đổi là xoá nhầm người.
const THU_MUC_SNAPSHOT = join(ROOT, 'docs', 'snapshots');
const NGAY_MOI_NHAT = readdirSync(THU_MUC_SNAPSHOT)
  .filter((d) => existsSync(join(THU_MUC_SNAPSHOT, d, 'keep-list.json')))
  .sort()
  .at(-1);
if (!NGAY_MOI_NHAT) {
  console.error('\n✗ Không có snapshot nào chứa keep-list.json.');
  console.error('  Chạy `pnpm --filter @tourism/api snapshot:export` trước.\n');
  process.exit(1);
}
const keep = JSON.parse(
  readFileSync(join(THU_MUC_SNAPSHOT, NGAY_MOI_NHAT, 'keep-list.json'), 'utf8'),
);
console.log(`keep-list: docs/snapshots/${NGAY_MOI_NHAT}/keep-list.json`);
/** Owner hiện tại theo keep-list: dòng này nhường email cho {@link OWNER_MOI} rồi bị xoá. */
const OWNER_CU = keep.admin_duy_nhat.id;
/**
 * Id của dòng Owner mới. Sinh từ đầu để lượt chạy khô đếm bằng đúng câu lệnh của lượt
 * chạy thật: `users` xoá `id <> OWNER_MOI`, mà lúc chạy khô chưa dòng nào mang id này,
 * nên con số in ra là mọi tài khoản, kể cả Owner cũ.
 */
const OWNER_MOI = randomUUID();

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
  ['chat_messages', null, 'CASCADE ← chat_conversations, xoá tường minh cho rõ ý (P6)'],
  ['chat_conversations', null, 'user_id → users và enquiry_id → enquiries đều SET NULL (P6)'],
  ['enquiry_status_events', null, 'CASCADE ← enquiries'],
  ['enquiry_notes', null, 'CASCADE ← enquiries'],
  ['enquiries', null, 'kể cả liên hệ thử lúc test tay — seed lại bằng enquiry giả'],
  ['subscribers', null, 'seed lại bằng người dùng giả'],
  ['outbox', null, 'email còn PENDING sẽ không bao giờ được gửi — soát /outbox trước --apply'],
  ['verifications', null, 'token Better Auth, tự sinh lại'],
  ['user_events', null, 'CASCADE ← users, xoá tường minh cho rõ ý (P4f)'],
  ['admin_activity', null, 'nhật ký admin (ADR-0061 §8): dòng trỏ tới đơn và tài khoản xoá ở đây'],
  ['sessions', null, 'xoá hết, cả phiên Owner: Owner mới đăng nhập lại sau khi đặt mật khẩu'],
  ['accounts', null, 'CASCADE ← users, xoá tường minh: cả mật khẩu và Google của Owner cũ'],
  ['users', 'id <> $1', 'xoá hết, cả Owner cũ; chỉ còn Owner mới cùng email (26/10)'],
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
  // Hàng đợi xoá ảnh Cloudinary. Không được MẤT dòng nào, và chỉ được THÊM đúng số
  // publicId ảnh review lần đầu vào hàng (G22) — xếp nhầm một ảnh vào đây là đường
  // mất ảnh THẬT, nên bất biến của nó đếm chính xác chứ không chỉ "không giảm".
  'media_garbage',
];

/**
 * Điều kiện đếm riêng của bất biến PHAI_CON. Ảnh review rời `media_assets` có chủ đích
 * (G22), nên bảng ấy đếm trừ chúng; phần đã rời có bất biến riêng ở cuối transaction.
 */
const DEM_PHAI_CON = { media_assets: "owner_type <> 'REVIEW'" };

/** Bảng cố ý không thuộc nhóm nào (sổ ghi của Prisma). */
const BO_QUA = ['_prisma_migrations'];

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log(`Nối tới  : ${host}${LA_PROD ? '  ⚠ PRODUCTION' : '  (local)'}`);
console.log(`Chế độ   : ${APPLY ? 'XOÁ THẬT' : 'DRY RUN — không đụng gì'}`);
console.log(`Owner    : ${keep.admin_duy_nhat.email_rut_gon}  (${OWNER_CU})`);
console.log(`Owner mới: cùng email, id ${OWNER_MOI}\n`);

const dem = async (bang, where) => {
  const { rows } = await client.query(
    `select count(*)::int as n from ${bang}${where ? ` where ${where}` : ''}`,
    where ? [OWNER_MOI] : [],
  );
  return rows[0].n;
};

const demPhaiCon = async (bang) => {
  const where = DEM_PHAI_CON[bang];
  const { rows } = await client.query(
    `select count(*)::int as n from ${bang}${where ? ` where ${where}` : ''}`,
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

// ── Cổng 2: Owner của keep-list phải CÓ THẬT trong DB đích ──────────────────
// Thiếu bước này thì lỗi lộ ra rất muộn và rất tối nghĩa (trước 26/10 là lệnh sửa
// `posts.author_id` vấp khoá ngoại "posts_author_id_fkey"; nay là không có email nào để
// trao cho Owner mới) — không ai đoán được nguyên nhân thật là "id trong keep-list không
// tồn tại ở database này". Đã dính đúng vậy khi chạy thử trên docker local ngày 09/09.
const { rows: adminRows } = await client.query(
  'select email, name, role from users where id = $1',
  [OWNER_CU],
);
if (adminRows.length !== 1) {
  console.error(`\n✖ DỪNG: không tìm thấy Owner ${OWNER_CU} của keep-list trong ${host}.`);
  console.error('  Vừa chạy --apply xong một lượt thì đây là chuyện thường: Owner cũ đã được thay');
  console.error('  bằng dòng mới, nên phải chạy lại snapshot:export trước khi reset lần nữa.');
  console.error('  keep-list.json ghi id của DB lúc xuất: muốn chạy ở database khác thì xuất');
  console.error('  snapshot từ chính DB đó (hoặc sửa keep-list cho khớp).');
  process.exit(1);
}
if (adminRows[0].role !== 'ADMIN') {
  console.error(`\n✖ DỪNG: user ${OWNER_CU} có role ${adminRows[0].role}, không phải ADMIN.`);
  process.exit(1);
}
/** Dòng Owner cũ: email và tên của nó sang dòng Owner mới. */
const ownerCu = adminRows[0];
console.log(`✓ Cổng admin: tìm thấy, role ${ownerCu.role}\n`);

// ── Cổng 3 (review cuối 14/09): trên prod, Owner phải mang email mà seed sẽ dùng ─
// `db:seed` chỉ chạy tiếp khi prod có đúng một admin trùng ADMIN_EMAILS[0]
// (`prisma/fixtures/chot-chan-seed.ts`), nhưng chốt đó chạy SAU bước xoá này. Owner mới
// nhận đúng email của Owner trong keep-list, nên keep-list chọn nhầm admin là Owner thật
// bị xoá và seed từ chối. Chạy cả ở dry run, để lộ ra trước `--apply`. Không in email:
// log lượt prod có thể được chép vào CHANGELOG.
if (LA_PROD) {
  const emailSeed = process.env.ADMIN_EMAILS?.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!emailSeed || ownerCu.email.trim().toLowerCase() !== emailSeed) {
    console.error(
      '\n✖ DỪNG: admin trong keep-list không trùng ADMIN_EMAILS[0] (hoặc ADMIN_EMAILS trống).',
    );
    console.error(
      '  Export ADMIN_EMAILS từ .env.production rồi chạy lại snapshot:export trước khi reset:',
    );
    console.error(
      `    export ADMIN_EMAILS="$(grep '^ADMIN_EMAILS=' .env.production | cut -d= -f2-)"`,
    );
    process.exit(1);
  }
  console.log('✓ Cổng admin prod: keep-list trùng ADMIN_EMAILS[0]\n');
}

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
    or (m.owner_type = 'REVIEW'      and not exists (select 1 from reviews r           where r.id = m.owner_id))
    or m.owner_type not in ('TOUR', 'DESTINATION', 'SITE', 'POST', 'REVIEW')`;
const demMoCoi = async () => (await client.query(SQL_MO_COI)).rows[0].n;

// ── Ảnh review: sang hàng dọn, không để treo (G22) ─────────────────────────────
// `reviews` bị xoá trắng ở KE_HOACH, mà `media_assets` không có khoá ngoại nào nên dòng
// ảnh của review sẽ ở lại, trỏ vào review đã mất. Bộ dọn media (ADR-0035) thấy dòng ấy
// là "còn dùng" và hoãn mãi, file Cloudinary không bao giờ bị xoá — đo 01/10: bốn ảnh
// của review thử bị bác trên BK-5YU9J339. Nên xoá dòng ảnh review CÙNG transaction và
// xếp publicId vào `media_garbage` y như `ReviewsService.retract` và lệnh xoá tài khoản:
// đồng hồ đặt lại lúc này, `attempts`/`last_error` về 0 (ADR-0035 AMEND 2b). Bộ dọn chỉ
// destroy ảnh trong vùng tải lên (ADR-0035 AMEND 3), mà ảnh review luôn nằm trong vùng.
const SQL_ANH_REVIEW = "select distinct public_id from media_assets where owner_type = 'REVIEW'";
const SQL_DA_TRONG_HANG =
  'select count(*)::int as n from media_garbage where public_id = any($1::text[])';
const docAnhReview = async () => {
  const publicIds = (await client.query(SQL_ANH_REVIEW)).rows.map((r) => r.public_id);
  const daTrongHang = (await client.query(SQL_DA_TRONG_HANG, [publicIds])).rows[0].n;
  return { publicIds, moiVaoHang: publicIds.length - daTrongHang };
};

console.log('KẾ HOẠCH XOÁ (thứ tự suy từ pg_constraint)');
let tong = 0;
for (const [bang, where, ly_do] of KE_HOACH) {
  const n = await dem(bang, where);
  tong += n;
  console.log(`  ${String(n).padStart(5)}  ${bang.padEnd(24)} ${ly_do}`);
}
console.log(`  ${'─'.repeat(5)}\n  ${String(tong).padStart(5)}  TỔNG\n`);

console.log('LÀM MỚI OWNER (giữ email, tạo lại tài khoản; gỡ khoá RESTRICT mà không xoá bài)');
console.log(
  `  ${'1'.padStart(5)}  Owner cũ: nhường email cho Owner mới, rồi xoá cùng dòng users ở trên`,
);
console.log(
  `  ${'1'.padStart(5)}  Owner mới: cùng email, tên "${ownerCu.name ?? ''}", chưa mật khẩu, chưa phiên`,
);
const soBaiPhaiDoi = (
  await client.query('select count(*)::int as n from posts where author_id <> $1', [OWNER_MOI])
).rows[0].n;
console.log(`  ${String(soBaiPhaiDoi).padStart(5)}  posts.author_id → Owner mới\n`);

console.log('MỘT LỆNH CHUYỂN (ảnh review rời site cùng review, G22)');
const keHoachAnh = await docAnhReview();
console.log(
  `  ${String(keHoachAnh.publicIds.length).padStart(5)}  ảnh review: media_assets → hàng dọn media_garbage` +
    ` (${keHoachAnh.moiVaoHang} chưa có trong hàng)\n`,
);

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
  for (const bang of PHAI_CON) truoc.set(bang, await demPhaiCon(bang));

  // Làm mới Owner TRƯỚC mọi lệnh xoá: dòng `users` xoá ở cuối KE_HOACH sẽ vấp khoá
  // RESTRICT `posts.author_id` nếu bài còn trỏ dòng cũ. Email là citext unique nên dòng cũ
  // phải nhả email trước khi dòng mới nhận; đuôi `.invalid` dành riêng (RFC 2606), không
  // bao giờ nhận thư, và dòng cũ chỉ sống tới hết transaction này.
  await client.query('update users set email = $2 where id = $1', [
    OWNER_CU,
    `owner-cu-${OWNER_CU}@lam-moi.invalid`,
  ]);
  // Chép tên vì blog in tên tác giả dưới 9 bài; mọi thứ khác của tài khoản để trống.
  // `email_verified` phải bật: Better Auth chặn đăng nhập mật khẩu khi email chưa xác minh
  // (`requireEmailVerification`), mà lệnh đặt lại mật khẩu không tự bật cờ này.
  await client.query(
    `insert into users (id, email, name, email_verified, role, created_at, updated_at)
     values ($1, $2, $3, true, 'ADMIN', now(), now())`,
    [OWNER_MOI, ownerCu.email, ownerCu.name],
  );
  console.log(`  +${'1'.padStart(5)}  users: Owner mới cùng email (id ${OWNER_MOI})`);
  const { rowCount: doiTacGia } = await client.query(
    'update posts set author_id = $1 where author_id <> $1',
    [OWNER_MOI],
  );
  console.log(
    `  ~${String(doiTacGia).padStart(5)}  posts.author_id → Owner mới (gỡ RESTRICT, giữ nguyên uuid)`,
  );

  for (const [bang, where] of KE_HOACH) {
    const { rowCount } = await client.query(
      `delete from ${bang}${where ? ` where ${where}` : ''}`,
      where ? [OWNER_MOI] : [],
    );
    console.log(`  −${String(rowCount).padStart(5)}  ${bang}`);
  }

  // G22 — xem SQL_ANH_REVIEW ở trên. Đọc lại TRONG transaction, cùng lý do chụp `truoc`.
  const anh = await docAnhReview();
  const { rowCount: goAnh } = await client.query(
    "delete from media_assets where owner_type = 'REVIEW'",
  );
  await client.query(
    `insert into media_garbage (public_id, created_at)
     select unnest($1::text[]), now()
     on conflict (public_id) do update set created_at = now(), attempts = 0, last_error = null`,
    [anh.publicIds],
  );
  console.log(
    `  −${String(goAnh).padStart(5)}  media_assets ảnh review → hàng dọn (${anh.moiVaoHang} publicId mới vào hàng)`,
  );

  // Xoá sạch reviews mà để nguyên `tours.rating_avg`/`rating_count` là để lại
  // một lời nói dối có thể đọc được: card tour vẫn hô "4.5 · 12 đánh giá"
  // trong khi bảng reviews đã trống trơn. Bất biến bên dưới chỉ đếm SỐ DÒNG
  // của các bảng phải-còn, mà đây là sai ở mức GIÁ TRỊ trong một bảng không
  // hề mất dòng nào — nó không bao giờ bắt được, nên phải dọn tường minh.
  //
  // null/0 chứ không phải 0/0: đó đúng là nhánh "tour không có review" của
  // seed bước 6b và `ReviewsService.moderate` ③ (tri-state null ≠ 0 — web
  // phân biệt "chưa có đánh giá" với "có đánh giá, điểm 0"). Nhờ vậy chạy
  // seed ngay sau đây sẽ tính lại ra đúng cùng một thứ.
  const { rowCount: raRating } = await client.query(
    'update tours set rating_avg = null, rating_count = 0 where rating_avg is not null or rating_count <> 0',
  );
  console.log(`  ~${String(raRating).padStart(5)}  tours.rating_avg/rating_count → null/0`);

  // Bảng duy nhất được phép tăng là hàng dọn, và tăng đúng số ảnh review lần đầu vào hàng.
  const themDuKien = new Map([['media_garbage', anh.moiVaoHang]]);
  for (const bang of PHAI_CON) {
    const sau = await demPhaiCon(bang);
    const mongDoi = truoc.get(bang) + (themDuKien.get(bang) ?? 0);
    if (sau !== mongDoi) {
      throw new Error(
        `Bất biến vỡ: ${bang} có ${truoc.get(bang)} dòng trước, phải còn ${mongDoi}, còn ${sau} sau`,
      );
    }
  }

  // Bất biến của G22: không còn dòng ảnh review nào, và MỌI publicId vừa rời đều nằm trong
  // hàng dọn với đồng hồ đặt lại — sót một tấm là một file Cloudinary không còn ai theo dõi.
  // `now()` cố định suốt transaction, nhưng cột là timestamp(3) nên lúc ghi nó bị làm tròn
  // tới mili giây: so với `now()::timestamp(3)`, so thẳng với `now()` là luôn lệch (đã đo).
  const { rows: conAnhReview } = await client.query(
    "select count(*)::int as n from media_assets where owner_type = 'REVIEW'",
  );
  if (conAnhReview[0].n !== 0) throw new Error(`${conAnhReview[0].n} dòng ảnh review còn sót`);
  const { rows: trongHang } = await client.query(
    `select count(*)::int as n from media_garbage
     where public_id = any($1::text[]) and attempts = 0 and last_error is null
       and created_at = now()::timestamp(3)`,
    [anh.publicIds],
  );
  if (trongHang[0].n !== anh.publicIds.length) {
    throw new Error(
      `${anh.publicIds.length - trongHang[0].n}/${anh.publicIds.length} ảnh review không vào hàng dọn`,
    );
  }

  // Bất biến GIÁ TRỊ, khác họ với ba bất biến đếm dòng ở trên: không tour nào
  // được phép còn mang điểm đánh giá sau khi bảng reviews đã bị xoá trắng.
  const { rows: conRating } = await client.query(
    'select count(*)::int as n from tours where rating_avg is not null or rating_count <> 0',
  );
  if (conRating[0].n !== 0) {
    throw new Error(`${conRating[0].n} tour còn rating trong khi reviews đã trống`);
  }
  const moCoi = await demMoCoi();
  if (moCoi !== 0) throw new Error(`${moCoi} ảnh mồ côi — chủ sở hữu đã biến mất`);

  // Bất biến của lượt làm mới Owner: còn đúng một tài khoản, chính là dòng vừa chèn, mang
  // hình dạng một tài khoản mới tinh; không phiên, không dòng đăng nhập nào sống sót; không
  // bài nào trỏ đi đâu khác. Thiếu khối này thì một KE_HOACH sửa sai về sau (giữ lại phiên,
  // quên xoá dòng cũ) vẫn in COMMIT thành công.
  const { rows: conUser } = await client.query(
    'select id, email, role, email_verified, image, phone, locked_at, deleted_at from users',
  );
  if (conUser.length !== 1 || conUser[0].id !== OWNER_MOI) {
    throw new Error(`users phải còn đúng Owner mới, đang còn ${conUser.length} dòng`);
  }
  const moi = conUser[0];
  if (
    moi.email.toLowerCase() !== ownerCu.email.toLowerCase() ||
    moi.role !== 'ADMIN' ||
    moi.email_verified !== true ||
    moi.image !== null ||
    moi.phone !== null ||
    moi.locked_at !== null ||
    moi.deleted_at !== null
  ) {
    throw new Error(
      'Owner mới sai hình dạng: phải cùng email, ADMIN, đã xác minh, không avatar, không số điện thoại, không khoá',
    );
  }
  const { rows: sot } = await client.query(
    `select (select count(*) from sessions)::int as phien,
            (select count(*) from accounts)::int as dang_nhap,
            (select count(*) from posts where author_id <> $1)::int as bai`,
    [OWNER_MOI],
  );
  if (sot[0].phien !== 0 || sot[0].dang_nhap !== 0 || sot[0].bai !== 0) {
    throw new Error(
      `còn ${sot[0].phien} phiên, ${sot[0].dang_nhap} dòng accounts, ${sot[0].bai} bài không trỏ Owner mới`,
    );
  }

  await client.query('COMMIT');
  console.log(
    `\n✓ COMMIT — 0 ảnh mồ côi, ${anh.publicIds.length} ảnh review vào hàng dọn, mọi bất biến còn nguyên, Owner đã làm mới.`,
  );
  console.log(
    '  Owner mới chưa có mật khẩu: sau db:seed, đặt mật khẩu bằng "Forgot password?" ở trang đăng nhập admin.',
  );
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`\n✖ ROLLBACK: ${err.message}`);
  console.error('  Không một dòng nào bị xoá.');
  process.exitCode = 1;
}
await client.end();
