/**
 * Sinh CÂY THẢ ẢNH cho user điền tay — `media-inbox/` ở gốc repo.
 *
 * Vì sao có script này thay vì tự đi tìm ảnh: [ADR-0020 bản sửa](../../docs/adr/0020-real-images-sourcing.md)
 * ra hai điều bắt buộc sau khi lô 189 ảnh tự động bị từ chối TOÀN BỘ — phải có
 * cửa lọc theo CHỦ THỂ (không chỉ vị trí), và **duyệt bằng mắt phải đứng TRƯỚC
 * upload**. Điều thứ hai nghĩa là khâu chọn ảnh không uỷ quyền cho máy được.
 * Nên máy làm phần máy làm được: dựng sẵn đúng chỗ để thả, ghi rõ mỗi chỗ cần
 * ảnh gì, rồi đứng yên.
 *
 * Cây KHÔNG vào git (`.gitignore`): ảnh nặng, và ảnh có giấy phép thì repo
 * không phải chỗ giữ. Chạy lại script là dựng lại cây, KHÔNG đụng file đã thả.
 *
 * ── Hình dạng và lý do ──
 *
 *   media-inbox/
 *     _site/                       9 khe thương hiệu, KHÔNG thuộc địa danh nào
 *       home-hero.jpg              (`home-hero` là tấm nhiều lượt nhìn nhất site)
 *     hoi-an/                      slug ĐỊA DANH
 *       destination.jpg            1 tấm cho /destinations
 *       gallery/                   DÙNG CHUNG cho mọi tour đi qua đây
 *       tours/hoi-an-lantern-evening/
 *         cover.jpg                ảnh đại diện tour
 *         gallery/                 chỉ khi tour cần ảnh riêng
 *
 * Địa danh làm thư mục cha vì đó là cách người chụp ảnh nghĩ ("ảnh Hội An"),
 * còn DB thì khoá ảnh theo CHỦ SỞ HỮU (tour/địa danh/bài). Hai cách nhìn khác
 * nhau, nên tầng `tours/<slug>/` bên trong địa danh là chỗ nối chúng lại.
 *
 * **Luật rơi-về** là thứ làm cây này sống được với số ảnh có hạn: gallery của
 * tour rơi về gallery của địa danh khi tour chưa có ảnh riêng. Một bộ ảnh Hội
 * An tử tế phục vụ cả trang địa danh LẪN 6 tour đi qua đó — không có luật này
 * thì 30 tour × 8 ảnh = 240 tấm phải tự tìm.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(import.meta.dirname, '../../../media-inbox');

/** Chín khe brand-chrome — bản sao danh sách trong `prisma/seed.ts`. */
const SITE_SLOTS = [
  [
    'home-hero',
    'Ảnh lớn đầu trang chủ. Tấm nhiều lượt nhìn nhất cả site.',
    '2400×1350 (16:9), ngang',
  ],
  ['home-experiences', 'Nền khối "trải nghiệm" ở trang chủ.', '1600×900, ngang'],
  ['home-why-choose', 'Nền khối "vì sao chọn chúng tôi".', '1600×900, ngang'],
  ['home-trust', 'Nền dải uy tín ở trang chủ.', '1600×900, ngang'],
  ['cta-band', 'Nền dải kêu gọi hành động, dùng lại ở nhiều trang.', '2000×800, rất ngang'],
  ['content-hero', 'Ảnh đầu các trang nội dung dài (pháp lý, FAQ).', '1600×600, ngang'],
  ['destinations-hero', 'Ảnh đầu trang /destinations.', '2400×1000, rất ngang'],
  ['auth-panel', 'Cột ảnh cạnh form đăng nhập/đăng ký.', '1200×1600, DỌC'],
  ['about-story', 'Ảnh trong khối kể chuyện ở /about.', '1600×1200, ngang'],
];

const README_SITE = `# Chín khe thương hiệu

Ảnh ở đây KHÔNG thuộc địa danh nào — chúng là mặt tiền của site.

Đặt tên file đúng khoá dưới đây, đuôi \`.jpg\` hoặc \`.webp\`. Thiếu tấm nào thì
chỗ đó giữ \`ImagePlaceholder\`, không vỡ gì.

| File | Dùng ở đâu | Cỡ tối thiểu |
| --- | --- | --- |
${SITE_SLOTS.map(([k, why, size]) => `| \`${k}.jpg\` | ${why} | ${size} |`).join('\n')}
`;

const readmePlace = (slug, name, tours, passing) => `# ${name}

