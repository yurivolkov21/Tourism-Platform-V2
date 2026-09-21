/**
 * Thử lại khi API hắt hơi, ADR-0044.
 *
 * Ba lượt build production ngày 21/09 chết vì ba mã lỗi khác nhau trên cùng
 * một đường: `TimeoutError` (quá 10s), **502** (`x-render-routing:
 * dynamic-free-error` — Render đang thay instance), và **520** (trang lỗi của
 * Cloudflare khi origin nghẹn). Cùng lúc đó gọi tay chính endpoint ấy trả 200
 * dưới 0,6 giây. Lỗi nằm ở hạ tầng free-tier, không ở dữ liệu.
 *
 * Lớp này bọc `fetch` của `OpenAPILink` — MỘT chỗ duy nhất — nên mọi route
 * hưởng lợi mà không phải đổi ngữ nghĩa lỗi của từng hàm đọc. Bốn ràng buộc
 * của ADR nằm nguyên trong `createRetryingFetch` bên dưới.
 */

/**
 * Status đáng thử lại. Gồm cả dải 52x của Cloudflare: 520 (origin trả lỗi lạ),
 * 521 (origin từ chối), 522 (hết hạn kết nối), 523 (không tới được origin),
 * 524 (origin trả lời quá chậm) — đúng những gì đứng giữa Vercel và Render.
 *
 * KHÔNG có 404 và 4xx nghiệp vụ: `POST_NOT_FOUND` phải tới được nhánh
 * `notFound()` của page, thử lại nó là ba lần chậm rồi vẫn 404.
 */
const TRANSIENT_STATUS: ReadonlySet<number> = new Set([
  408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
]);

export function isTransientStatus(status: number): boolean {
  return TRANSIENT_STATUS.has(status);
}

/**
 * Lỗi NÉM RA đáng thử lại: `TimeoutError` của `AbortSignal.timeout()`, và
 * `TypeError` mà `fetch` dùng cho mọi hỏng hóc tầng mạng ("fetch failed").
 * Lỗi lập trình thường đi thẳng — thử lại một `TypeError: x is not a function`
 * chỉ tổ chậm ba lần rồi vẫn hỏng.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof DOMException && error.name === 'TimeoutError';
}

/**
 * Hai lượt chờ giữa ba lần gọi. Đủ vượt một lần thay instance của Render (đo
 * 21/09: Nest boot xong ~1,5s sau khi container chạy), không đủ để giấu một sự
 * cố thật — API chết hẳn thì build vẫn đỏ, chỉ muộn thêm 1,6 giây.
 */
export const RETRY_DELAYS_MS = [400, 1200] as const;

/** Hạn mỗi lượt gọi: server rộng hơn vì prerender bắn hàng loạt xuyên châu lục. */
export const SERVER_TIMEOUT_MS = 20_000;
export const BROWSER_TIMEOUT_MS = 10_000;

type FetchLike = (request: Request, init: RequestInit) => Promise<Response>;

export function createRetryingFetch(deps: {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  isServer: () => boolean;
  delaysMs?: readonly number[];
}): FetchLike {
  const delays = deps.delaysMs ?? RETRY_DELAYS_MS;

  return async (request, init) => {
    // Hai cổng chặn TRƯỚC khi nghĩ tới chuyện thử lại:
    //  - POST/PATCH/DELETE: gửi lại là nguy cơ đặt trùng chỗ và thu tiền hai lần.
    //  - Trình duyệt: người dùng đang ngồi trước màn hình, im lặng thử ba lượt
    //    chỉ làm họ chờ lâu hơn mà không biết vì sao.
    if (request.method !== 'GET' || !deps.isServer()) return deps.fetch(request, init);

    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      const delay = delays[attempt];
      try {
        const response = await deps.fetch(request, init);
        if (!isTransientStatus(response.status) || delay === undefined) return response;
      } catch (error) {
        if (!isTransientError(error) || delay === undefined) throw error;
        lastError = error;
      }
      await deps.sleep(delay);
    }

    // Không tới được: vòng lặp luôn thoát bằng return hoặc throw ở lượt cuối
    // (`delay === undefined`). Giữ dòng này cho kiểu trả về đóng kín.
    throw lastError;
  };
}
