/**
 * Đẩy ảnh trong `media-inbox/` lên Cloudinary rồi ghi `MediaAsset`.
 *
 * Bước CUỐI của quy trình A8, chạy SAU khi `media:scan` cho bảng ưng ý —
 * [ADR-0020 bản sửa](../../docs/adr/0020-real-images-sourcing.md) bắt buộc
 * duyệt bằng mắt đứng trước upload, và tách hai script chính là cách dựng ràng
 * buộc đó thành quy trình chứ không phải lời dặn.
 *
 *   pnpm --filter @tourism/api media:upload            # thật
 *   pnpm --filter @tourism/api media:upload -- --dry   # chỉ in kế hoạch
 *
 * ── Ba luật ──
 *
 * 1. **`publicId` suy từ ĐÍCH, không phải từ tên file.** Cùng một ảnh chạy lại
 *    lần hai ghi đè đúng asset cũ trên Cloudinary thay vì đẻ bản sao. Đây là lý
 *    do dùng `overwrite: true` + `public_id` cố định thay vì để Cloudinary tự
 *    sinh tên.
 * 2. **Ảnh mượn (luật rơi-về) KHÔNG upload lại.** Gallery tour mượn ảnh địa
 *    danh dùng chung `publicId`; DB vẫn ghi một row `MediaAsset` riêng cho tour
 *    vì owner khác nhau, nhưng file trên CDN chỉ có một.
 * 3. **Ghi DB là upsert theo (ownerType, ownerId, publicId).** Chạy lại không
 *    nhân bản row, và sửa ghi công trong CREDITS.txt rồi chạy lại thì row được
 *    cập nhật.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import cloudinary from 'cloudinary';
import pg from 'pg';

const DRY = process.argv.includes('--dry');
const HERE = import.meta.dirname;
const run = promisify(execFile);

const {
  CLOUDINARY_CLOUD_NAME: CLOUD,
  CLOUDINARY_API_KEY: KEY,
  CLOUDINARY_API_SECRET: SECRET,
  CLOUDINARY_UPLOAD_FOLDER: ROOT_FOLDER,
} = process.env;

if (!DRY && !(CLOUD && KEY && SECRET)) {
  console.error('\n✗ Thiếu CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET trong .env.local\n');
  process.exit(1);
}
cloudinary.v2.config({ cloud_name: CLOUD, api_key: KEY, api_secret: SECRET, secure: true });

// Lấy kế hoạch từ chính `media:scan` thay vì quét lại — một nguồn sự thật, và
// thứ user đã duyệt trên bảng đúng là thứ được upload.
const { stdout } = await run('node', [path.join(HERE, 'media-scan.mjs'), '--json'], {
  env: process.env,
  maxBuffer: 32 * 1024 * 1024,
});
const { plan } = JSON.parse(stdout.slice(stdout.indexOf('{')));

if (plan.length === 0) {
  console.log('\n[media-upload] cây chưa có ảnh nào. Thả ảnh rồi chạy `media:scan` trước.\n');
  process.exit(0);
}

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism',
});
await client.connect();

/** Khe brand-chrome khoá theo `key`; owner của asset là id của chính row slot. */
const { rows: slotRows } = await client.query('SELECT id, key FROM site_media_slots');
const slotId = new Map(slotRows.map((r) => [r.key, r.id]));

const OWNER = { 'site-slot': 'SITE', destination: 'DESTINATION', tour: 'TOUR' };

/** `publicId` ổn định, suy từ đích — chạy lại là ghi đè đúng chỗ. */
function publicIdFor(item) {
  const folder = ROOT_FOLDER ? `${ROOT_FOLDER}/catalog` : 'catalog';
  if (item.kind === 'site-slot') return `${folder}/site/${item.key}`;
  const order = item.role === 'gallery' ? `-${String(item.sortOrder + 1).padStart(2, '0')}` : '';
  return `${folder}/${item.kind}/${item.slug}/${item.role}${order}`;
}

let uploaded = 0;
let reused = 0;
let rows = 0;
const failures = [];
/** file gốc → publicId đã upload, để ảnh mượn không đẩy lên lần hai. */
const uploadedFiles = new Map();
/** file gốc → version Cloudinary trả về, để ảnh MƯỢN ghi đúng version bản gốc. */
const uploadedVersion = new Map();

