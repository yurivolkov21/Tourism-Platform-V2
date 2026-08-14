/**
 * Tải ảnh từ link user gửi vào đúng chỗ trong `media-inbox/`.
 *
 * Giải hai việc user phải làm tay: tải file rồi chép vào thư mục, và đặt lại
 * tên (ảnh tải về tên toàn ký tự ngẫu nhiên). Script đặt tên đúng chuẩn ngay
 * lúc ghi nên KHÔNG bao giờ phải đổi tên.
 *
 * ── Vì sao đường này hợp lệ với ADR-0020 ──
 * [ADR-0020 §2](../../docs/adr/0020-real-images-sourcing.md) loại **API
 * Unsplash** vì điều khoản API bắt buộc hotlink, mâu thuẫn với kiến trúc
 * rehost. Nhưng nó tách bạch rõ: **Unsplash License** (áp cho ảnh tải từ
 * website) *có* cho phép chép, sửa, phân phối — và ADR ghi hai file Unsplash
 * trong `public/mock/` là hợp lệ. Script này đi đường thứ hai: tải file rồi
 * rehost, KHÔNG gọi API, KHÔNG hotlink.
 *
 * ── Đo được 14/08, quyết định hình dạng của script ──
 * · `unsplash.com/photos/<id>`        → **401**, Unsplash chặn bot ở tầng trang
 * · `unsplash.com/photos/<id>/download` → 307 rồi cũng về 401
 * · `images.unsplash.com/photo-…`     → **200**, JPEG thật
 * Nên script CHỈ nhận link CDN ảnh, và nói thẳng khi nhận nhầm link trang —
 * im lặng bỏ qua là để user tưởng đã tải xong.
 *
 * ── Dùng ──
 * Sửa `media-inbox/LINKS.txt`, mỗi dòng:
 *
 *   <link ảnh> | <đích> | [tác giả] | [giấy phép]
 *
 *   https://images.unsplash.com/photo-abc | ha-giang/gallery
 *   https://images.unsplash.com/photo-def | ha-giang/tours/ha-giang-loop-4d/cover | Trần A
 *   https://images.unsplash.com/photo-ghi | _site/home-hero
 *
 * rồi `pnpm --filter @tourism/api media:fetch`. Chạy lại vô hại: dòng nào đã
 * tải rồi thì bỏ qua (đối chiếu link trong CREDITS.txt).
 */
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../media-inbox');
const LINKS = path.join(ROOT, 'LINKS.txt');
const IMAGE = /\.(jpe?g|webp|png)$/i;

/** Yêu cầu tối thiểu mỗi loại đích. Ảnh nhỏ hơn sẽ vỡ khi phóng lên hero. */
const MIN = {
  'site-slot': [1600, 600],
  destination: [1200, 800],
  cover: [1200, 800],
  gallery: [1200, 800],
};

const UA = 'Mozilla/5.0 (X11; Linux x86_64) tourism-v2 media-fetch';

/**
 * Kích thước ảnh đọc từ HEADER, không giải mã cả file.
 *
 * Cần thật: một link hỏng có thể trả trang lỗi 200 kèm `content-type` ảnh, và
 * "đã tải 7KB" trông y hệt thành công cho tới khi trang render ra ô vỡ.
 */
