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
 *   backups/<ngày>/         → gitignored: dữ liệu người dùng, booking, thanh toán
 * Trộn hai thứ là đẩy email của 63 người lên GitHub công khai.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NGAY = new Date().toISOString().slice(0, 10);

// Bảng KHÔNG chứa PII — an toàn để commit, và là thứ cần để nối lại ảnh.
const CONG_KHAI = {
  // `select *` có chủ ý: hai bảng này không có cột PII nào (đã đối chiếu
  // information_schema), và liệt kê tay từng cột là tự chuốc rủi ro sót cột mới
  // thêm sau này — mà sót một cột ở đây là mất một mảnh bản đồ nối ảnh.
  'media-assets': 'select * from media_assets order by owner_type, owner_id, role, sort_order',
  'site-media-slots': 'select * from site_media_slots order by key',
  // Ba bảng dưới CHỈ lấy id + slug + nhãn: đủ để nối lại ảnh theo slug, không
  // kéo theo nội dung biên tập (nội dung đầy đủ nằm ở bản backups/ riêng tư).
  'tours-ids': 'select id, slug, title, is_published from tours order by slug',
  'destinations-ids': 'select id, slug, name, region from destinations order by slug',
  'posts-ids': 'select id, slug, title, status, published_at from posts order by slug',
  'tour-categories-ids': 'select id, slug, name from tour_categories order by slug',
};

// Có PII hoặc dữ liệu giao dịch — CHỈ để local, không bao giờ commit.
const RIENG_TU = {
  // `select *` + `order by 1`: đây là BẢN SAO LƯU, không phải báo cáo — liệt kê
  // cột hay đoán tên cột sắp xếp chỉ tạo chỗ để sai. `order by 1` (cột đầu) hợp lệ
  // với mọi bảng, kể cả bảng nối không có `id` hay `created_at`.
  users: 'select * from users order by 1',
  accounts: 'select * from accounts order by 1',
  sessions: 'select * from sessions order by 1',
  verifications: 'select * from verifications order by 1',
  bookings: 'select * from bookings order by 1',
  payment_events: 'select * from payment_events order by 1',
  refunds: 'select * from refunds order by 1',
  cancellation_requests: 'select * from cancellation_requests order by 1',
  reviews: 'select * from reviews order by 1',
  review_moderation_events: 'select * from review_moderation_events order by 1',
  wishlist: 'select * from wishlist order by 1',
  enquiries: 'select * from enquiries order by 1',
  subscribers: 'select * from subscribers order by 1',
  outbox: 'select * from outbox order by 1',
  tour_departures: 'select * from tour_departures order by 1',
  posts: 'select * from posts order by 1',
  post_tags: 'select * from post_tags order by 1',
  post_tag_links: 'select * from post_tag_links order by 1',
};

const url = process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const host = new URL(url).host;
console.log(`Nối tới: ${host}\n`);

const client = new pg.Client({ connectionString: url });
await client.connect();

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

console.log(`\nbackups/${NGAY}/  (gitignored — có PII)`);
const nRieng = await xuat(join(ROOT, 'backups', NGAY), RIENG_TU);

console.log(`\n✓ Tổng ${nCongKhai + nRieng} dòng (${nCongKhai} công khai, ${nRieng} riêng tư)`);
await client.end();