for (const item of plan) {
  const ownerType = OWNER[item.kind];
  const ownerId = item.kind === 'site-slot' ? slotId.get(item.key) : item.ownerId;
  if (!ownerId) {
    failures.push(`${item.key ?? item.slug}: không tìm thấy owner trong DB`);
    continue;
  }

  // Ảnh mượn dùng lại publicId của bản gốc — file trên CDN chỉ có một.
  let publicId = uploadedFiles.get(item.file);
  let meta = null;

  if (!publicId) {
    publicId = publicIdFor(item);
    if (DRY) {
      console.log(`  [dry] ${path.basename(item.file).padEnd(20)} → ${publicId}`);
    } else {
      try {
        const res = await cloudinary.v2.uploader.upload(item.file, {
          public_id: publicId,
          overwrite: true,
          // `overwrite` MỘT MÌNH là chưa đủ: nó thay file trong kho Cloudinary
          // nhưng KHÔNG đụng tới bản dựng sẵn đang nằm ở CDN biên, nên thay ảnh
          // xong URL vẫn phát bản cũ. Đo được 14/08: đổi ảnh cover Hạ Long,
          // upload báo thành công, `publicId` đúng, mà CDN vẫn trả đúng kích
          // thước tấm cũ (2816×2112 thay vì 2400×1600). Người xem tưởng script
          // hỏng, thực ra là cache biên.
          invalidate: true,
          resource_type: 'image',
        });
        meta = res;
        uploaded++;
      } catch (e) {
        failures.push(`${path.relative(process.cwd(), item.file)}: ${e.message}`);
        continue;
      }
    }
    uploadedFiles.set(item.file, publicId);
    if (meta?.version) uploadedVersion.set(item.file, meta.version);
  } else {
    reused++;
  }

  if (DRY) continue;

  // Upsert theo (owner_type, owner_id, public_id): chạy lại không nhân bản row,
  // và sửa ghi công rồi chạy lại thì row được cập nhật.
  await client.query(
    `INSERT INTO media_assets
       (id, public_id, type, owner_type, owner_id, role, format, width, height, bytes,
        sort_order, alt, author, license, source_url, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'IMAGE', $2::"MediaOwnerType", $3, $4::"MediaRole",
             $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
     ON CONFLICT (owner_type, owner_id, public_id) DO UPDATE
       SET role = EXCLUDED.role, sort_order = EXCLUDED.sort_order, alt = EXCLUDED.alt,
           author = EXCLUDED.author, license = EXCLUDED.license,
           source_url = EXCLUDED.source_url,
           -- Số đo cũng PHẢI cập nhật ở nhánh này. Thay ảnh đi qua DO UPDATE,
           -- nên bỏ sót mấy cột này thì DB giữ kích thước của ảnh CŨ trong khi
           -- URL đã trỏ ảnh mới — sai lệch câm, không có gì báo. Đo được 14/08:
           -- cover Hạ Long còn ghi 2816×2112/1674KB của tấm Commons đã bị thay,
           -- trong khi ảnh thật là 2400×1600. COALESCE để ảnh MƯỢN (không có
           -- meta vì không upload lại) không xoá mất số đo đang đúng.
           format = COALESCE(EXCLUDED.format, media_assets.format),
           width = COALESCE(EXCLUDED.width, media_assets.width),
           height = COALESCE(EXCLUDED.height, media_assets.height),
           bytes = COALESCE(EXCLUDED.bytes, media_assets.bytes),
           -- Version PHẢI cập nhật ở nhánh DO UPDATE: chạy lại vì THAY ảnh là
           -- lúc cần nó nhất, mà nhánh này chính là đường đi của lần chạy lại.
           -- Giữ version cũ ở đây thì URL không đổi và mọi tầng cache vẫn phát
           -- ảnh cũ — đúng cái cột này sinh ra để tránh.
           version = COALESCE(EXCLUDED.version, media_assets.version),
           updated_at = now()`,
    [
      publicId,
      ownerType,
      ownerId,
      item.role ?? 'hero',
      meta?.format ?? null,
      meta?.width ?? null,
      meta?.height ?? null,
      meta?.bytes ?? null,
      item.sortOrder ?? 0,
      null,
      item.credit?.author ?? null,
      item.credit?.license ?? null,
      item.credit?.source ?? null,
      // Ảnh MƯỢN (luật rơi-về) không có `meta` vì không upload lại — nhưng nó
      // dùng chung publicId với bản gốc nên phiên bản cũng phải là của bản gốc.
      (meta?.version ?? uploadedVersion.get(item.file))?.toString() ?? null,
    ],
  );
  rows++;
}

await client.end();

console.log(
  DRY
    ? `\n[media-upload] --dry: ${plan.length} chỗ gắn, KHÔNG upload gì.\n`
    : `\n[media-upload] upload ${uploaded} file · dùng lại ${reused} · ghi ${rows} row MediaAsset`,
);
if (failures.length) {
  console.log(`[media-upload] ${failures.length} lỗi:`);
  for (const f of failures) console.log(`   ✗ ${f}`);
}
if (!DRY) {
  console.log('[media-upload] build lại web để trang SSG nhận ảnh mới.');
  // THAY ảnh (cùng publicId, nội dung khác) có hai tầng cache phải qua, và cả
  // hai đều IM LẶNG. `invalidate: true` ở trên xử tầng CDN, nhưng nó lan không
  // đều giữa các node biên — đo được 14/08: CDN đã trả ảnh mới rồi mà lát sau
  // Next fetch vẫn nhận bản cũ. Next lưu đúng cái nó nhận vào
  // `.next/cache/images` và giữ theo `minimumCacheTTL`, nên một lần fetch trúng
  // bản cũ là trang kẹt ảnh cũ rất lâu dù CDN đã sạch.
  console.log(
    '[media-upload] Nếu vừa THAY ảnh cho một publicId đã có: đợi CDN lan (~1–3 phút),\n' +
      '               rồi `rm -rf apps/web/.next/cache/images` TRƯỚC khi build —\n' +
      '               không thì Next phát lại bản cũ nó đã cache.\n',
  );
}
