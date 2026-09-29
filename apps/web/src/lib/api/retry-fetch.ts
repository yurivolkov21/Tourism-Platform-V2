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
 * Lịch chờ LÚC CHẠY (ISR, SSR, route handler): hai lượt chờ giữa ba lần gọi.
 * Có người đang đứng chờ trang, nên sự cố thật phải lộ nhanh — API chết hẳn thì
 * chỉ muộn thêm 1,6 giây.
 */
export const RETRY_DELAYS_MS = [400, 1200] as const;

/**
 * Lịch chờ LÚC `next build` (ADR-0044 AMEND 1): năm lượt chờ giữa sáu lần gọi,
 * tổng 30 giây. Ngày 29/09 prerender dính `ECONNRESET` cả ba lượt của lịch ngắn
 * trong lúc Render thay instance API, còn `warm-api.mjs` trước đó phải chờ 24
 * giây mới gọi được. Lúc build không ai đứng chờ, mà build đỏ là mất một bản
 * deploy.
 */
export const BUILD_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15_000] as const;

/**
 * Giá trị `PHASE_PRODUCTION_BUILD` của `next/constants`, gõ lại ở đây vì module
 * này chạy cả trong bundle trình duyệt. Spec so với hằng của chính Next để bắt
 * lệch khi Next đổi tên pha.
 */
const PHASE_PRODUCTION_BUILD = 'phase-production-build';

/**
 * Chọn lịch chờ theo `process.env.NEXT_PHASE`. `next build` gán biến này ngay
 * trước khi tạo worker thu thập dữ liệu trang và prerender, và worker nhận
 * nguyên env của tiến trình cha (đọc trong mã Next 16.3.4) — nên mọi lượt gọi
 * lúc build đều thấy nó. Lúc chạy thì không có giá trị này.
 */
export function retryDelaysFor(phase: string | undefined): readonly number[] {
  return phase === PHASE_PRODUCTION_BUILD ? BUILD_RETRY_DELAYS_MS : RETRY_DELAYS_MS;
}

/** Hạn mỗi lượt gọi: server rộng hơn vì prerender bắn hàng loạt xuyên châu lục. */
export const SERVER_TIMEOUT_MS = 20_000;
export const BROWSER_TIMEOUT_MS = 10_000;

type FetchLike = (request: Request, init: RequestInit) => Promise<Response>;

/**
 * Mô tả ngắn một lượt hỏng cho dòng cảnh báo. Lỗi mạng của `fetch` giấu mã
 * thật (`ECONNRESET`, `ECONNREFUSED`…) trong `cause.code`, nên kéo nó ra —
 * thiếu mã thì dòng log chỉ còn "fetch failed", không phân biệt được gì.
 */
function describeFailure(outcome: unknown): string {
  if (outcome instanceof Response) return `trả HTTP ${outcome.status}`;
  if (!(outcome instanceof Error)) return `lỗi ${String(outcome)}`;
  const cause = outcome.cause as { code?: unknown } | undefined;
  const code = typeof cause?.code === 'string' ? ` (${cause.code})` : '';
  return `lỗi ${outcome.name}: ${outcome.message}${code}`;
}

export function createRetryingFetch(deps: {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  isServer: () => boolean;
  delaysMs?: readonly number[];
  /** Nhận một dòng mỗi lần SẮP thử lại; lượt cuối không ghi vì lỗi đã đi tiếp lên Next. */
  log?: (line: string) => void;
}): FetchLike {
  const delays = deps.delaysMs ?? RETRY_DELAYS_MS;
  const attempts = delays.length + 1;

  return async (request, init) => {
    // Hai cổng chặn TRƯỚC khi nghĩ tới chuyện thử lại:
    //  - POST/PATCH/DELETE: gửi lại là nguy cơ đặt trùng chỗ và thu tiền hai lần.
    //  - Trình duyệt: người dùng đang ngồi trước màn hình, im lặng thử ba lượt
    //    chỉ làm họ chờ lâu hơn mà không biết vì sao.
    if (request.method !== 'GET' || !deps.isServer()) return deps.fetch(request, init);

    // Chỉ đường dẫn, bỏ query: đủ để biết trang nào vấp mà không chép tham số
    // tìm kiếm vào log.
    const path = new URL(request.url).pathname;
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      const delay = delays[attempt];
      let failure: unknown;
      try {
        const response = await deps.fetch(request, init);
        if (!isTransientStatus(response.status) || delay === undefined) return response;
        failure = response;
      } catch (error) {
        if (!isTransientError(error) || delay === undefined) throw error;
        lastError = error;
        failure = error;
      }
      deps.log?.(
        `GET ${path} — lượt ${attempt + 1}/${attempts} ${describeFailure(failure)}, thử lại sau ${delay}ms`,
      );
      await deps.sleep(delay);
    }

    // Không tới được: vòng lặp luôn thoát bằng return hoặc throw ở lượt cuối
    // (`delay === undefined`). Giữ dòng này cho kiểu trả về đóng kín.
    throw lastError;
  };
}