Slug địa danh: \`${slug}\` · **${passing}** tour đi qua đây, trong đó **${tours.length}**
lấy nơi này làm điểm đến chính.

## Cần gì ở thư mục này

| Chỗ | File | Dùng ở đâu | Cỡ tối thiểu |
| --- | --- | --- | --- |
| Ảnh địa danh | \`destination.jpg\` | \`/destinations\` và trang miền | 1600×1200, ngang |
| Bộ ảnh chung | \`gallery/01.jpg\`, \`02.jpg\`… | Gallery của **mọi tour** đi qua đây | 1600×1200 mỗi tấm |

**Bộ \`gallery/\` là chỗ đáng đầu tư nhất.** Nhờ luật rơi-về, cả ${passing} tour đi
qua đây đều dùng chung nó khi chưa có ảnh riêng — bỏ 6–8 tấm vào đây lợi hơn
nhiều so với rải mỗi tour một tấm.

## Tour lấy nơi này làm điểm đến chính

${tours.map((t) => `- \`tours/${t.slug}/\` — ${t.title}`).join('\n')}

Mỗi tour chỉ **bắt buộc** một tấm \`cover.jpg\`. Thư mục \`gallery/\` bên trong
tour chỉ cần khi tour đó phải có ảnh riêng, khác với ảnh chung của địa danh.
`;

const readmeTour = (tour, place) => `# ${tour.title}

Slug tour: \`${tour.slug}\` · địa danh chính: \`${place}\`

| Chỗ | File | Dùng ở đâu | Cỡ tối thiểu |
| --- | --- | --- | --- |
| Ảnh đại diện | \`cover.jpg\` | \`/tours\` · trang chủ · "You might also like" · wishlist · checkout · hộ chiếu · ảnh lớn trang chi tiết | 1600×1200, ngang |
| Ảnh riêng | \`gallery/01.jpg\`… | Gallery trang chi tiết — **chỉ khi** tour này cần ảnh khác với ảnh chung của \`${place}\` | 1600×1200 mỗi tấm |

\`cover.jpg\` là tấm đáng ưu tiên nhất của tour: nó chạm nhiều màn hình hơn mọi
ảnh khác. Bỏ trống \`gallery/\` là bình thường — gallery sẽ rơi về bộ ảnh chung
của địa danh.
`;

const LINKS_TEMPLATE = `# Dán link ảnh vào đây, mỗi dòng một tấm, rồi chạy:
#   pnpm --filter @tourism/api media:fetch
#
# Khuôn:  <link ảnh> | <đích> | [tác giả] | [giấy phép]
#
# ⚠ Phải là link ẢNH (\`images.unsplash.com/photo-…\`), KHÔNG phải link TRANG
#   (\`unsplash.com/photos/…\`) — trang bị Unsplash chặn, đo được HTTP 401.
#   Lấy link ảnh: chuột phải vào ảnh → "Sao chép địa chỉ hình ảnh".
#
# Đích viết được:
#   _site/home-hero                                  khe thương hiệu
#   ha-giang/destination                             ảnh địa danh
#   ha-giang/gallery                                 bộ ảnh chung (tự đánh số 01, 02…)
#   ha-giang/tours/ha-giang-loop-4d/cover            ảnh đại diện tour
#   ha-giang/tours/ha-giang-loop-4d/gallery          ảnh riêng của tour
#
# Ví dụ:
# https://images.unsplash.com/photo-1528181304800-259b08848526 | ha-giang/gallery
# https://images.unsplash.com/photo-1528181304800-259b08848526 | _site/home-hero | Tên tác giả
`;

