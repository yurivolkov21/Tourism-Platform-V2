/**
 * Quét `media-inbox/` và báo cáo — **KHÔNG upload, KHÔNG ghi DB** ở chế độ mặc định.
 *
 * Đây là "duyệt trước upload" mà [ADR-0020 bản sửa](../../docs/adr/0020-real-images-sourcing.md)
 * bắt buộc, dựng thành một bước chạy được: xem máy sẽ làm gì TRƯỚC khi nó làm.
 * Lần trước bảng duyệt dựng SAU khi đã đẩy 189 tấm lên CDN và ghi 256 row — sai
 * thứ tự nên dọn tốn gấp nhiều lần.
 *
 * Chạy:
 *   pnpm --filter @tourism/api media:scan          # chỉ báo cáo
 *   pnpm --filter @tourism/api media:scan -- --json  # xuất kế hoạch để bước upload đọc
 *
 * ── Luật rơi-về ──
 * Gallery của tour rơi về gallery của ĐỊA DANH khi tour chưa có ảnh riêng. Đây
 * là thứ làm cây sống được với số ảnh có hạn: một bộ ảnh Hội An phục vụ cả trang
 * địa danh lẫn 6 tour đi qua đó.
 *
 * Script này CỐ Ý không biết gì về Cloudinary. Nó chỉ trả lời "có gì trong cây,
 * ảnh nào thuộc về ai, còn thiếu chỗ nào" — bước upload là script riêng, đọc
 * `--json` của nó. Tách vậy để chạy quét bao nhiêu lần cũng vô hại.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dirname, '../../../media-inbox');
const IMAGE = /\.(jpe?g|webp|png)$/i;
const AS_JSON = process.argv.includes('--json');

const say = (...a) => {
  if (!AS_JSON) console.log(...a);
};

/** File ảnh trong một thư mục, sắp theo TÊN — tên quyết định thứ tự hiển thị. */
async function images(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isFile() && IMAGE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * `CREDITS.txt` cùng thư mục: mỗi dòng `tên-file | tác giả | giấy phép | link`.
 *
 * Ảnh CC BY/BY-SA thì ghi công là ĐIỀU KIỆN của giấy phép, không phải phép lịch
 * sự — nên thiếu dòng ghi công cho một file là cảnh báo, không phải im lặng.
 */
async function credits(dir) {
  const raw = await readFile(path.join(dir, 'CREDITS.txt'), 'utf8').catch(() => '');
  const map = new Map();
  for (const line of raw.split('\n')) {
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length < 3 || !parts[0] || parts[0].startsWith('#')) continue;
    map.set(parts[0], { author: parts[1], license: parts[2], source: parts[3] ?? null });
  }
  return map;
}

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism',
});
await client.connect();
const { rows: places } = await client.query(
  'SELECT id, slug, name FROM destinations ORDER BY slug',
);
const { rows: tours } = await client.query(
  `SELECT t.id, t.slug, t.title, d.slug AS place
     FROM tours t
     JOIN tour_destinations td ON td.tour_id = t.id AND td.is_primary = true
     JOIN destinations d ON d.id = td.destination_id
    WHERE t.is_published = true
    ORDER BY d.slug, t.slug`,
);
// Tổng số khe lấy từ DB chứ KHÔNG viết cứng: bảng đếm dưới kia từng ghi "/9"
// và con số đó lệch ngay khi khe thứ 10 (`about-hero`) ra đời. DB là nơi duy
// nhất biết đủ danh sách khe.
const { rows: slotRows } = await client.query('SELECT key FROM site_media_slots');
const { rows: posts } = await client.query(
  "SELECT id, slug, title FROM posts WHERE status = 'PUBLISHED' ORDER BY slug",
);
await client.end();

const plan = [];
const warn = [];
const missing = { slots: [], covers: [], places: [], galleries: [], posts: [] };

// ── 1. Khe thương hiệu ──
const siteDir = path.join(ROOT, '_site');
const siteFiles = await images(siteDir);
const siteCredits = await credits(siteDir);
for (const file of siteFiles) {
  const key = file.replace(IMAGE, '');
  plan.push({
    kind: 'site-slot',
    key,
    file: path.join(siteDir, file),
    credit: siteCredits.get(file) ?? null,
  });
}

// ── 2 + 3 + 5. Địa danh: ảnh đại diện và bộ ảnh chung ──
const placeGallery = new Map();
for (const place of places) {
  const dir = path.join(ROOT, place.slug);
  const credit = await credits(dir);
  const flat = await images(dir);
  const hero = flat.find((f) => f.replace(IMAGE, '') === 'destination');
  if (hero) {
    plan.push({
      kind: 'destination',
      ownerId: place.id,
      slug: place.slug,
      role: 'hero',
      file: path.join(dir, hero),
      credit: credit.get(hero) ?? null,
    });
  } else {
    missing.places.push(place.slug);
  }
  const galleryDir = path.join(dir, 'gallery');
  const gallery = await images(galleryDir);
  const galleryCredit = await credits(galleryDir);
  if (gallery.length === 0) missing.galleries.push(place.slug);
  const galleryItems = gallery.map((f) => ({
    file: path.join(galleryDir, f),
    credit: galleryCredit.get(f) ?? null,
  }));
  placeGallery.set(place.slug, galleryItems);
  // Duyệt trên `galleryItems` chứ KHÔNG trên `gallery`: `gallery` chỉ là mảng
  // TÊN file, nên `item.file` ở đó là undefined và kế hoạch mất đường dẫn.
  for (const [i, item] of galleryItems.entries()) {
    plan.push({
      kind: 'destination',
      ownerId: place.id,
      slug: place.slug,
      role: 'gallery',
      sortOrder: i,
      file: item.file,
      credit: item.credit,
    });
  }
}

