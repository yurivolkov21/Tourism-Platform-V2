/**
 * Ghi `alt` vào `media_assets` từ fixture `prisma/fixtures/media/alt-text.ts`.
 *
 *   pnpm --filter @tourism/api media:alt          # chỉ in kế hoạch (mặc định)
 *   pnpm --filter @tourism/api media:alt -- --apply
 *
 * ── Vì sao là script riêng chứ không nằm trong seed ──
 * `seed.ts` không đụng tới `media_assets` dòng nào — bảng đó do bộ `media:*`
 * dựng nên (scan → fetch → upload). Đợt làm mới dữ liệu 09/09 cũng GIỮ NGUYÊN
 * bảng ảnh để không mồ côi ảnh trên Cloudinary. Nên việc ở đây là UPDATE dòng
 * sẵn có, không phải tạo mới — đúng chỗ của một script vận hành.
 *
 * ── Vì sao khoá theo `public_id` ──
 * Gallery tour MƯỢN ảnh địa danh: 276 dòng tour dùng chung 137 publicId với
 * gallery địa danh. Alt tả NỘI DUNG ảnh nên phải giống nhau ở mọi chỗ treo —
 * một dòng fixture phủ hết các dòng dùng chung, không bao giờ lệch.
 *
 * ── Chạy lại được ──
 * `alt IS DISTINCT FROM $2` nên lần chạy thứ hai cập nhật 0 dòng. Fixture viết
 * dở nửa chừng cũng không sao: áp được bao nhiêu key thì áp bấy nhiêu, phần
 * chưa có vẫn NULL và web rơi về suy alt từ chủ sở hữu như trước.
 */

import path from 'node:path';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const CHO_PHEP_PROD = process.argv.includes('--toi-biet-day-la-production');

const { altText } = await import(
  path.join(import.meta.dirname, '..', 'prisma', 'fixtures', 'media', 'alt-text.ts')
);

const KEYS = Object.keys(altText);
if (KEYS.length === 0) {
  console.error('\n✗ Fixture rỗng — không có gì để áp.\n');
  process.exit(1);
}

// Alt rỗng/quá dài là lỗi dữ liệu, chặn trước khi chạm DB.
const HONG = KEYS.filter((k) => {
  const v = altText[k];
  return typeof v !== 'string' || v.trim().length < 20 || v.length > 300;
});
if (HONG.length > 0) {
  console.error(`\n✗ ${HONG.length} alt không đạt (rỗng, quá ngắn <20 hoặc quá dài >300):`);
  for (const k of HONG) console.error('  -', k);
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const host = new URL(url).host;
const LA_PROD = /supabase\.(com|co)$/i.test(host.split(':')[0]);

if (LA_PROD && APPLY && !CHO_PHEP_PROD) {
  console.error(`
✗ Đích là Supabase (${host}) — hạ tầng SỐNG.

  CLAUDE.md §15: session thi công không tự ghi lên hạ tầng sống. Bước này
  thuộc session merge, sau review. Nếu bạn CHỦ ĐÍCH chạy lên prod, thêm cờ:

      --apply --toi-biet-day-la-production
`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

console.log(`\n[alt] đích: ${host}`);
console.log(`[alt] fixture: ${KEYS.length} publicId\n`);

const { rows: truoc } = await client.query(
  'SELECT count(*)::int AS tong, count(alt)::int AS co_alt FROM media_assets',
);
console.log(`[alt] trước: ${truoc[0].co_alt}/${truoc[0].tong} dòng đã có alt`);

// Key không khớp dòng nào = fixture lệch DB (ảnh bị xoá hoặc gõ sai publicId).
const { rows: lac } = await client.query(
  `SELECT k FROM unnest($1::text[]) AS k
    WHERE NOT EXISTS (SELECT 1 FROM media_assets m WHERE m.public_id = k)`,
  [KEYS],
);
if (lac.length > 0) {
  console.error(`\n✗ ${lac.length} key không khớp dòng nào trong media_assets:`);
  for (const r of lac) console.error('  -', r.k);
  console.error('\n  Sửa fixture rồi chạy lại — dừng để không áp dữ liệu lệch.\n');
  await client.end();
  process.exit(1);
}

const { rows: seDoi } = await client.query(
  `SELECT count(*)::int AS n
     FROM media_assets m
     JOIN unnest($1::text[], $2::text[]) AS f(k, v) ON f.k = m.public_id
    WHERE m.alt IS DISTINCT FROM f.v`,
  [KEYS, KEYS.map((k) => altText[k])],
);
console.log(`[alt] sẽ đổi: ${seDoi[0].n} dòng`);

if (!APPLY) {
  console.log('\n[alt] CHẠY KHÔ — chưa ghi gì. Thêm --apply để ghi thật.\n');
  await client.end();
  process.exit(0);
}

await client.query('BEGIN');
const { rowCount } = await client.query(
  `UPDATE media_assets m
      SET alt = f.v
     FROM unnest($1::text[], $2::text[]) AS f(k, v)
    WHERE m.public_id = f.k AND m.alt IS DISTINCT FROM f.v`,
  [KEYS, KEYS.map((k) => altText[k])],
);

const { rows: sau } = await client.query(
  'SELECT count(*)::int AS tong, count(alt)::int AS co_alt FROM media_assets',
);
if (sau[0].co_alt < truoc[0].co_alt) {
  await client.query('ROLLBACK');
  console.error('\n✗ Số dòng có alt GIẢM sau khi chạy — rollback.\n');
  await client.end();
  process.exit(1);
}
await client.query('COMMIT');

console.log(`[alt] đã ghi: ${rowCount} dòng`);
console.log(`[alt] sau:   ${sau[0].co_alt}/${sau[0].tong} dòng đã có alt`);
console.log(`[alt] còn trống: ${sau[0].tong - sau[0].co_alt} dòng\n`);

await client.end();