const ROOT_README = (counts) => `# media-inbox — chỗ thả ảnh

Thư mục này **không vào git**. Thả ảnh vào đúng chỗ rồi báo để chạy bước quét +
upload; script quét **bỏ qua thư mục rỗng**, nên bổ sung dần bao nhiêu lần cũng
được.

## Ưu tiên — xếp theo số màn hình một tấm ảnh chạm tới

| Hạng | Ảnh | Số tấm | Xuất hiện ở |
| --- | --- | --- | --- |
| 1 | Khe thương hiệu (\`_site/\`) | ${counts.slots} | Trang chủ, /about, màn đăng nhập |
| 2 | \`cover.jpg\` của tour | ${counts.tours} | /tours · trang chủ · gợi ý · wishlist · checkout · hộ chiếu · hero chi tiết |
| 3 | \`destination.jpg\` | ${counts.places} | /destinations và 3 trang miền |
| 4 | Ảnh bài viết (chưa dựng cây — làm sau) | ${counts.posts} | /blog |
| 5 | \`gallery/\` của địa danh | ${counts.places} bộ | Gallery trang chi tiết tour (nhờ luật rơi-về, phủ hết ${counts.tours} tour) |

**${counts.slots + counts.tours + counts.places + counts.posts} tấm** cho bốn hạng đầu là đủ để site hết vẻ bản nháp.

## Quy ước

- Đuôi \`.jpg\`, \`.jpeg\`, \`.webp\`, \`.png\` đều nhận. Ảnh ngang trừ \`auth-panel\` (dọc).
- Trong \`gallery/\`, **tên file quyết định thứ tự** — đặt \`01\`, \`02\`, \`03\`…
- Ảnh cần ghi công (Wikimedia Commons, ảnh CC) thì ghi vào \`CREDITS.txt\` **đặt
  CÙNG thư mục với ảnh** — ảnh trong \`gallery/\` thì file ghi công cũng phải nằm
  trong \`gallery/\`. Mỗi dòng một file:
  \`tên-file | tác giả | giấy phép | link nguồn\`. Ảnh tự chụp hoặc ảnh mua thì bỏ qua.
- **Không cắt cúp ảnh ShareAlike** (ADR-0020 mục 4) — thả nguyên bản.

## Chỗ chưa có ảnh thì sao

Không sao cả. Toàn site đang chạy \`ImagePlaceholder\` và sẽ tiếp tục chạy ở
đúng những chỗ còn trống — không có màn nào vỡ vì thiếu ảnh.
`;

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism',
});
await client.connect();

const { rows: places } = await client.query(
  `SELECT d.slug, d.name,
          count(td.tour_id) FILTER (WHERE t.is_published) ::int AS passing
     FROM destinations d
     LEFT JOIN tour_destinations td ON td.destination_id = d.id
     LEFT JOIN tours t ON t.id = td.tour_id
    GROUP BY d.id, d.slug, d.name
    ORDER BY d.slug`,
);

// Tour đi qua NHIỀU địa danh nhưng chỉ có MỘT `isPrimary`. Thư mục của tour nằm
// ở địa danh chính để mỗi tour có đúng một chỗ, không phải chọn giữa hai bản sao.
const { rows: primary } = await client.query(
  `SELECT t.slug AS tour, t.title, d.slug AS place
     FROM tours t
     JOIN tour_destinations td ON td.tour_id = t.id AND td.is_primary = true
     JOIN destinations d ON d.id = td.destination_id
    WHERE t.is_published = true
    ORDER BY d.slug, t.slug`,
);
const { rows: postCount } = await client.query('SELECT count(*)::int AS n FROM posts');
await client.end();

/** Ghi file chỉ khi CHƯA có — không bao giờ đè thứ user đã sửa hoặc đã thả. */
async function put(file, body) {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const existing = await readdir(dir);
  if (existing.includes(path.basename(file))) return false;
  await writeFile(file, body, 'utf8');
  return true;
}

const byPlace = new Map();
for (const row of primary) {
  if (!byPlace.has(row.place)) byPlace.set(row.place, []);
  byPlace.get(row.place).push({ slug: row.tour, title: row.title });
}

let dirs = 0;
let files = 0;

await mkdir(path.join(ROOT, '_site'), { recursive: true });
dirs++;
if (await put(path.join(ROOT, '_site', 'NEEDED.md'), README_SITE)) files++;

for (const place of places) {
  const tours = byPlace.get(place.slug) ?? [];
  const base = path.join(ROOT, place.slug);
  await mkdir(path.join(base, 'gallery'), { recursive: true });
  dirs += 2;
  if (
    await put(
      path.join(base, 'NEEDED.md'),
      readmePlace(place.slug, place.name, tours, place.passing),
    )
  )
    files++;
  for (const tour of tours) {
    const tourDir = path.join(base, 'tours', tour.slug);
    await mkdir(tourDir, { recursive: true });
    dirs++;
    if (await put(path.join(tourDir, 'NEEDED.md'), readmeTour(tour, place.slug))) files++;
  }
}

const counts = {
  slots: SITE_SLOTS.length,
  places: places.length,
  tours: primary.length,
  posts: postCount[0].n,
};
if (await put(path.join(ROOT, 'README.md'), ROOT_README(counts))) files++;
if (await put(path.join(ROOT, 'LINKS.txt'), LINKS_TEMPLATE)) files++;

console.log(`[media-tree] cây ở ${path.relative(process.cwd(), ROOT)}`);
console.log(`[media-tree] ${dirs} thư mục · ${files} file hướng dẫn mới`);
console.log(
  `[media-tree] cần: ${counts.slots} khe site · ${counts.tours} cover tour · ` +
    `${counts.places} ảnh địa danh · ${counts.places} bộ gallery`,
);
console.log('[media-tree] chạy lại lúc nào cũng được — KHÔNG đè file đã có.');