// ── 4. Tour: cover bắt buộc, gallery tuỳ chọn (rơi về địa danh) ──
for (const tour of tours) {
  const dir = path.join(ROOT, tour.place, 'tours', tour.slug);
  const credit = await credits(dir);
  const flat = await images(dir);
  const cover = flat.find((f) => f.replace(IMAGE, '') === 'cover');
  if (cover) {
    plan.push({
      kind: 'tour',
      ownerId: tour.id,
      slug: tour.slug,
      role: 'hero',
      file: path.join(dir, cover),
      credit: credit.get(cover) ?? null,
    });
  } else {
    missing.covers.push(tour.slug);
  }
  const ownDir = path.join(dir, 'gallery');
  const own = await images(ownDir);
  const ownCredit = await credits(ownDir);
  const source =
    own.length > 0
      ? own.map((f) => ({ file: path.join(ownDir, f), credit: ownCredit.get(f) ?? null }))
      : (placeGallery.get(tour.place) ?? []);
  for (const [i, item] of source.entries()) {
    plan.push({
      kind: 'tour',
      ownerId: tour.id,
      slug: tour.slug,
      role: 'gallery',
      sortOrder: i,
      file: item.file,
      credit: item.credit,
      // Ghi lại để bước upload biết tấm này DÙNG CHUNG với địa danh — cùng
      // `publicId`, không upload hai lần.
      inherited: own.length === 0 && source.length > 0 ? tour.place : undefined,
    });
  }
}

// ── 6. Ảnh bìa bài viết ──
// Nhánh `posts/` KHÔNG nằm dưới địa danh: một bài có thể nói về nhiều nơi hoặc
// không nơi nào. Không có luật rơi-về ở đây — bài không có ảnh thì thẻ giữ chỗ.
for (const post of posts) {
  const dir = path.join(ROOT, 'posts', post.slug);
  const credit = await credits(dir);
  const flat = await images(dir);
  const cover = flat.find((f) => f.replace(IMAGE, '') === 'cover');
  if (cover) {
    plan.push({
      kind: 'post',
      ownerId: post.id,
      slug: post.slug,
      role: 'hero',
      file: path.join(dir, cover),
      credit: credit.get(cover) ?? null,
    });
  } else {
    missing.posts.push(post.slug);
  }
}

for (const key of ['home-hero', 'about-hero', 'about-story', 'auth-panel']) {
  if (!siteFiles.some((f) => f.startsWith(key))) missing.slots.push(key);
}

// Giấy phép: ảnh nào KHAI ghi công thì phải khai đủ tác giả + giấy phép.
// Gộp theo FILE, không theo chỗ gắn: một tấm gallery của địa danh xuất hiện ở
// mọi tour mượn nó, in cảnh báo mỗi lần là năm dòng nói về cùng một file.
const flagged = new Set();
for (const item of plan) {
  if (!item.credit || (item.credit.author && item.credit.license)) continue;
  const rel = path.relative(ROOT, item.file);
  if (flagged.has(rel)) continue;
  flagged.add(rel);
  warn.push(`${rel} — dòng CREDITS thiếu tác giả hoặc giấy phép`);
}

if (AS_JSON) {
  console.log(JSON.stringify({ plan, missing, warn }, null, 2));
  process.exit(0);
}

const uploads = plan.filter((p) => !p.inherited).length;
const reused = plan.length - uploads;

say(`\n[media-scan] cây: ${path.relative(process.cwd(), ROOT)}`);
say(
  `[media-scan] tìm thấy ${plan.length} chỗ gắn ảnh — ${uploads} file cần upload, ${reused} dùng lại ảnh địa danh\n`,
);

const rows = [
  ['Khe thương hiệu', siteFiles.length, slotRows.length],
  ['Cover tour', tours.length - missing.covers.length, tours.length],
  ['Ảnh địa danh', places.length - missing.places.length, places.length],
  ['Bộ gallery địa danh', places.length - missing.galleries.length, places.length],
  ['Ảnh bìa bài viết', posts.length - missing.posts.length, posts.length],
];
for (const [label, have, total] of rows) {
  const bar = '█'.repeat(Math.round((have / total) * 20)).padEnd(20, '·');
  say(`  ${label.padEnd(20)} ${bar} ${have}/${total}`);
}

if (missing.slots.length) say(`\n  ⚠ khe quan trọng còn trống: ${missing.slots.join(', ')}`);
if (missing.covers.length)
  say(
    `  ⚠ ${missing.covers.length} tour chưa có cover: ${missing.covers.slice(0, 5).join(', ')}${missing.covers.length > 5 ? '…' : ''}`,
  );
if (warn.length) {
  say('\n  Cảnh báo giấy phép:');
  for (const w of warn) say(`   · ${w}`);
}

say('\n[media-scan] CHƯA upload gì cả. Xem bảng trên, thấy ổn thì chạy bước upload.');
say('[media-scan] Thêm ảnh rồi quét lại lúc nào cũng được — chỗ trống bị bỏ qua, không lỗi.\n');