function dimensions(buf) {
  // PNG: IHDR ngay sau chữ ký 8 byte
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  // WebP: VP8X / VP8 / VP8L
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8X')
      return [(buf.readUIntLE(24, 3) & 0xffffff) + 1, (buf.readUIntLE(27, 3) & 0xffffff) + 1];
    if (fmt === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (fmt === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
  }
  // JPEG: đi theo chuỗi marker tới SOF
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function extensionOf(buf, contentType) {
  if (buf.toString('ascii', 1, 4) === 'PNG') return '.png';
  if (buf.toString('ascii', 0, 4) === 'RIFF') return '.webp';
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  return contentType?.includes('png') ? '.png' : '.jpg';
}

/** Đích user viết → nơi ghi file và kiểu kiểm tra. */
function resolveTarget(target) {
  const parts = target.split('/').filter(Boolean);
  if (parts[0] === '_site') {
    if (parts.length !== 2) return { error: 'khe thương hiệu phải có dạng `_site/<tên-khe>`' };
    return { dir: path.join(ROOT, '_site'), name: parts[1], kind: 'site-slot' };
  }
  // <địa danh>/gallery
  if (parts.length === 2 && parts[1] === 'gallery') {
    return { dir: path.join(ROOT, parts[0], 'gallery'), name: null, kind: 'gallery' };
  }
  // <địa danh>/destination
  if (parts.length === 2 && parts[1] === 'destination') {
    return { dir: path.join(ROOT, parts[0]), name: 'destination', kind: 'destination' };
  }
  // <địa danh>/tours/<tour>/cover | .../gallery
  if (parts.length === 4 && parts[1] === 'tours') {
    if (parts[3] === 'cover') {
      return { dir: path.join(ROOT, parts[0], 'tours', parts[2]), name: 'cover', kind: 'cover' };
    }
    if (parts[3] === 'gallery') {
      return {
        dir: path.join(ROOT, parts[0], 'tours', parts[2], 'gallery'),
        name: null,
        kind: 'gallery',
      };
    }
  }
  return { error: 'đích không nhận ra' };
}

/** Số thứ tự kế tiếp trong một thư mục gallery — giữ đúng thứ tự user thả vào. */
async function nextIndex(dir) {
  const files = await readdir(dir).catch(() => []);
  const used = files.filter((f) => IMAGE.test(f)).map((f) => Number.parseInt(f, 10) || 0);
  return String(Math.max(0, ...used) + 1).padStart(2, '0');
}

const raw = await readFile(LINKS, 'utf8').catch(() => null);
if (raw === null) {
  console.error(`\n✗ Chưa có ${path.relative(process.cwd(), LINKS)}.`);
  console.error('  Chạy `pnpm --filter @tourism/api media:tree` để sinh file mẫu.\n');
  process.exit(1);
}

const lines = raw
  .split('\n')
  .map((l, i) => ({ n: i + 1, text: l.trim() }))
  .filter((l) => l.text && !l.text.startsWith('#'));

if (lines.length === 0) {
  console.log(`\n[media-fetch] ${path.relative(process.cwd(), LINKS)} chưa có dòng nào.`);
  console.log('[media-fetch] Dán link ảnh vào đó rồi chạy lại.\n');
  process.exit(0);
}

/** Link đã tải rồi — đọc từ mọi CREDITS.txt để chạy lại không tải trùng. */
async function fetchedUrls() {
  const seen = new Set();
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name === 'CREDITS.txt') {
        for (const line of (await readFile(full, 'utf8')).split('\n')) {
          const src = line.split('|')[3]?.trim();
          if (src) seen.add(src);
        }
      }
    }
  }
  await walk(ROOT);
  return seen;
}
const already = await fetchedUrls();

let ok = 0;
let skipped = 0;
const problems = [];

