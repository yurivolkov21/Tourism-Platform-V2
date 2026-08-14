/**
 * Chặn `next build` khi đang có server Next phục vụ từ CÙNG thư mục `.next`.
 *
 * ── Vì sao cần ──
 * Build đè lên `.next` trong lúc một tiến trình khác đang serve từ đó làm hỏng
 * thư mục build **một cách IM LẶNG**: `next build` vẫn báo thành công, nhưng
 * HTML sinh ra trỏ tới vài chunk mà build không kịp ghi. Trình duyệt tải chunk
 * đó nhận **HTTP 500**, React nuốt thành `ChunkLoadError`, và người dùng chỉ
 * thấy trang lỗi "Something went wrong".
 *
 * Đã dính BA lần trong ngày 14/08, mỗi lần đều mất thời gian điều tra lại từ
 * đầu vì mọi dấu hiệu bề mặt đều bình thường: `curl /` trả 200, HTML đúng nội
 * dung, `pnpm gate` xanh. Chỉ khi kiểm HTTP code của TỪNG asset mới lộ ra.
 * Luật "đừng build khi server đang chạy" đã nằm trong ghi chú từ 23/07 mà vẫn
 * tái phạm — nên nó cần là một cái chặn chạy được, không phải một lời dặn.
 *
 * ── Nguyên tắc: THẤT BẠI THÌ MỞ ──
 * Mọi lỗi khi dò tiến trình đều bỏ qua và cho build chạy tiếp. Một guard làm
 * đỏ CI vì dò trượt còn tệ hơn chính con bug nó định chặn. Guard chỉ chặn khi
 * NHÌN THẤY bằng chứng rõ ràng.
 *
 * Bỏ qua có chủ đích: `ALLOW_BUILD_WITH_SERVER=1 pnpm build`
 */
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(import.meta.dirname, '..');

if (process.env.ALLOW_BUILD_WITH_SERVER === '1') process.exit(0);

/** Tiến trình Next đang SERVE (không phải đang build) từ chính thư mục này. */
function findServers() {
  const hits = [];
  let pids;
  try {
    pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
  } catch {
    return hits; // không phải Linux → không dò được, cho qua
  }
  for (const pid of pids) {
    try {
      if (readlinkSync(`/proc/${pid}/cwd`) !== APP_DIR) continue;
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
      // `next-server` là tên tiến trình con của cả `next start` lẫn `next dev`.
      // KHÔNG khớp 'next build' — nếu không guard sẽ tự chặn chính mình.
      if (/next-server|next start|next dev/.test(cmd)) hits.push({ pid, cmd });
    } catch {
      // tiến trình vừa thoát, hoặc không đủ quyền đọc — bỏ qua
    }
  }
  return hits;
}

const servers = findServers();
if (servers.length === 0) process.exit(0);

const list = servers.map((s) => `      pid ${s.pid}  ${s.cmd.slice(0, 60)}`).join('\n');
console.error(`
  ✗ Có server Next đang phục vụ từ ${path.relative(process.cwd(), APP_DIR) || '.'}/.next:

${list}

    Build lúc này sẽ ghi đè '.next' ngay dưới chân server đó và làm hỏng
    thư mục build MÀ KHÔNG BÁO LỖI — build vẫn "thành công", nhưng trang
    sẽ chết bằng ChunkLoadError khi tải asset.

    Cách xử lý:
      1. Tắt server:  kill ${servers.map((s) => s.pid).join(' ')}
      2. Dọn sạch:    rm -rf apps/web/.next
      3. Build lại, rồi mới bật server

    Cố tình muốn chạy (biết mình đang làm gì):
      ALLOW_BUILD_WITH_SERVER=1 <lệnh của bạn>
`);
process.exit(1);
