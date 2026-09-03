import type { Paged } from '@tourism/contract';

/**
 * Vòng gom trang DÙNG CHUNG của các nút Export CSV — nâng lên đây ở F10 khi
 * subscribers thành consumer THỨ HAI của đúng cái vòng lặp mà bookings (F6)
 * đã trả giá hai vòng review để viết đúng (§2.6: kit mọc từ consumer thứ hai).
 * Phần RIÊNG của mỗi vùng — gọi endpoint nào, khoá dedupe là cột gì — ở lại
 * `lib/api/<vùng>.ts`.
 *
 * ## Vì sao lặp trang từ admin, không phải một endpoint stream ở API
 *
 * (Nguyên văn quyết định F6, giữ ở đây vì đây mới là chỗ nó được thi hành.)
 *
 * - CSV là chuyện TRÌNH BÀY, không phải chuyện dữ liệu. `admin.<vùng>.list`
 *   đã trả đúng tập cần; thêm một endpoint `text/csv` vào API nghĩa là mở
 *   endpoint KHÔNG-JSON đầu tiên của một contract oRPC toàn JSON, cộng guard
 *   riêng, cộng int test riêng — tất cả chỉ để đổi định dạng.
 * - Route handler admin đã có sẵn cookie forward và chạy trên server, nên
 *   không bí mật nào rời khỏi server.
 * - Giá phải trả: N round-trip thay vì một stream, và cả tập nằm trong RAM
 *   một lúc. Ở cỡ back-office này đó là 1–2 request; ba chốt dưới đây giữ nó
 *   trong khuôn.
 *
 * ## Ba chốt của vòng gom (vòng vá review F6 lần 2)
 *
 * Rủi ro thật của "nhiều round-trip trong một route handler" đo bằng GIÂY chứ
 * không bằng dòng — trần số dòng một mình không ngừa được nó.
 *
 * - **Song song theo đợt** (`EXPORT_CONCURRENCY`): `totalPages` biết ngay sau
 *   trang đầu và trang 2..N không phụ thuộc nhau, nên 20 trang là ~4 đợt thay
 *   vì 20 lượt nối đuôi. Không phải MỘT `Promise.all` cả cụm: API trên Render
 *   dùng chung DB với đường khách, nện 19 request cùng lúc là tự bóp mình.
 * - **Một mốc thời gian CHUNG** (`EXPORT_TIME_BUDGET_MS`): 45s cho cả vòng,
 *   dưới `maxDuration = 60` mà mọi route export khai — quá ngân sách thì
 *   abort ném vào `catch` của route và admin nhận 502 CÓ LỜI, chứ không phải
 *   đợi platform giết function giữa chừng rồi trả một response cụt (thứ không
 *   bao giờ tái hiện được ở localhost).
 * - **Trần dòng** (`EXPORT_MAX_ROWS`): vượt thì TỪ CHỐI kèm con số, tuyệt đối
 *   không cắt bớt im lặng — một file thiếu hàng mà người xuất tưởng là đủ còn
 *   tệ hơn hẳn một lời từ chối.
 *
 * Ngày nào tập dữ liệu thật sự lớn (chục nghìn dòng) thì đường đúng là một
 * endpoint stream ở API — lúc đó đọc lại đoạn này trước khi làm.
 */

/** Trần dòng cho MỘT lần xuất — vượt thì route trả 413 kèm con số. */
export const EXPORT_MAX_ROWS = 2000;

/** `limit` mỗi lượt gọi — đúng trần `limit` của contract. */
export const EXPORT_PAGE_SIZE = 100;

/** Số trang gọi song song mỗi đợt — đủ nhanh mà không nện API thành bãi. */
export const EXPORT_CONCURRENCY = 5;

/** Ngân sách CHUNG cho cả vòng gom — phải nhỏ hơn `maxDuration` của route. */
export const EXPORT_TIME_BUDGET_MS = 45_000;

/**
 * Kết quả gom: cả tập, hoặc một trong hai lời từ chối kèm con số để báo cho
 * người bấm — `too-large` (vượt trần) và `changed` (tập ĐỔI KÍCH THƯỚC giữa
 * chừng, vòng vá review F10: hàng mới chen đầu list "mới nhất trước" đẩy
 * hàng cũ nhất ra khỏi cửa sổ trang mà không hàng nào lặp để dedupe bắt —
 * file thiếu đúng những hàng cũ nhất và người xuất tưởng là đủ).
 */
export type PagedExport<T> =
  | { kind: 'rows'; items: T[] }
  | { kind: 'too-large'; total: number; max: number }
  | { kind: 'changed'; total: number; now: number };

/**
 * Gom MỌI trang của một list admin đang lọc.
 *
 * `fetchPage` nhận số trang và signal ngân sách CHUNG (không phải một hạn
 * mức mới mỗi lượt) — vùng tự ghép nó vào context của client oRPC cùng với
 * bộ lọc và `limit: EXPORT_PAGE_SIZE` của nó.
 *
 * `keyOf` là khoá dedupe: offset pagination trên một list "mới nhất trước"
 * đang TRÔI — một hàng mới chen vào giữa hai lượt đẩy mọi hàng lùi một vị
 * trí, và hàng cuối trang trước quay lại đầu trang sau. Không dedupe thì file
 * có một khoá nằm hai lần mà chẳng ai hay. Chiều ngược lại — hàng bị đẩy RA
 * khỏi lưới trang — không cứu được từ client nhưng PHÁT HIỆN được: mọi trang
 * sau mang `total` khác trang đầu là tập đã đổi → `changed`, route trả 409
 * mời xuất lại (vòng vá review F10).
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, signal: AbortSignal) => Promise<Paged<T>>,
  keyOf: (item: T) => string,
): Promise<PagedExport<T>> {
  const budget = AbortSignal.timeout(EXPORT_TIME_BUDGET_MS);

  // Trang đầu trả luôn `total` — biết ngay có nên đi tiếp hay không.
  const first = await fetchPage(1, budget);
  if (first.total > EXPORT_MAX_ROWS) {
    return { kind: 'too-large', total: first.total, max: EXPORT_MAX_ROWS };
  }

  const seen = new Set<string>();
  const items: T[] = [];
  const collect = (batch: T[]) => {
    for (const item of batch) {
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  };
  collect(first.items);

  // Trang 2..N theo ĐỢT `EXPORT_CONCURRENCY` trang song song; `totalPages`
  // chốt ở trang đầu — tập trôi giữa chừng không kéo dài được vòng lặp.
  for (let start = 2; start <= first.totalPages; start += EXPORT_CONCURRENCY) {
    const last = Math.min(start + EXPORT_CONCURRENCY - 1, first.totalPages);
    const batch = await Promise.all(
      Array.from({ length: last - start + 1 }, (_, index) => fetchPage(start + index, budget)),
    );
    for (const paged of batch) {
      if (paged.total !== first.total) {
        return { kind: 'changed', total: first.total, now: paged.total };
      }
      collect(paged.items);
    }
  }
  return { kind: 'rows', items };
}