for (const line of lines) {
  const [url, target, author, license] = line.text.split('|').map((s) => s.trim());

  if (!url || !target) {
    problems.push(`dòng ${line.n}: thiếu link hoặc đích`);
    continue;
  }
  // Nói thẳng khi nhận link TRANG: đo được nó trả 401, tải về sẽ ra file HTML
  // 7KB mà `content-type` vẫn nói là ảnh ở vài CDN — im lặng bỏ qua là để user
  // tưởng đã xong.
  if (/^https?:\/\/(www\.)?unsplash\.com\/photos\//.test(url)) {
    problems.push(
      `dòng ${line.n}: đây là link TRANG, Unsplash chặn (401). Chuột phải vào ảnh → ` +
        '"Sao chép địa chỉ hình ảnh" để lấy link `images.unsplash.com/…`',
    );
    continue;
  }
  if (already.has(url)) {
    skipped++;
    continue;
  }

  const resolved = resolveTarget(target);
  if (resolved.error) {
    problems.push(`dòng ${line.n}: ${resolved.error} — "${target}"`);
    continue;
  }
  // Thư mục phải CÓ SẴN trong cây: gõ sai slug mà script tự tạo thư mục thì ảnh
  // rơi vào một nơi không tour nào đọc, và không ai biết cho tới lúc quét.
  const exists = await stat(resolved.dir).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (!exists) {
    problems.push(`dòng ${line.n}: không có thư mục "${target}" trong cây — gõ sai slug?`);
    continue;
  }

  // DỰNG LẠI query thay vì nối thêm: link user copy từ Unsplash mang sẵn
  // `w`/`q`/`fit=crop`/`ixid`, nối thêm `&w=2400` thì kết quả phụ thuộc vào
  // việc imgix lấy tham số đầu hay cuối — và `fit=crop` còn cắt ảnh. Bỏ hết,
  // chỉ giữ đường dẫn ảnh rồi tự đặt kích thước.
  const sized = url.includes('images.unsplash.com')
    ? `${url.split('?')[0]}?w=2400&q=80&fm=jpg`
    : url;

  // Thử lại khi CDN lỗi 5xx: đo được imgix trả 500 nhất thời cho đúng link mà
  // ngay sau đó trả 200. Bắt user chạy lại vì một cú nấc của CDN là bắt sai
  // người — và ta sẽ kéo cỡ 67 tấm, xác suất gặp không nhỏ.
  let res = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(sized, { headers: { 'User-Agent': UA } }).catch((e) => ({
      ok: false,
      status: e.message,
    }));
    if (res.ok || !(typeof res.status === 'number' && res.status >= 500)) break;
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  if (!res.ok) {
    problems.push(`dòng ${line.n}: tải hỏng (${res.status}) sau 3 lần thử`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const dim = dimensions(buf);
  if (!dim) {
    problems.push(`dòng ${line.n}: tải về KHÔNG phải ảnh (${buf.length} byte)`);
    continue;
  }
  const [minW, minH] = MIN[resolved.kind];
  if (dim[0] < minW || dim[1] < minH) {
    problems.push(
      `dòng ${line.n}: ảnh ${dim[0]}×${dim[1]} nhỏ hơn mức tối thiểu ${minW}×${minH} cho ${resolved.kind}`,
    );
    continue;
  }

  const ext = extensionOf(buf, res.headers.get('content-type'));
  const name = (resolved.name ?? (await nextIndex(resolved.dir))) + ext;
  await mkdir(resolved.dir, { recursive: true });
  await writeFile(path.join(resolved.dir, name), buf);

  // Unsplash License KHÔNG bắt ghi công, nhưng ghi vẫn đúng và rẻ — và cột
  // nguồn là thứ giúp chạy lại không tải trùng.
  const credit = [
    name,
    author || 'Unsplash contributor',
    license || (url.includes('unsplash.com') ? 'Unsplash License' : 'unknown'),
    url,
  ].join(' | ');
  await appendFile(path.join(resolved.dir, 'CREDITS.txt'), `${credit}\n`, 'utf8');

  console.log(
    `  ✓ ${path.relative(ROOT, path.join(resolved.dir, name)).padEnd(52)} ${dim[0]}×${dim[1]}`,
  );
  ok++;
}

console.log(`\n[media-fetch] tải ${ok} ảnh · bỏ qua ${skipped} link đã có`);
if (problems.length) {
  console.log(`[media-fetch] ${problems.length} dòng có vấn đề:`);
  for (const p of problems) console.log(`   ✗ ${p}`);
}
console.log('[media-fetch] chạy `media:scan` để xem ảnh sẽ gắn vào đâu.\n');
